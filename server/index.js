const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
// Import the lib file directly: pdf-parse's index.js runs a debug test on require.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const store = require('./store');
const { analyzeJD, scoreCandidate, extractSkills, extractCandidateYears } = require('./matcher');

const PORT = process.env.PORT || 5001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error(`"${file.originalname}" is not a PDF`));
    }
  },
});

// Strip the heavy CV text before sending a candidate to the browser.
function publicCandidate({ text, ...c }) {
  return { ...c, textLength: text.length };
}

function nameFromFilename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[_-]+/g, ' ')
    .replace(/\b(cv|resume|curriculum vitae)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unnamed Candidate';
}

// List candidates
app.get('/api/candidates', (_req, res) => {
  res.json(store.load().map(publicCandidate));
});

// Upload one or many CVs (field name: "cvs")
app.post('/api/candidates', upload.array('cvs', 50), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Please attach at least one PDF CV.' });

  const candidates = store.load();
  const added = [];
  const warnings = [];

  for (const file of files) {
    try {
      const { text } = await pdfParse(fs.readFileSync(file.path));
      const cleanText = (text || '').trim();
      if (!cleanText) {
        warnings.push(`"${file.originalname}" has no readable text (scanned image?). It will score 0%.`);
      }

      const emailInText = cleanText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      const candidate = {
        id: randomUUID(),
        name: (files.length === 1 && req.body.name?.trim()) || nameFromFilename(file.originalname),
        email: (files.length === 1 && req.body.email?.trim()) || (emailInText ? emailInText[0] : ''),
        fileName: file.originalname,
        storedFile: file.filename,
        skills: extractSkills(cleanText),
        years: extractCandidateYears(cleanText),
        uploadedAt: new Date().toISOString(),
        text: cleanText,
      };
      candidates.push(candidate);
      added.push(publicCandidate(candidate));
    } catch (err) {
      fs.rmSync(file.path, { force: true });
      warnings.push(`Could not read "${file.originalname}": ${err.message}`);
    }
  }

  store.save(candidates);
  res.status(added.length ? 201 : 400).json({ added, warnings });
});

// View a candidate's original PDF
app.get('/api/candidates/:id/cv', (req, res) => {
  const c = store.load().find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  res.type('application/pdf').sendFile(path.join(UPLOAD_DIR, c.storedFile));
});

// Delete a candidate
app.delete('/api/candidates/:id', (req, res) => {
  const candidates = store.load();
  const c = candidates.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  fs.rmSync(path.join(UPLOAD_DIR, c.storedFile), { force: true });
  store.save(candidates.filter((x) => x.id !== c.id));
  res.json({ ok: true });
});

// Match all (or selected) candidates against a JD
app.post('/api/match', (req, res) => {
  const { jd, candidateIds } = req.body || {};
  if (!jd || jd.trim().length < 30) {
    return res.status(400).json({ error: 'Please paste a job description (at least 30 characters).' });
  }

  let candidates = store.load();
  if (Array.isArray(candidateIds) && candidateIds.length) {
    candidates = candidates.filter((c) => candidateIds.includes(c.id));
  }

  const jdInfo = analyzeJD(jd);
  const results = candidates
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      fileName: c.fileName,
      ...scoreCandidate(jdInfo, c.text),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  res.json({ jd: jdInfo, results });
});

// In production, serve the built React app from the same server.
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => console.log(`JD Scanner API running on http://localhost:${PORT}`));
