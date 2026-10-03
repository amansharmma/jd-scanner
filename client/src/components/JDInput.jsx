import { useState } from 'react';

const SAMPLE_JD = `We are hiring a Full Stack Developer with 2+ years of experience.

Requirements:
- Strong knowledge of JavaScript, React and Node.js
- Experience building REST APIs with Express
- Working with MongoDB or PostgreSQL databases
- Familiar with Git and Agile workflows
- Good communication and problem solving skills

Nice to have:
- TypeScript, Docker, AWS
- Experience mentoring junior developers`;

export default function JDInput({ onScan, scanning, disabled, scopeLabel }) {
  const [jd, setJd] = useState('');

  return (
    <div className="jd">
      <textarea
        rows={14}
        placeholder="Paste the job description here…"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />
      <div className="row">
        <button className="secondary" type="button" onClick={() => setJd(SAMPLE_JD)}>
          Use sample JD
        </button>
        <button onClick={() => onScan(jd)} disabled={scanning || disabled || !jd.trim()}>
          {scanning ? 'Scanning…' : `Scan ${scopeLabel} candidates`}
        </button>
      </div>
      <p className="hint">
        Tip: put optional skills under a “Nice to have” heading — they count half as much.
      </p>
    </div>
  );
}
