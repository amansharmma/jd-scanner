import { useRef, useState } from 'react';
import { uploadCandidates } from '../api';

export default function UploadForm({ onUploaded, onError }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInput = useRef();

  const single = files.length <= 1;

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length) return onError('Choose at least one PDF.');
    const fd = new FormData();
    files.forEach((f) => fd.append('cvs', f));
    if (single) {
      fd.append('name', name);
      fd.append('email', email);
    }
    setBusy(true);
    setNotice('');
    try {
      const { added, warnings } = await uploadCandidates(fd);
      setNotice([`Added ${added.length} candidate(s).`, ...warnings].join(' '));
      setName('');
      setEmail('');
      setFiles([]);
      fileInput.current.value = '';
      onUploaded();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="upload" onSubmit={submit}>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={(e) => setFiles([...e.target.files])}
      />
      {single ? (
        <div className="row">
          <input placeholder="Candidate name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      ) : (
        <p className="hint">{files.length} files selected — names will be taken from file names.</p>
      )}
      <button type="submit" disabled={busy || !files.length}>
        {busy ? 'Uploading…' : 'Upload CV' + (files.length > 1 ? 's' : '')}
      </button>
      {notice && <p className="hint">{notice}</p>}
    </form>
  );
}
