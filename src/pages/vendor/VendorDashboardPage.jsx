import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { PROCESS_STAGE_LABELS, PROCESS_STAGE_BADGES, VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { fetchFollowupOptions, fetchSourcingDashboard, formatFollowupTime, remindOverdueFollowups } from '../../lib/vendor-followup-helpers';
import { fetchLocationMonitoring } from '../../lib/vendor-location-helpers';

const METRICS = [
  ['total', 'Total kandidat unik', 'Satu kandidat dihitung sekali'], ['new_leads', 'Lead baru', 'Tahap Lead Masuk'],
  ['vendors_attempted', 'Vendor dengan upaya kontak', 'Kandidat unik dengan minimal satu aktivitas'],
  ['vendors_contacted', 'Vendor berhasil dihubungi', 'Kandidat unik dengan hasil berhasil terhubung'],
  ['followup_activities', 'Aktivitas follow-up', 'Jumlah catatan komunikasi, termasuk upaya belum terhubung'],
  ['open_tasks', 'Tugas terbuka', 'Jumlah tugas berstatus terbuka'],
  ['completed_tasks', 'Tugas selesai', 'Jumlah tugas berstatus selesai'],
  ['cancelled_tasks', 'Tugas dibatalkan', 'Jumlah tugas berstatus dibatalkan'],
  ['needs_followup', 'Perlu follow-up', 'Kandidat aktif tanpa log atau dengan tugas terbuka'],
  ['overdue', 'Tugas overdue', 'Tugas terbuka melewati deadline'],
  ['location_incomplete', 'Lokasi belum lengkap', 'Kandidat tanpa lokasi utama, alamat, GPS atau foto tampak luar'],
  ['samples_running', 'Sampel berjalan', 'Kandidat pada tahap sampel/revisi'],
  ['awaiting_qc', 'Menunggu / proses QC', 'Kandidat pada tahap sampel diterima/QC'],
  ['awaiting_approval', 'Menunggu approval', 'Tahap keputusan atau status pending approval'],
  ['approved', 'Disetujui', 'Status kelayakan APPROVED']
];

export default function VendorDashboardPage() {
  const { role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const allowed = hasAccess('vendor_management') && ['sourcing', 'hrd', 'direksi', 'super_admin'].includes(role?.role_name);
  const canFollowups = hasAccess('vendor_followups');
  const canMap = hasAccess('vendor_map');
  const canRemind = allowed && canFollowups && VENDOR_WRITE_ROLES.includes(role?.role_name);
  const [options, setOptions] = useState({ categories: [], users: [] });
  const [category, setCategory] = useState('');
  const [pic, setPic] = useState('');
  const [version, setVersion] = useState(0);
  const [data, setData] = useState(null), [locations, setLocations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reminderError, setReminderError] = useState('');

  useEffect(() => {
    if (!allowed) return;
    let ignore = false;
    setLoading(true); setError('');
    Promise.all([fetchSourcingDashboard(category, pic), fetchFollowupOptions(), canMap ? fetchLocationMonitoring(category, pic) : Promise.resolve(null)]).then(([dashboard, opts, locationData]) => {
      if (!ignore) { setData({ ...dashboard, kpis: { ...dashboard.kpis, location_incomplete: locationData?.incomplete ?? null } }); setLocations(locationData); setOptions(opts); }
    }).catch((err) => { if (!ignore) setError(`Gagal memuat dashboard: ${err.message}`); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [allowed, canMap, category, pic, version]);

  useEffect(() => {
    if (!canRemind) return;
    let ignore = false;
    setReminderError('');
    remindOverdueFollowups().catch((err) => { if (!ignore) setReminderError(`Pengingat belum terkirim: ${err.message}`); });
    return () => { ignore = true; };
  }, [canRemind, version]);

  if (permissionsLoading) return <p role="status" className="text-ink-400">Memuat akses…</p>;
  if (!allowed) return <p className="text-ink-400">Akses dashboard vendor ditolak.</p>;
  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl md:text-3xl font-semibold text-white">Dashboard Vendor</h1><p className="text-sm text-ink-400 mt-1">Monitoring sourcing dan prioritas tindak lanjut</p></div>
      <div className="flex gap-2"><button className="btn-secondary" disabled={loading} onClick={() => setVersion((n) => n + 1)}><RefreshCw size={14} /> Refresh</button><Link className="btn-primary" to="/vendor/database">Database Vendor <ArrowRight size={14} /></Link></div></div>
    <div className="card p-4 grid sm:grid-cols-2 gap-4">
      <label><span className="label">Kategori vendor</span><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Semua kategori</option>{options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label><span className="label">PIC kandidat</span><select className="input" value={pic} onChange={(e) => setPic(e.target.value)}><option value="">Semua PIC</option>{options.users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
    </div>
    {error && <div role="alert" className="card p-4 text-rose-300">{error} <button className="underline" onClick={() => setVersion((n) => n + 1)}>Coba lagi</button></div>}
    {reminderError && <p role="alert" className="text-sm text-warning-300">{reminderError}</p>}
    {!loading && !error && canMap && !locations && <p role="status" className="card p-4 text-sm text-ink-400">Lokasi dan foto vendor belum aktif. Data sourcing dan follow-up tetap dapat digunakan.</p>}
    {loading ? <div role="status" className="card p-8 text-ink-400">Memuat monitoring vendor…</div> : !error && data && <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{METRICS.map(([key, label, hint]) => <div key={key} className="card p-4">
        <p className="text-sm text-ink-300">{label}</p><p className={`text-3xl font-semibold mt-2 ${key === 'overdue' && data.kpis[key] > 0 ? 'text-rose-300' : 'text-white'}`}>{data.kpis[key] == null ? '—' : data.kpis[key]}</p><p className="text-[11px] text-ink-500 mt-1">{hint}</p>
      </div>)}</div>
      {locations && <div className="card p-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-ink-300">Lokasi: {locations.verified} terverifikasi · {locations.unverified} siap diperiksa · {locations.unmapped} vendor belum dipetakan</p><Link className="btn-secondary" to="/vendor/map">Peta Vendor →</Link></div>}
      <div className="card overflow-hidden"><div className="p-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Prioritas tindak lanjut</h2><p className="text-xs text-ink-400 mt-1">Maksimal 20 kandidat · overdue didahulukan</p></div>{canFollowups && <Link className="text-sm text-primary-400" to="/vendor/followups?overdue=1">Lihat tugas overdue →</Link>}</div>
        {data.priority.length === 0 ? <p className="empty-state p-8">Tidak ada kandidat yang memerlukan tindak lanjut.</p> : <div className="overflow-x-auto"><table className="table"><thead><tr><th>Calon vendor</th><th>PIC</th><th>Tahap</th><th>Deadline terdekat</th><th>Prioritas</th></tr></thead><tbody>
          {data.priority.map((c) => <tr key={c.id}><td><Link className="text-primary-400" to={`/vendor/database/${c.id}`}>{c.business_name}</Link><p className="text-xs text-ink-500">{c.candidate_code} · {c.category_name || 'Tanpa kategori'}</p></td><td>{c.pic_name || 'Belum ditugaskan'}</td><td><span className={PROCESS_STAGE_BADGES[c.process_stage]}>{PROCESS_STAGE_LABELS[c.process_stage]}</span></td><td>{formatFollowupTime(c.next_due)}</td><td>{c.overdue_tasks > 0 ? <span className="badge-red">{c.overdue_tasks} overdue</span> : <span className="badge-yellow">{c.total_followups === 0 ? 'Belum dihubungi' : `${c.open_tasks} tugas terbuka`}</span>}</td></tr>)}
        </tbody></table></div>}
      </div>
      <div className="card p-5"><h2 className="font-semibold text-white mb-4">Alur kualifikasi</h2><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{Object.entries(PROCESS_STAGE_LABELS).map(([key, label]) => <div key={key} className="rounded-lg bg-white/5 p-3 flex items-center justify-between gap-2"><span className="text-xs text-ink-300">{label}</span><span className={PROCESS_STAGE_BADGES[key]}>{data.stages[key] || 0}</span></div>)}</div></div>
      <div className="card overflow-hidden"><div className="p-5"><h2 className="font-semibold text-white">Produktivitas PIC Sourcing</h2>
        <p className="text-xs text-ink-400 mt-1">Aktivitas dan vendor dihitung menurut pencatat. Status tugas dihitung menurut PIC penanggung jawab. Mengikuti filter kategori dan PIC kandidat di atas, sepanjang riwayat.</p></div>
        <div className="overflow-x-auto"><table className="table"><thead><tr><th>PIC / peran</th><th>Aktivitas dicatat</th><th>Vendor unik dicoba</th><th>Vendor unik terhubung</th><th>Tugas terbuka</th><th>Terlambat</th><th>Selesai</th><th>Dibatalkan</th></tr></thead><tbody>
          {data.pic_productivity.map((p) => <tr key={p.pic_id}><td>{p.pic_name}<p className="text-xs text-ink-500">{p.role_name}</p></td><td>{p.activities_recorded}</td><td>{p.vendors_attempted}</td><td>{p.vendors_contacted}</td><td>{p.open_tasks}</td><td>{p.overdue_tasks}</td><td>{p.completed_tasks}</td><td>{p.cancelled_tasks}</td></tr>)}
        </tbody></table></div>
        <p className="text-xs text-ink-500 px-5 pb-5">Vendor yang ditangani beberapa PIC dapat muncul pada masing-masing baris PIC; jangan menjumlahkan kolom vendor per PIC sebagai total vendor unik.</p>
      </div>
      <p className="text-xs text-ink-500">Indikator sampel/QC memakai tahap kandidat sampai Fase 4. Pengingat overdue diperiksa saat halaman dibuka atau di-refresh; belum berjalan otomatis saat aplikasi tidak digunakan. Satu kejadian keterlambatan tugas dikirim sekali ke notifikasi PIC.</p>
    </>}
  </div>;
}
