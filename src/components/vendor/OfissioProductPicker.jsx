import { useEffect, useId, useRef, useState } from 'react';
import { Check, ImageOff, Search } from 'lucide-react';
import { searchOfissioProducts } from '../../lib/vendor-product-catalog';

function ProductPhoto({ product }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_url]);
  return failed ? <div className="h-28 flex items-center justify-center text-ink-400"><ImageOff size={28} aria-label="Foto tidak dapat dimuat" /></div>
    : <img src={product.image_url} alt={product.name} className="h-28 w-full object-contain rounded-lg bg-white/5" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
export default function OfissioProductPicker({ value, onChange, disabled }) {
  const prefix = useId(), version = useRef(0);
  const [query, setQuery] = useState(''), [products, setProducts] = useState([]), [loading, setLoading] = useState(false), [searched, setSearched] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { version.current += 1; }, []);
  const search = async () => {
    if (query.trim().length < 2 || disabled) return;
    const attempt = ++version.current; setLoading(true); setError(''); setProducts([]); setSearched(true);
    try { const rows = await searchOfissioProducts(query.trim()); if (version.current === attempt) setProducts(rows); }
    catch (err) { if (version.current === attempt) setError(err.message); }
    finally { if (version.current === attempt) setLoading(false); }
  };
  return <section className="card p-4 space-y-3" aria-label="Pilih produk katalog Ofissio">
    <div><h3 className="text-sm font-semibold">Produk acuan dari katalog Ofissio</h3><p className="text-xs text-ink-400 mt-1">Termasuk produk Sasienala yang tersedia di Ofissio. Cari berdasarkan nama atau kode produk.</p></div>
    <label className="label" htmlFor={prefix + 'search'}>Cari produk</label>
    <div className="flex gap-2"><input id={prefix + 'search'} className="input min-w-0" placeholder="Contoh: KS-003 atau kemeja" maxLength={160} value={query} disabled={disabled} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} /><button type="button" className="btn-secondary shrink-0" disabled={disabled || loading || query.trim().length < 2} onClick={search}><Search size={15} /> Cari</button></div>
    {loading && <p role="status" className="text-sm text-ink-400">Mencari produk Ofissio…</p>}
    {error && <p role="alert" className="text-sm text-danger-400">{error}</p>}
    {!loading && !error && searched && products.length === 0 && <p role="status" className="text-sm text-ink-400">Produk dengan foto belum ditemukan. Coba nama atau kode lain.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{products.map(product => <button type="button" key={product.id} disabled={disabled} aria-pressed={value?.id === product.id} aria-label={`Pilih ${product.name}`} onClick={() => onChange(product)} className={`text-left min-w-0 rounded-xl border p-3 transition-colors ${value?.id === product.id ? 'border-primary-400 bg-primary-500/10' : 'border-white/10 hover:border-primary-400/60'}`}>
      <ProductPhoto product={product} /><span className="flex justify-between items-center gap-2 mt-2"><span className="font-mono text-xs text-primary-400">{product.sku}</span>{value?.id === product.id && <Check size={15} className="text-primary-400" />}</span><span className="block text-sm font-medium mt-1 break-words">{product.name}</span><span className="block text-xs text-ink-400 mt-1">{product.material || 'Bahan mengikuti spesifikasi sampel'}</span>
    </button>)}</div>
    {value && <div className="border-t border-white/10 pt-3 flex gap-3 items-center"><div className="w-20 shrink-0"><ProductPhoto key={value.id} product={value} /></div><div className="min-w-0"><p className="badge-blue">Produk dipilih</p><p className="text-sm font-medium mt-1 break-words">{value.name} · {value.sku}</p><p className="text-xs text-ink-400 mt-1">Foto dan informasi acuan disalin saat sampel disimpan. Warna/ukuran dan standar pengerjaan diisi pada brief.</p></div></div>}
  </section>;
}
