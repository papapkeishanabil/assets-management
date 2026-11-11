import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, RefreshCw, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { PROCESS_STAGE_LABELS, QUALIFICATION_LABELS, OPERATIONAL_LABELS, VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { LOCATION_READ_ROLES, LOCATION_TYPES, VERIFICATION_LABELS, filterMapPoints } from '../../lib/vendor-location-utils';
import { fetchMapPoints, fetchMapSpecialties } from '../../lib/vendor-location-helpers';
import { fetchFollowupOptions } from '../../lib/vendor-followup-helpers';
import VendorMap from '../../components/vendor/VendorMap';
import VendorLocationNavigation from '../../components/vendor/VendorLocationNavigation';
import SignedVendorPhoto from '../../components/vendor/SignedVendorPhoto';
import LinkActiveVendorModal from '../../components/vendor/LinkActiveVendorModal';

const EMPTY = { search: '', category: '', specialty: '', stage: '', qualification: '', operational: '', pic: '', city: '', verification: '', primary: false, scope: '' };
const PAGE_STEP = 30;

// Halaman Peta Lokasi Vendor — peta sebagai fokus utama (kiri) dengan
// panel detail + daftar lokasi yang menyatu di sisi kanan. Klik daftar
// memfokuskan pin di peta; klik pin memunculkan detail di panel.
export default function VendorMapPage() {
  const { role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const [params] = useSearchParams(); const candidateId = params.get('candidate') || '';
  const allowed = hasAccess('vendor_map') && LOCATION_READ_ROLES.includes(role?.role_name);
  const [rows, setRows] = useState([]), [options, setOptions] = useState({ users: [], categories: [], specialties: [] });
  const [filters, setFilters] = useState(EMPTY), [mode, setMode] = useState('all'), [selectedKey, setSelectedKey] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP), [showMoreFilters, setShowMoreFilters] = useState(false);
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
  const change = (key, value) => {
    setFilters((old) => ({ ...old, [key]: value, ...(key === 'category' ? { specialty: '' } : {}) }));
    setPageReset(); setSelectedKey('');
  };
  const setPageReset = () => setVisibleCount(PAGE_STEP);
  useEffect(() => { setPageReset(); setSelectedKey(''); }, [candidateId]);
  const filtered = useMemo(() => filterMapPoints(candidateId ? rows.filter((r) => r.candidate_id === candidateId) : rows, filters), [rows, filters, candidateId]);
  const unmapped = useMemo(() => [...new Map(filtered.filter((r) => Number(r.mapped_count) === 0).map((r) => [r.candidate_id, r])).values()], [filtered]);
  const mapped = useMemo(() => filtered.filter((r) => r.latitude !== null && r.longitude !== null), [filtered]);
  const list = mode === 'unmapped' ? unmapped : filtered;
  const selected = filtered.find((r) => `${r.candidate_id}/${r.location_id || ''}` === selectedKey);
  // Identitas stabil agar efek "fokuskan peta" hanya berjalan saat pilihan berubah.
  const focusPoint = useMemo(() => (selected && selected.latitude !== null && selected.longitude !== null
    ? { latitude: selected.latitude, longitude: selected.longitude }
    : null), [selectedKey, filtered]);
  const cities = [...new Set(rows.map((r) => r.city).filter(Boolean))].sort();
  const select = (row) => setSelectedKey(`${row.candidate_id}/${row.location_id || ''}`);
  const activeFilters = Object.entries(filters).filter(([k, v]) => v && v !== false).length;
  const primaryFilters = [
    ['category', 'Kategori', options.categories.map((c) => [c.id, c.name])],
    ['qualification', 'Kelayakan', Object.entries(QUALIFICATION_LABELS)],
    ['verification', 'Verifikasi', Object.entries(VERIFICATION_LABELS)]
  ];
  const moreFilters = [
    ['specialty', 'Spesialisasi', options.specialties.filter((s) => !filters.category || s.category_id === filters.category).map((s) => [s.id, s.name])],
    ['stage', 'Tahap proses', Object.entries(PROCESS_STAGE_LABELS)],
    ['operational', 'Status operasional', Object.entries(OPERATIONAL_LABELS)],
    ['pic', 'PIC kandidat', options.users.map((u) => [u.id, u.full_name])],
    ['city', 'Kota', cities.map((c) => [c, c])],
    ['scope', 'Jenis vendor', [['candidate', 'Calon vendor'], ['active', 'Terhubung master aktif']]]
  ];
  const moreActive = moreFilters.filter(([k]) => filters[k]).length;

  if (permissionsLoading) return <p role="status" className="text-ink-400">Memuat akses peta…</p>;
  if (!allowed) return <p className="card p-5 text-ink-400">Akses Peta Vendor ditolak.</p>;

  return <div className="space-y-4 animate-fade-in">
    {/* Header */}
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold text-white">Peta Lokasi Vendor</h1>
        <p className="text-sm text-ink-400 mt-1">
          Setiap fasilitas berkoordinat tampil sebagai titik tersendiri
          {!loading && !error && !backendPending && <> · <span className="text-white font-medium">{mapped.length}</span> titik terpetakan dari <span className="text-white font-medium">{filtered.length}</span> baris lokasi</>}
          {candidateId && <> — <Link to="/vendor/map" className="text-primary-400 underline">lihat semua vendor</Link></>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={loading} onClick={() => setVersion((n) => n + 1)}><RefreshCw size={14} /> Refresh peta</button>
        {canWrite && <button className="btn-primary" onClick={() => setLinking(true)}><MapPin size={14} /> Lokasikan Vendor Aktif</button>}
      </div>
    </div>

    {/* Bar filter ringkas — satu baris untuk yang sering dipakai, sisanya dilipat */}
    <div className="card p-3">
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <div className="relative flex-1 min-w-[200px] group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 pointer-events-none" />
          <input className="input pl-9" placeholder="Cari nama vendor / fasilitas / kota…" value={filters.search} onChange={(e) => change('search', e.target.value)} />
        </div>
        {primaryFilters.map(([key, label, values]) => (
          <select key={key} className="input lg:w-44" value={filters[key]} onChange={(e) => change(key, e.target.value)} aria-label={`Filter ${label}`}>
            <option value="">{label}: semua</option>
            {values.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        ))}
        <button className={`btn-secondary whitespace-nowrap ${moreActive ? 'text-primary-300' : ''}`} onClick={() => setShowMoreFilters((v) => !v)} aria-expanded={showMoreFilters}>
          <SlidersHorizontal size={14} /> Filter lain{moreActive > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary-500/25 text-primary-200">{moreActive}</span>}
        </button>
        {activeFilters > 0 && <button className="text-sm text-ink-400 hover:text-white underline" onClick={() => { setFilters(EMPTY); setPageReset(); setSelectedKey(''); }}>Reset ({activeFilters})</button>}
      </div>
      {showMoreFilters && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/5">
          {moreFilters.map(([key, label, values]) => (
            <label key={key}><span className="label">{label}</span>
              <select className="input" value={filters[key]} onChange={(e) => change(key, e.target.value)}>
                <option value="">Semua</option>
                {values.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-ink-300 mt-3 w-fit cursor-pointer">
        <input type="checkbox" checked={filters.primary} onChange={(e) => change('primary', e.target.checked)} /> Hanya lokasi utama
      </label>
    </div>

    {error && <div role="alert" className="card p-4 text-rose-300">Gagal memuat peta/lokasi: {error} <button className="underline" onClick={() => setVersion((n) => n + 1)}>Coba lagi</button></div>}
    {!loading && !error && backendPending && <p role="status" className="card p-4 text-sm text-ink-400">Lokasi dan foto vendor belum aktif. Data sourcing dan follow-up tetap dapat digunakan.</p>}

    {loading ? <div className="card p-8 text-ink-400" role="status">Memuat seluruh lokasi vendor…</div> : !error && (
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.72fr)_minmax(330px,.78fr)] gap-4 items-start">
        {/* Peta — fokus utama */}
        <div className="card p-3 min-w-0">
          <VendorMap points={mapped} onSelect={select} height="clamp(360px, 62vh, 640px)" focus={focusPoint} selectedKey={selectedKey} />
        </div>

        {/* Panel kanan: detail terpilih + daftar lokasi */}
        <div className="space-y-3 min-w-0">
          {selected ? (
            <section aria-label="Detail lokasi terpilih" className="card p-4 relative">
              <button className="absolute top-3 right-3 p-1.5 text-ink-500 hover:text-white hover:bg-white/5 rounded-md" onClick={() => setSelectedKey('')} aria-label="Tutup detail"><X size={15} /></button>
              <div className="flex gap-3 pr-6">
                {selected.cover_path
                  ? <SignedVendorPhoto path={selected.cover_path} alt={`Foto ${selected.location_name}`} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                  : <div className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-ink-500 flex-shrink-0" aria-label="Foto belum tersedia"><MapPin size={20} /></div>}
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate">{selected.business_name}</h2>
                  <p className="text-xs text-ink-400 truncate mt-0.5">{selected.category_name || 'Tanpa kategori'} · {LOCATION_TYPES[selected.location_type] || 'Fasilitas belum dicatat'}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selected.qualification_status === 'APPROVED' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                      {QUALIFICATION_LABELS[selected.qualification_status]}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selected.is_verified ? 'bg-green-500/15 text-green-300' : selected.is_complete ? 'bg-amber-500/15 text-amber-300' : 'bg-orange-500/15 text-orange-300'}`}>
                      {selected.is_verified ? 'Terverifikasi' : selected.is_complete ? 'Perlu verifikasi' : 'Belum lengkap'}
                    </span>
                    {selected.is_primary && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white/10 text-ink-300">Lokasi utama</span>}
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-400 mt-3 leading-relaxed">{[selected.address_line, selected.city, selected.province].filter(Boolean).join(', ') || 'Alamat belum lengkap'}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500 mt-1.5">
                <span>PIC: {selected.pic_name || 'Belum ditugaskan'}</span>
                {(selected.whatsapp || selected.phone) && <span>Kontak: {selected.whatsapp || selected.phone}</span>}
                {selected.latitude !== null && selected.longitude !== null && <span className="font-mono">{selected.latitude}, {selected.longitude}</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                <Link className="btn-secondary btn-sm" to={`/vendor/database/${selected.candidate_id}?tab=location`}>Detail Vendor</Link>
                {selected.latitude !== null && selected.longitude !== null && <VendorLocationNavigation latitude={selected.latitude} longitude={selected.longitude} showView={false} />}
              </div>
              {selected.latitude === null && <p className="text-[11px] text-amber-300/90 mt-2">Lokasi belum berkoordinat — lengkapi lewat tab Lokasi & Foto pada detail vendor agar muncul di peta.</p>}
            </section>
          ) : (
            <p className="card p-3 text-xs text-ink-500">Klik pin di peta atau pilih baris di daftar untuk melihat detail lokasi.</p>
          )}

          {/* Daftar lokasi — terhubung langsung dengan peta */}
          <div className="card overflow-hidden">
            <div className="flex p-1 gap-1 border-b border-white/5" role="tablist" aria-label="Mode daftar">
              <button role="tab" aria-selected={mode === 'all'} className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${mode === 'all' ? 'bg-primary-500/20 text-primary-200' : 'text-ink-400 hover:text-white'}`} onClick={() => { setMode('all'); setPageReset(); }}>
                Semua lokasi <span className="text-ink-500 font-normal">({filtered.length})</span>
              </button>
              <button role="tab" aria-selected={mode === 'unmapped'} className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${mode === 'unmapped' ? 'bg-primary-500/20 text-primary-200' : 'text-ink-400 hover:text-white'}`} onClick={() => { setMode('unmapped'); setPageReset(); }}>
                Belum dipetakan <span className="text-ink-500 font-normal">({unmapped.length})</span>
              </button>
            </div>
            {list.length === 0 ? <div className="p-6 text-center text-sm text-ink-500">{backendPending ? 'Lokasi akan tampil setelah fitur diaktifkan.' : 'Tidak ada lokasi/vendor sesuai filter.'}</div> : (
              <div className="overflow-y-auto max-h-[clamp(300px,55vh,560px)] p-2 space-y-1.5">
                {list.slice(0, visibleCount).map((row) => {
                  const key = `${row.candidate_id}/${row.location_id || ''}`, active = key === selectedKey;
                  const hasCoords = row.latitude !== null && row.longitude !== null;
                  return <button key={key} onClick={() => select(row)} aria-pressed={active}
                    className={`w-full text-left p-2.5 rounded-lg border flex items-center gap-3 transition-colors ${active ? 'bg-primary-500/10 border-primary-500/40' : 'border-transparent hover:bg-white/[0.04]'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${hasCoords ? (row.qualification_status === 'APPROVED' ? 'bg-green-600' : 'bg-amber-600') : 'bg-white/20'}`} aria-hidden="true"></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm text-white font-medium truncate">{row.business_name}</span>
                        {row.is_primary && <Star size={11} className="text-primary-300 flex-shrink-0" aria-label="Lokasi utama" />}
                      </span>
                      <span className="block text-[11px] text-ink-500 truncate">{row.location_name || 'Belum ada lokasi'} · {row.city || 'Kota belum diisi'}</span>
                    </span>
                    {!hasCoords && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 flex-shrink-0">belum dipetakan</span>}
                  </button>;
                })}
                {list.length > visibleCount && (
                  <button className="w-full py-2 text-xs text-primary-400 hover:text-primary-300 underline" onClick={() => setVisibleCount((n) => n + PAGE_STEP)}>
                    Tampilkan {Math.min(PAGE_STEP, list.length - visibleCount)} lagi ({list.length - visibleCount} tersisa)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {linking && <LinkActiveVendorModal onClose={() => setLinking(false)} />}
  </div>;
}
