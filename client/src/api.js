async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.warnings?.join('\n') || `Request failed (${res.status})`);
  return data;
}

export const getCandidates = () => request('/api/candidates');

export const uploadCandidates = (formData) =>
  request('/api/candidates', { method: 'POST', body: formData });

export const deleteCandidate = (id) => request(`/api/candidates/${id}`, { method: 'DELETE' });

export const matchCandidates = (jd, candidateIds) =>
  request('/api/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jd, candidateIds }),
  });
