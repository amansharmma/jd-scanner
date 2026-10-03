import { Fragment, useState } from 'react';

function scoreClass(p) {
  if (p >= 75) return 'strong';
  if (p >= 50) return 'good';
  if (p >= 30) return 'partial';
  return 'weak';
}

function Chips({ items, kind }) {
  if (!items.length) return <span className="muted">—</span>;
  return items.map((s) => <span key={s} className={`chip ${kind}`}>{s}</span>);
}

export default function Results({ match }) {
  const { jd, results } = match;
  const [open, setOpen] = useState(null);

  const exportCsv = () => {
    const rows = [
      ['Rank', 'Name', 'Email', 'Match %', 'Verdict', 'Matched skills', 'Missing skills', 'Years'],
      ...results.map((r, i) => [
        i + 1, r.name, r.email, r.percentage, r.verdict,
        r.matchedSkills.join('; '), r.missingSkills.join('; '), r.candidateYears,
      ]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'jd-scan-results.csv';
    a.click();
  };

  return (
    <section className="card results">
      <div className="results-head">
        <h2>Results</h2>
        <button className="secondary" onClick={exportCsv} disabled={!results.length}>Export CSV</button>
      </div>

      <div className="jd-summary">
        <div><strong>Required skills:</strong> <Chips items={jd.required} kind="neutral" /></div>
        <div><strong>Nice to have:</strong> <Chips items={jd.optional} kind="neutral" /></div>
        <div><strong>Experience required:</strong> {jd.requiredYears ? `${jd.requiredYears}+ years` : 'not specified'}</div>
      </div>

      {!results.length ? (
        <p className="empty">No candidates to score.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate</th>
              <th>Match</th>
              <th>Verdict</th>
              <th>Skills</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <Fragment key={r.id}>
                <tr>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="muted">{r.email}</div>
                  </td>
                  <td className="score-cell">
                    <div className="bar">
                      <div className={`fill ${scoreClass(r.percentage)}`} style={{ width: `${r.percentage}%` }} />
                    </div>
                    <span className="pct">{r.percentage}%</span>
                  </td>
                  <td><span className={`badge ${scoreClass(r.percentage)}`}>{r.verdict}</span></td>
                  <td>{r.matchedSkills.length}/{jd.required.length}</td>
                  <td>
                    <button className="link" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {open === r.id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {open === r.id && (
                  <tr className="details">
                    <td colSpan={6}>
                      <div className="breakdown">
                        {Object.entries(r.breakdown).map(([k, v]) => (
                          <div key={k}><span className="muted">{k}</span><strong>{v}%</strong></div>
                        ))}
                        <div>
                          <span className="muted">experience</span>
                          <strong>~{r.candidateYears} yrs</strong>
                        </div>
                      </div>
                      <p><strong>Matched skills:</strong> <Chips items={r.matchedSkills} kind="ok" /></p>
                      <p><strong>Missing skills:</strong> <Chips items={r.missingSkills} kind="bad" /></p>
                      <p>
                        <strong>Nice-to-have:</strong> <Chips items={r.matchedOptionalSkills} kind="ok" />{' '}
                        <Chips items={r.missingOptionalSkills} kind="bad" />
                      </p>
                      <p><strong>Keywords found:</strong> <Chips items={r.matchedKeywords} kind="ok" /></p>
                      <p><strong>Keywords missing:</strong> <Chips items={r.missingKeywords} kind="bad" /></p>
                      <a href={`/api/candidates/${r.id}/cv`} target="_blank" rel="noreferrer">Open CV ↗</a>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
