import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { PROCESS_STAGE_LABELS, QUALIFICATION_LABELS, OPERATIONAL_LABELS, VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { LOCATION_READ_ROLES, LOCATION_TYPES, VERIFICATION_LABELS, filterMapPoints, googleMapsUrl } from '../../lib/vendor-location-utils';
import { fetchMapPoints, fetchMapSpecialties } from '../../lib/vendor-location-helpers';
import { fetchFollowupOptions } from '../../lib/vendor-followup-helpers';
import VendorGoogleMap from '../../components/vendor/VendorGoogleMap';
import SignedVendorPhoto from '../../components/vendor/SignedVendorPhoto';
import LinkActiveVendorModal from '../../components/vendor/LinkActiveVendorModal';

const EMPTY = { search: '', category: '', specialty: '', stage: '', qualification: '', operational: '', pic: '', city: '', verification: '', primary: false, scope: '' };
export default function VendorMapPage() {
  const { role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const [params] = useSearchParams(); const candidateId = params.get('candidate') || '';
  const allowed = hasAccess('vendor_map') && LOCATION_READ_ROLES.includes(role?.role_name);
  const [rows, setRows] = useState([]), [options, setOptions] = useState({ users: [], categories: [], specialties: [] });
  const [filters, setFilters] = useState(EMPTY), [mode, setMode] = useState('all'), [page, setPage] = useState(0), [selectedKey, setSelectedKey] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0), [linking, setLinking] = useState(false);
  const [backendPending, setBackendPending] = useState(false);
  const canWrite = allowed && VENDOR_WRITE_ROLES.includes(role?.role_name) && !backendPending && !loading && !error;
  useEffect(() => {
    if (!allowed) return;
    let ignore = false; setLoading(true); setError('');
    Promise.all([fetchMapPoints(), fetchFollowupOptions(), fetchMapSpecialties()]).then(([points, opts, specialties]) => {
      if (!ignore) { setRows(points || []); setBackendPending(points === null); setOptions({ ...opts, specialties }); }
    }).catch((err) => { if (!ignore) setError(err.message); }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [allowed, version]);
  const change = (key, value) => { setFilters((old) => ({ ...old, [key]: value, ...(key === 'category' ? { specialty: '' } : {}) })); setPage(0); setSelectedKey(''); };
  const filtered = useMemo(() => filterMapPoints(candidateId ? rows.filter((r) => r.candidate_id === candidateId) : rows, filters), [rows, filters, candidateId]);
  const unmapped = useMemo(() => [...new Map(filtered.filter((r) => Number(r.mapped_count) === 0).map((r) => [r.candidate_id, r])).values()], [filtered]);
  const mapped = useMemo(() => mode === 'unmapped' ? [] : filtered.filter((r) => r.latitude !== null && r.longitude !== null), [filtered, mode]);
  const list = mode === 'unmapped' ? unmapped : filtered;
  const selected = filtered.find((r) => `${r.candidate_id}/${r.location_id || ''}` === selectedKey);
  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort();
  const select = (row) => setSelectedKey(`${row.candidate_id}/${row.location_id || ''}`);
  const choices = [
    ['category', 'Kategori', options.categories.map((c) => [c.id, c.name])],
    ['specialty', 'Spesialisasi', options.specialties.filter((s) => !filters.category || s.category_id === filters.category).map((s) => [s.id, s.name])],
    ['stage', 'Tahap proses', Object.entries(PROCESS_STAGE_LABELS)], ['qualification', 'Kelayakan', Object.entries(QUALIFICATION_LABELS)],
    ['operational', 'Status operasional', Object.entries(OPERATIONAL_LABELS)], ['pic', 'PIC kandidat', options.users.map((u) => [u.id, u.full_name])],
    ['city', 'Kota', cities.map((c) => [c, c])], ['verification', 'Verifikasi', Object.entries(VERIFICATION_LABELS)],
    ['scope', 'Jenis vendor', [['candidate', 'Calon vendor'], ['active', 'Terhubung master aktif']]]
  ];
  if (permissionsLoading) return <p role="status" className="text-ink-400">Memuat akses peta…</p>;
  if (!allowed) return <p className="card p-5 text-ink-400">Akses Peta Vendor ditolak.</p>;
  return <div className="space-y-5 animate-fade-in">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl md:text-3xl font-semibold text-white">Peta Lokasi Vendor</h1><p className="text-sm text-ink-400 mt-1">Setiap fasilitas berkoordinat ditampilkan sebagai titik tersendiri.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={loading} onClick={() => setVersion((n) => n + 1)}><RefreshCw size={14} /> Refresh peta</button>{canWrite && <button className="btn-primary" onClick={() => setLinking(true)}><MapPin size={14} /> Lokasikan Vendor Aktif</button>}</div></div>
    <div className="card p-4 space-y-3">
      {candidateId && <p className="text-sm text-primary-400">Menampilkan lokasi satu kandidat. <Link to="/vendor/map" className="underline">Lihat semua vendor</Link></p>}
      <label><span className="label">Cari nama vendor / fasilitas</span><input className="input" value={filters.search} onChange={(e) => change('search', e.target.value)} /></label>
      <details><summary className="text-sm text-primary-400 cursor-pointer">Filter kategori, status, lokasi dan PIC</summary><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">{choices.map(([key, label, values]) => <label key={key}><span className="label">{label}</span><select className="input" value={filters[key]} onChange={(e) => change(key, e.target.value)}><option value="">Semua</option>{values.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>)}</div></details>
      <div className="flex flex-wrap gap-4 items-center"><label className="flex items-center gap-2 text-sm text-ink-300"><input type="checkbox" checked={filters.primary} onChange={(e) => change('primary', e.target.checked)} /> Hanya lokasi utama</label><button className="text-sm text-primary-400 underline" onClick={() => { setFilters(EMPTY); setPage(0); setSelectedKey(''); }}>Reset filter</button></div>
    </div>
    {error && <div role="alert" className="card p-4 text-rose-300">Gagal memuat peta/lokasi: {error} <button className="underline" onClick={() => setVersion((n) => n + 1)}>Coba lagi</button></div>}
    {!loading && !error && backendPending && <p role="status" className="card p-4 text-sm text-ink-400">Lokasi dan foto vendor belum aktif. Data sourcing dan follow-up tetap dapat digunakan.</p>}
    {loading ? <div className="card p-8 text-ink-400" role="status">Memuat seluruh lokasi vendor…</div> : !error && <>
      <div className="flex flex-wrap gap-3 items-center"><button disabled={backendPending} className={mode === 'all' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setMode('all'); setPage(0); }}>Semua lokasi ({backendPending ? '—' : filtered.length})</button><button disabled={backendPending} className={mode === 'unmapped' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setMode('unmapped'); setPage(0); }}>Belum Dipetakan ({backendPending ? '—' : unmapped.length})</button><span className="text-sm text-ink-400">{backendPending ? 'Data lokasi belum tersedia' : `${mapped.length} titik berkoordinat`}</span></div>
      <VendorGoogleMap points={mapped} onSelect={select} height={420} />
      {selected && <div className="card p-5 grid sm:grid-cols-[180px_1fr] gap-4">
        {selected.cover_path ? <SignedVendorPhoto path={selected.cover_path} alt={`Foto ${selected.location_name}`} /> : <p className="text-ink-500">Foto belum tersedia</p>}
        <div className="space-y-2"><h2 className="text-lg font-semibold text-white">{selected.business_name}</h2><p className="text-sm text-ink-300">{selected.category_name || 'Tanpa kategori'} · {LOCATION_TYPES[selected.location_type] || 'Belum ada lokasi'} · {selected.location_name}</p><p className="text-sm text-ink-400">{[selected.address_line, selected.city, selected.province].filter(Boolean).join(', ') || 'Alamat belum lengkap'}</p><p className="text-xs text-ink-500">{QUALIFICATION_LABELS[selected.qualification_status]} · PIC {selected.pic_name || 'Belum ditugaskan'} · {VERIFICATION_LABELS[selected.verification_status] || 'Belum ada lokasi'}</p>{(selected.whatsapp || selected.phone) && <p className="text-sm text-ink-300">Kontak: {selected.whatsapp || selected.phone}</p>}
          <div className="flex flex-wrap gap-3"><Link className="text-primary-400 underline" to={`/vendor/database/${selected.candidate_id}?tab=location`}>Detail Vendor</Link>{selected.latitude !== null && selected.longitude !== null && <a className="text-primary-400 underline" href={googleMapsUrl(selected.latitude, selected.longitude)} target="_blank" rel="noopener noreferrer">Buka Google Maps</a>}</div>
        </div>
      </div>}
      {list.length === 0 ? <div className="card empty-state p-10">{backendPending ? 'Lokasi akan tampil setelah fitur diaktifkan.' : 'Tidak ada lokasi/vendor sesuai filter.'}</div> : <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="table"><thead><tr><th>Vendor / kategori</th><th>Fasilitas / kota</th><th>Koordinat</th><th>Status lokasi</th><th>Aksi</th></tr></thead><tbody>{list.slice(page * 25, (page + 1) * 25).map((row) => <tr key={`${row.candidate_id}/${row.location_id || ''}`}>
        <td><Link className="text-primary-400" to={`/vendor/database/${row.candidate_id}?tab=location`}>{row.business_name}</Link><p className="text-xs text-ink-500">{row.candidate_code} · {row.category_name || 'Tanpa kategori'}</p></td>
        <td>{row.location_name || 'Belum ada lokasi'}<p className="text-xs text-ink-500">{row.city || 'Kota belum diisi'}{row.is_primary ? ' · Utama' : ''}</p></td>
        <td>{row.latitude !== null && row.longitude !== null ? `${row.latitude}, ${row.longitude}` : <span className="badge-orange">Belum dipetakan</span>}</td>
        <td><span className={row.is_verified ? 'badge-green' : row.is_complete ? 'badge-yellow' : 'badge-orange'}>{row.is_verified ? 'Terverifikasi' : row.is_complete ? 'Perlu verifikasi' : 'Belum lengkap'}</span></td>
        <td><button className="text-primary-400 underline" onClick={() => select(row)}>Lihat panel</button></td>
      </tr>)}</tbody></table></div>
        <div className="flex flex-wrap justify-between gap-3 items-center p-4 text-sm text-ink-400"><span>{list.length} baris · Halaman {page + 1} / {Math.max(1, Math.ceil(list.length / 25))}</span><div className="flex gap-2"><button className="btn-secondary" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Sebelumnya</button><button className="btn-secondary" disabled={(page + 1) * 25 >= list.length} onClick={() => setPage((n) => n + 1)}>Berikutnya</button></div></div>
      </div>}
    </>}
    {linking && <LinkActiveVendorModal onClose={() => setLinking(false)} />}
  </div>;
}
