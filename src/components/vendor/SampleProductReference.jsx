import { useEffect, useState } from 'react';
import { signedProductReference } from '../../lib/vendor-product-catalog';
import { formatFollowupTime } from '../../lib/vendor-followup-helpers';

export default function SampleProductReference({ reference }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {
    if (!reference?.image_path) return;
    let ignore = false; setUrl(''); setError('');
    signedProductReference(reference.image_path).then(value => { if (!ignore) setUrl(value); }).catch(() => { if (!ignore) setError('Foto acuan belum dapat dimuat.'); });
    return () => { ignore = true; };
  }, [reference?.image_path, version]);
  if (!reference) return null;
  return <section className="card p-4" aria-label="Produk acuan tersimpan">
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="sm:w-40 shrink-0">{url ? <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`Acuan ${reference.product_name}`} className="h-40 w-full object-contain rounded-lg bg-white/5" onError={() => { setUrl(''); setError('Foto acuan belum dapat dimuat.'); }} /></a> : <div className="h-40 rounded-lg bg-white/5 flex items-center justify-center p-3 text-center text-xs text-ink-400">{error || 'Memuat foto acuan…'}</div>}<button type="button" className="text-xs text-primary-400 underline mt-2" onClick={() => setVersion(v => v + 1)}>Muat ulang foto acuan</button></div>
      <div className="min-w-0 space-y-2"><span className="badge-blue">Acuan katalog Ofissio</span><h3 className="font-medium break-words">{reference.product_name}</h3><p className="text-sm text-ink-400">{reference.product_code}{reference.material ? ` · ${reference.material}` : ''}</p><p className="text-xs text-ink-400">Disalin {formatFollowupTime(reference.captured_at)}. Acuan tersimpan tetap sama meskipun katalog toko berubah.</p><p className="text-xs text-ink-400">Bandingkan hasil pengerjaan dan bukti QC dengan acuan ini serta brief sampel.</p>{/^https:\/\/ofissio\.com\/product\/[a-z0-9-]+$/.test(reference.product_url) && <a className="text-xs text-primary-400 underline" href={reference.product_url} target="_blank" rel="noopener noreferrer">Lihat produk di Ofissio (versi saat ini)</a>}</div>
    </div>
  </section>;
}
