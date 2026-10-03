export default function CandidateList({ candidates, selected, setSelected, onDelete }) {
  if (!candidates.length) return <p className="empty">No candidates yet. Upload some CVs above.</p>;

  const toggle = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <>
      <p className="hint">
        Tick candidates to scan only them, or leave all unticked to scan everyone.
        {selected.size > 0 && (
          <button className="link" onClick={() => setSelected(new Set())}>Clear selection</button>
        )}
      </p>
      <ul className="candidates">
        {candidates.map((c) => (
          <li key={c.id}>
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            <div className="info">
              <strong>{c.name}</strong>
              <span className="muted">
                {c.email || 'no email'} · {c.years ? `~${c.years} yrs` : 'exp. n/a'} · {c.skills.length} skills
                {c.textLength === 0 && <span className="warn"> · unreadable PDF</span>}
              </span>
            </div>
            <a href={`/api/candidates/${c.id}/cv`} target="_blank" rel="noreferrer">View CV</a>
            <button className="danger" onClick={() => onDelete(c.id)} title="Remove">✕</button>
          </li>
        ))}
      </ul>
    </>
  );
}
