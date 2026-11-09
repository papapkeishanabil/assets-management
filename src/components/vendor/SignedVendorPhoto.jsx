import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { signedPhotoUrl } from '../../lib/vendor-location-helpers';

export default function SignedVendorPhoto({ path, alt, className = 'w-full h-40 object-cover rounded-lg', onClick }) {
  const { profile } = useAuth();
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => {
    let ignore = false; setUrl(''); setError('');
    if (path && profile?.id) signedPhotoUrl(path).then((signed) => { if (!ignore) setUrl(signed); }).catch(() => { if (!ignore) setError('Foto tidak dapat dimuat'); });
    return () => { ignore = true; };
  }, [path, profile?.id, version]);
  if (error) return <div className="text-xs text-ink-400 p-3">{error} <button type="button" className="underline" onClick={() => setVersion((v) => v + 1)}>Muat ulang foto</button></div>;
  if (!url) return <div role="status" className={`${className} bg-white/5 animate-pulse`} aria-label="Memuat foto privat" />;
  const img = <img src={url} alt={alt} className={className} onError={() => setError('Foto atau tautan sementara tidak tersedia')} />;
  return onClick ? <button type="button" className="w-full text-left" onClick={onClick} aria-label={`Perbesar foto ${alt}`}>{img}</button> : img;
}
