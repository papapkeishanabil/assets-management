import { useEffect, useState } from 'react';
import { signedDecisionProof } from '../../lib/vendor-approvals';
export default function DecisionEvidence({ path, bucket, label = 'Buka bukti keputusan privat', image = false }) {
  const [url, setUrl] = useState(''), [version, setVersion] = useState(0), [error, setError] = useState('');
  useEffect(() => { if (!path) return; let ignore = false; setUrl(''); setError(''); signedDecisionProof(path, bucket).then((u) => { if (!ignore) setUrl(u); }).catch(() => { if (!ignore) setError('Bukti belum dapat dibuka'); }); return () => { ignore = true; }; }, [path, bucket, version]);
  if (!path) return null;
  return <div className="text-xs space-y-2">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-400 underline">{image && <img src={url} alt={label} className="h-28 max-w-full object-contain rounded-lg mb-1" />}{label}</a> : <span className="text-ink-400">{error || 'Memuat bukti privat…'}</span>}<button type="button" className="text-ink-400 underline ml-2" onClick={() => setVersion((n) => n + 1)}>Muat ulang tautan</button></div>;
}
