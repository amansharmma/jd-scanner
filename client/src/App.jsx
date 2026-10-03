import { useEffect, useState } from 'react';
import { getCandidates, deleteCandidate, matchCandidates } from './api';
import UploadForm from './components/UploadForm';
import CandidateList from './components/CandidateList';
import JDInput from './components/JDInput';
import Results from './components/Results';

export default function App() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [match, setMatch] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => getCandidates().then(setCandidates).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Remove this candidate?')) return;
    await deleteCandidate(id);
    setSelected((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    setMatch((m) => m && { ...m, results: m.results.filter((r) => r.id !== id) });
    refresh();
  };

  const handleScan = async (jd) => {
    setError('');
    setScanning(true);
    try {
      setMatch(await matchCandidates(jd, [...selected]));
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>📄 JD Scanner</h1>
        <p>Upload candidate CVs, paste a job description, and see who fits best.</p>
      </header>

      {error && <div className="alert error" onClick={() => setError('')}>{error}</div>}

      <div className="grid">
        <section className="card">
          <h2>Candidates ({candidates.length})</h2>
          <UploadForm onUploaded={refresh} onError={setError} />
          <CandidateList
            candidates={candidates}
            selected={selected}
            setSelected={setSelected}
            onDelete={handleDelete}
          />
        </section>

        <section className="card">
          <h2>Job Description</h2>
          <JDInput
            onScan={handleScan}
            scanning={scanning}
            disabled={!candidates.length}
            scopeLabel={selected.size ? `${selected.size} selected` : `all ${candidates.length}`}
          />
        </section>
      </div>

      {match && <Results match={match} />}
    </div>
  );
}
