import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchActiveMasterVendors, linkExistingActiveVendor } from '../../lib/vendor-location-helpers';

export default function LinkActiveVendorModal({ onClose }) {
  const ref = useRef(null), pending = useRef(false), navigate = useNavigate();
  const [vendors, setVendors] = useState([]), [selected, setSelected] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let ignore = false; const dialog = ref.current; dialog.showModal();
    fetchActiveMasterVendors().then((data) => { if (!ignore) setVendors(data); }).catch((err) => { if (!ignore) setError(err.message); }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; dialog.close(); };
  }, []);
  const submit = async (event) => {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { const id = await linkExistingActiveVendor(selected); toast.success('Vendor aktif terhubung ke pengelolaan lokasi'); navigate(`/vendor/database/${id}?tab=location`); }
    catch (err) { setError(err.message); } finally { pending.current = false; setBusy(false); }
  };
  return <dialog ref={ref} aria-labelledby="active-location-title" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-auto rounded-xl bg-ink-900 text-white border border-white/10 p-5 backdrop:bg-black/70">
    <form onSubmit={submit} className="space-y-4"><h2 id="active-location-title" className="text-lg font-semibold">Lokasikan Vendor Aktif</h2>
      <p className="text-sm text-ink-400">Pilih master vendor yang sudah aktif. Lokasi dikelola melalui profil terhubung; relasi aset/kontrak tetap memakai master yang sama. Bila profil sudah ada, sistem membukanya kembali.</p>
      {loading ? <p role="status">Memuat master vendor…</p> : <label><span className="label">Master vendor aktif *</span><select className="input" value={selected} onChange={(e) => setSelected(e.target.value)} required><option value="">Pilih vendor aktif</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.vendor_code} · {v.vendor_name}</option>)}</select></label>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Batal</button><button type="submit" className="btn-primary" disabled={busy || !selected}>{busy ? 'Menghubungkan…' : 'Hubungkan dan Kelola Lokasi'}</button></div>
    </form>
  </dialog>;
}
