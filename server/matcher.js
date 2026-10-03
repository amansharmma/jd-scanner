// Matching engine: compares a Job Description against a candidate's CV text
// and produces a 0-100 match percentage with an explanation.
//
// Score = weighted mix of
//   1. Skills match      (60%) - known skills found in the JD that also appear in the CV
//                                ("nice to have" skills count half)
//   2. Keyword coverage  (25%) - important JD words (not in skill list) found in the CV
//   3. Experience        (15%) - candidate years vs. years required in the JD
// If the JD has no skills or no experience requirement, those weights are
// redistributed across the remaining components.

const SKILLS = require('./skills');

const WEIGHTS = { skills: 0.6, keywords: 0.25, experience: 0.15 };

const STOPWORDS = new Set(`
a about above after again against all am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have
having he her here hers herself him himself his how i if in into is it its itself just me more most
my myself no nor not now of off on once only or other our ours ourselves out over own same she should
so some such than that the their theirs them themselves then there these they this those through to
too under until up very was we were what when where which while who whom why will with you your yours
yourself yourselves also etc may must shall within across using use used via per well like including
`.split(/\s+/).filter(Boolean));

// Words common in any JD that say nothing about fit.
const JD_NOISE = new Set(`
experience experienced candidate candidates role roles team teams work working job jobs ability able
strong good excellent knowledge understanding responsibilities responsibility requirements required
requirement preferred plus bonus nice looking join company opportunity years year skills skill
minimum least degree related field equivalent etc new help ensure including various key responsible
develop build make we're you'll you're will apply position description qualifications qualification
must-have must have candidate's people environment based day per time high level
`.split(/\s+/).filter(Boolean));

const OPTIONAL_SECTION = /(nice[\s-]to[\s-]have|good[\s-]to[\s-]have|preferred qualifications|preferred skills|bonus points|is a plus|added advantage)/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// Pre-compile one regex per skill. Custom boundaries so "c++", "node.js", ".net" work
// and "java" does not match inside "javascript".
const SKILL_PATTERNS = SKILLS.map((s) => ({
  name: s.name,
  regex: new RegExp(
    `(?<![a-z0-9+#])(?:${s.aliases.map(escapeRegex).join('|')})(?![a-z0-9+#])`,
    'i'
  ),
}));

function normalize(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ');
}

function extractSkills(text) {
  const t = normalize(text);
  return SKILL_PATTERNS.filter((p) => p.regex.test(t)).map((p) => p.name);
}

function tokenize(text) {
  return (normalize(text).match(/[a-z][a-z0-9+#.-]*/g) || [])
    .map((w) => w.replace(/[.-]+$/, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Years of experience demanded by the JD, e.g. "3+ years", "2-4 yrs", "minimum 5 years".
function extractRequiredYears(jd) {
  const m = normalize(jd).match(/(\d{1,2})\s*\+?\s*(?:-|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years?|yrs?)/);
  return m ? parseInt(m[1], 10) : null;
}

// Best-effort estimate of a candidate's years of experience from their CV.
function extractCandidateYears(cv) {
  const t = normalize(cv);

  // 1. Explicit statements: "5 years of experience", "3.5+ yrs"
  const explicit = [...t.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)/g)]
    .map((m) => parseFloat(m[1]))
    .filter((n) => n > 0 && n <= 40);
  if (explicit.length) return Math.max(...explicit);

  // 2. Date ranges: "2019 - 2023", "2021 – Present"
  const now = new Date().getFullYear();
  const ranges = [...t.matchAll(/((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now|till date|ongoing)/g)]
    .map((m) => {
      const start = parseInt(m[1], 10);
      const end = /^\d/.test(m[2]) ? parseInt(m[2], 10) : now;
      return end >= start ? end - start : 0;
    });
  if (ranges.length) return Math.min(40, ranges.reduce((a, b) => a + b, 0));

  return 0;
}

// Pre-compute everything about the JD once, then score each CV against it.
function analyzeJD(jd) {
  const splitAt = jd.search(OPTIONAL_SECTION);
  const requiredPart = splitAt >= 0 ? jd.slice(0, splitAt) : jd;
  const optionalPart = splitAt >= 0 ? jd.slice(splitAt) : '';

  const required = extractSkills(requiredPart);
  const optional = extractSkills(optionalPart).filter((s) => !required.includes(s));

  // Top keywords by frequency, excluding noise words and words already covered by skills.
  const skillWords = new Set(
    SKILLS.filter((s) => required.includes(s.name) || optional.includes(s.name))
      .flatMap((s) => s.aliases.flatMap((a) => a.split(/\s+/)))
  );
  const freq = {};
  for (const w of tokenize(jd)) {
    if (JD_NOISE.has(w) || skillWords.has(w) || /^\d/.test(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([w]) => w);

  return { required, optional, keywords, requiredYears: extractRequiredYears(jd) };
}

function stem(w) {
  return w.replace(/(ing|ed|es|s)$/, '');
}

function scoreCandidate(jdInfo, cvText) {
  const cvSkills = new Set(extractSkills(cvText));
  const cvStems = new Set(tokenize(cvText).map(stem));
  const candidateYears = extractCandidateYears(cvText);

  const components = {};

  // 1. Skills
  const totalSkillWeight = jdInfo.required.length + jdInfo.optional.length * 0.5;
  const matchedRequired = jdInfo.required.filter((s) => cvSkills.has(s));
  const matchedOptional = jdInfo.optional.filter((s) => cvSkills.has(s));
  if (totalSkillWeight > 0) {
    components.skills = (matchedRequired.length + matchedOptional.length * 0.5) / totalSkillWeight;
  }

  // 2. Keywords
  const matchedKeywords = jdInfo.keywords.filter((k) => cvStems.has(stem(k)));
  if (jdInfo.keywords.length > 0) {
    components.keywords = matchedKeywords.length / jdInfo.keywords.length;
  }

  // 3. Experience
  if (jdInfo.requiredYears) {
    components.experience = Math.min(1, candidateYears / jdInfo.requiredYears);
  }

  // Weighted average over the components that apply to this JD.
  const active = Object.keys(components);
  const weightSum = active.reduce((sum, k) => sum + WEIGHTS[k], 0) || 1;
  const score = active.reduce((sum, k) => sum + components[k] * WEIGHTS[k], 0) / weightSum;
  const percentage = Math.round(score * 100);

  return {
    percentage,
    verdict:
      percentage >= 75 ? 'Strong match' :
      percentage >= 50 ? 'Good match' :
      percentage >= 30 ? 'Partial match' : 'Weak match',
    breakdown: Object.fromEntries(active.map((k) => [k, Math.round(components[k] * 100)])),
    matchedSkills: matchedRequired,
    missingSkills: jdInfo.required.filter((s) => !cvSkills.has(s)),
    matchedOptionalSkills: matchedOptional,
    missingOptionalSkills: jdInfo.optional.filter((s) => !cvSkills.has(s)),
    matchedKeywords,
    missingKeywords: jdInfo.keywords.filter((k) => !matchedKeywords.includes(k)),
    candidateYears,
    requiredYears: jdInfo.requiredYears,
  };
}

module.exports = { analyzeJD, scoreCandidate, extractSkills, extractCandidateYears };
