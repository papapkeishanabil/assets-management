import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowUpRight, Truck, MapPin, AlertTriangle, Package, CheckCircle2, Users, MessageSquare, Clock3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { VENDOR_TYPES } from '../../lib/constants';
import { fetchVendorOverview } from '../../lib/vendor-dashboard-helpers';
import { fetchSourcingDashboard, remindOverdueFollowups } from '../../lib/vendor-followup-helpers';

const VendorSourcingPanel = lazy(() => import('../../components/vendor/VendorSourcingPanel'));
const number = (value) => value == null ? '—' : value.toLocaleString('id-ID');
const vendorType = (type) => VENDOR_TYPES[type] || (type === 'BELUM_DIISI' ? 'Belum diisi' : type);

const METRIC_COLORS = {
  blue: { orb: 'bg-primary-500/15', icon: 'bg-primary-500/10 border-primary-500/20 text-primary-400', badge: 'bg-primary-500/10 text-primary-400', bar: 'bg-primary-400' },
  green: { orb: 'bg-success-500/15', icon: 'bg-success-500/10 border-success-500/20 text-success-400', badge: 'bg-success-500/10 text-success-400', bar: 'bg-success-500' },
  rose: { orb: 'bg-rose-500/15', icon: 'bg-rose-500/10 border-rose-500/20 text-rose-400', badge: 'bg-rose-500/10 text-rose-400', bar: 'bg-rose-400' },
  amber: { orb: 'bg-amber-500/15', icon: 'bg-amber-500/10 border-amber-500/20 text-amber-400', badge: 'bg-amber-500/10 text-amber-400', bar: 'bg-amber-400' }
};

function Metric({ label, value, hint, icon: Icon, color = 'blue', badge, progress, distribution }) {
  const colors = METRIC_COLORS[color];
  const maxCount = Math.max(1, ...(distribution || []).map((row) => row.count));
  // The existing tint/orb gives the source card's appearance without a backdrop
  // compositor layer, which can leave newly scrolled cards blank on mobile Chromium.
  return <article aria-label={label} className="glass glass-hover spotlight rounded-xl p-5 relative overflow-hidden min-w-0 min-h-[202px]" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
    <div aria-hidden="true" className={`orb w-32 h-32 top-0 right-0 ${colors.orb}`} />
    <div className="relative">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${colors.icon}`}><Icon size={16} aria-hidden="true" /></span>
        {badge && value != null && <span className={`text-[10px] font-mono font-medium rounded px-1.5 py-0.5 ${colors.badge}`}>{badge}</span>}
      </div>
      <h2 className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-1">{label}</h2>
      <p className="text-3xl font-semibold text-white tabular-nums tracking-tight">{number(value)}</p>
      <p className="text-xs text-ink-500 mt-1 font-mono leading-relaxed">{hint}</p>
      {progress != null && <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-3" role="progressbar" aria-label={`Persentase ${label.toLowerCase()}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${colors.bar} transition-[width] duration-700 motion-reduce:transition-none`} style={{ width: `${progress}%` }} />
      </div>}
      {distribution?.length > 0 && <div className="flex items-end gap-1 mt-3 h-6" role="img" aria-label={`Komposisi ${distribution.length} jenis vendor aktif; bukan tren waktu`}>
        {distribution.map(({ type, count }) => <span key={type} title={`${vendorType(type)}: ${number(count)} vendor`} className="w-1.5 rounded-sm bg-primary-400/80" style={{ height: `${count / maxCount * 100}%` }} />)}
      </div>}
    </div>
  </article>;
}

function SummaryItem({ label, value, hint, icon: Icon, overdue = false }) {
  return <article aria-label={label} className="glass glass-hover rounded-xl p-5 flex items-center gap-3 min-w-0">
    <span className={`p-2 rounded-lg bg-white/5 ${overdue ? 'text-danger-400' : 'text-ink-300'}`}><Icon size={20} aria-hidden="true" /></span>
    <div className="flex-1 min-w-0"><h3 className="text-sm text-white">{label}</h3><p className="text-xs text-ink-400 mt-1">{hint}</p></div>
    <p className={`text-2xl font-semibold tabular-nums ${overdue && value > 0 ? 'text-danger-400' : 'text-white'}`}>{number(value)}</p>
  </article>;
}

export default function VendorDashboardPage() {
  const { role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const allowed = !permissionsLoading && hasAccess('vendor_management') && ['sourcing', 'hrd', 'direksi', 'super_admin'].includes(role?.role_name);
  const canFollowups = hasAccess('vendor_followups'), canMap = hasAccess('vendor_map'), canAssets = hasAccess('assets');
  const canActiveVendors = hasAccess('vendors') && ['super_admin', 'hrd'].includes(role?.role_name);
  const canRemind = allowed && canFollowups && VENDOR_WRITE_ROLES.includes(role?.role_name);
  const [tab, setTab] = useState('overview'), [version, setVersion] = useState(0);
  const [overview, setOverview] = useState(null), [sourcing, setSourcing] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [sourceError, setSourceError] = useState('');
  const [reminderError, setReminderError] = useState(''), [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let ignore = false;
    setLoading(true); setError(''); setSourceError(''); setOverview(null); setSourcing(null);
    Promise.allSettled([fetchVendorOverview({ canMap, canAssets }), fetchSourcingDashboard()]).then(([operational, pipeline]) => {
      if (ignore) return;
      if (operational.status === 'fulfilled') setOverview(operational.value);
      else setError(`Gagal memuat ringkasan vendor: ${operational.reason.message}`);
      if (pipeline.status === 'fulfilled') setSourcing(pipeline.value);
      else setSourceError(`Ringkasan follow-up belum tersedia: ${pipeline.reason.message}`);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [allowed, canMap, canAssets, version]);

  useEffect(() => {
    if (!canRemind) return;
    let ignore = false;
    setReminderError('');
    remindOverdueFollowups().catch((err) => { if (!ignore) setReminderError(`Pengingat belum terkirim: ${err.message}`); });
    return () => { ignore = true; };
  }, [canRemind, version]);

  if (permissionsLoading) return <p role="status" className="text-ink-400">Memuat akses…</p>;
  if (!allowed) return <p className="text-ink-400">Akses dashboard vendor ditolak.</p>;
  const summary = overview?.summary, mapReady = overview?.mapStatus === 'ready';
  const attention = summary?.attention || [], rows = showAll ? attention : attention.slice(0, 5);
  const retry = () => setVersion((n) => n + 1);
  return <div className="space-y-6 animate-fade-in min-w-0">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex flex-wrap items-center gap-2 mb-1.5"><span className="text-xs font-mono font-medium tracking-wider uppercase text-primary-400">Manajemen Vendor</span><span className="text-ink-600" aria-hidden="true">·</span><span className="text-xs text-ink-400 font-mono">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).toUpperCase()}</span></div><h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Dashboard <span className="text-primary-500">Vendor</span></h1><p className="text-sm text-ink-400 mt-1">Overview mitra aktif, lokasi dan aset perusahaan di vendor.</p></div>
      <div className="flex flex-wrap gap-2">
        {canMap && <Link className="btn-secondary" to="/vendor/map"><MapPin size={15} /> Peta Vendor</Link>}
        {canActiveVendors && <Link className="btn-primary" to="/vendors"><Truck size={15} /> Vendor Aktif <ArrowUpRight size={14} /></Link>}
        <button className="btn-secondary" disabled={loading} onClick={retry}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
      <div className="flex gap-5" role="tablist" aria-label="Tampilan dashboard vendor">
        {[['overview', 'Ringkasan operasional'], ['sourcing', 'Sourcing']].map(([key, label]) => <button key={key} id={`vendor-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`vendor-panel-${key}`} tabIndex={tab === key ? 0 : -1}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'sourcing' : key === 'overview' ? 'sourcing' : 'overview';
            setTab(next); document.getElementById(`vendor-tab-${next}`)?.focus();
          }}
          className={`pb-3 text-sm border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${tab === key ? 'text-white border-primary-400 font-medium' : 'text-ink-400 border-transparent hover:text-white'}`} onClick={() => setTab(key)}>{label}</button>)}
      </div><p className="text-xs text-ink-500 pb-3">{tab === 'overview' ? 'Seluruh vendor aktif · tanpa filter sourcing' : 'Profil kandidat dan aktivitas sourcing'}</p>
    </div>
    {reminderError && <p role="alert" className="card p-4 text-sm text-warning-400">{reminderError}</p>}
    {tab === 'overview' ? <section role="tabpanel" id="vendor-panel-overview" aria-labelledby="vendor-tab-overview" className="space-y-6">
      {loading ? <div role="status" className="card p-8 text-ink-400">Memuat ringkasan vendor aktif…</div> : <>
        {(error || overview?.masterError) && <div role="alert" className="card p-4 text-sm text-danger-400">{error || `Data vendor aktif belum tersedia: ${overview.masterError}`} <button className="underline" onClick={retry}>Coba lagi</button></div>}
        {overview?.mapStatus === 'pending' && <p role="status" className="card p-4 text-sm text-ink-400">Lokasi dan foto vendor belum aktif. Total vendor aktif tetap tersedia.</p>}
        {overview?.mapError && <p role="alert" className="card p-4 text-sm text-warning-400">Data lokasi gagal dimuat: {overview.mapError} <button onClick={retry} className="underline">Coba lagi</button></p>}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Metric label="Vendor aktif" value={summary?.active} hint="Mitra operasional terdaftar" icon={Truck} color="blue" badge={summary && `${summary.distribution.length} JENIS`} distribution={summary?.distribution} />
          <Metric label="Sudah dipetakan" value={summary?.mapped} hint={!canMap ? 'Memerlukan akses Peta Vendor' : mapReady && summary ? `${summary.coverage}% dari vendor aktif` : 'Data lokasi belum tersedia'} icon={MapPin} color="green" badge="GPS" progress={summary?.mapped == null ? null : summary.coverage} />
          <Metric label="Lokasi belum lengkap" value={summary?.incomplete} hint={!canMap ? 'Memerlukan akses Peta Vendor' : mapReady ? 'Alamat, GPS atau foto belum lengkap' : 'Data lokasi belum tersedia'} icon={AlertTriangle} color="rose" badge={summary?.incomplete > 0 ? 'LENGKAPI DATA' : 'LENGKAP'} />
          <Metric label="Aset di vendor aktif" value={overview?.assetCount} hint={!canAssets ? 'Memerlukan akses Daftar Aset' : overview?.assetError ? 'Data aset gagal dimuat' : 'Aset yang terhubung ke mitra aktif'} icon={Package} color="amber" badge="TERHUBUNG" />
        </div>
        {overview?.assetError && <p role="alert" className="text-sm text-warning-400">Jumlah aset belum tersedia: {overview.assetError} <button onClick={retry} className="underline">Coba lagi</button></p>}
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="card p-5 md:p-6 min-w-0" aria-label="Cakupan lokasi vendor">
            <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-base font-semibold text-white">Cakupan lokasi vendor</h2><p className="text-xs text-ink-400 mt-1">Satu vendor dihitung sekali, meskipun memiliki banyak fasilitas.</p></div>{canMap && <Link to="/vendor/map" className="text-xs text-primary-400 inline-flex items-center gap-1">Buka peta <ArrowUpRight size={13} /></Link>}</div>
            <div className="flex flex-col sm:flex-row items-center gap-6 my-6">
              <div className="relative w-36 h-36 shrink-0" role="img" aria-label={summary?.mapped == null ? 'Cakupan GPS belum tersedia' : `${summary.coverage}% vendor aktif memiliki GPS`}>
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true"><circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth="9" className="text-white/10" /><circle cx="60" cy="60" r="49" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${summary?.coverage || 0} 100`} className="text-primary-400" /></svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold text-white tabular-nums">{summary?.mapped == null ? '—' : `${summary.coverage}%`}</span><span className="text-xs text-ink-400 mt-1">cakupan GPS</span></div>
              </div>
              <dl className="flex-1 w-full space-y-4 text-sm">
                {[['Memiliki koordinat', summary?.mapped, 'bg-primary-400'], ['Belum ada GPS', summary?.unmapped, 'bg-ink-500'], ['Titik fasilitas ber-GPS', summary?.facilities, 'bg-success-400']].map(([label, value, color]) => <div className="flex items-center justify-between gap-3" key={label}><dt className="text-ink-300 flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />{label}</dt><dd className="font-medium text-white tabular-nums">{number(value)} {label.startsWith('Titik') ? 'titik' : 'vendor'}</dd></div>)}
              </dl>
            </div>
            <p className="flex gap-2 items-center text-xs text-ink-400 border-t border-white/5 pt-4"><CheckCircle2 size={14} className="text-success-400 shrink-0" />{number(summary?.verified)} vendor dengan lokasi utama lengkap dan terverifikasi</p>
            {!canMap && <p className="text-xs text-ink-400 mt-3">Rincian lokasi mengikuti hak akses Peta Vendor.</p>}
          </section>
          <section className="card p-5 md:p-6 min-w-0" aria-label="Sebaran jenis vendor">
            <h2 className="text-base font-semibold text-white">Sebaran jenis vendor</h2><p className="text-xs text-ink-400 mt-1 mb-6">Komposisi {number(summary?.active)} mitra operasional yang aktif.</p>
            {!summary ? <p className="text-sm text-ink-400">Data vendor belum tersedia.</p> : summary.active === 0 ? <p className="empty-state py-6">Belum ada vendor aktif.</p> : <div className="space-y-4">{summary.distribution.map(({ type, count }) => <div key={type}>
              <div className="flex justify-between gap-3 mb-2 text-xs"><span className="text-ink-300">{vendorType(type)}</span><span className="text-white tabular-nums">{number(count)} vendor</span></div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-primary-500" style={{ width: `${count / summary.active * 100}%` }} /></div>
            </div>)}</div>}
          </section>
        </div>
        <section className="card overflow-hidden" aria-label="Vendor aktif yang perlu perhatian">
          <div className="p-5 md:p-6 flex flex-wrap justify-between items-center gap-3"><div><h2 className="text-base font-semibold text-white">Vendor aktif yang perlu perhatian</h2><p className="text-xs text-ink-400 mt-1">Lengkapi lokasi dan dokumentasi, lalu lakukan verifikasi.</p></div>{mapReady && summary && <span className="badge-orange">{number(attention.length)} vendor</span>}</div>
          {!mapReady || !summary ? <p className="p-6 text-sm text-ink-400">{!canMap ? 'Rincian ini memerlukan akses modul Peta Vendor.' : 'Daftar menunggu data lokasi dan vendor tersedia.'}</p> : attention.length === 0 ? <p className="empty-state px-6 py-10">{summary.active === 0 ? 'Belum ada vendor aktif untuk dipantau.' : 'Seluruh vendor aktif memiliki lokasi utama lengkap dan terverifikasi.'}</p> : <>
            <div className="overflow-x-auto"><table className="table"><thead><tr><th>Vendor</th><th>Jenis</th><th>Wilayah master</th><th>Status lokasi</th><th>Tindakan</th></tr></thead><tbody>{rows.map((v) => <tr key={v.id}><td className="min-w-[180px]"><p className="font-medium text-white">{v.vendor_name}</p><p className="text-xs text-ink-500 mt-1 font-mono">{v.vendor_code}</p></td><td>{vendorType(v.vendor_type || 'BELUM_DIISI')}</td><td>{v.city || 'Belum diisi'}</td><td><span className={v.reason === 'Perlu verifikasi' ? 'badge-blue' : 'badge-orange'}>{v.reason}</span></td><td>{v.candidate_id ? <Link className="text-primary-400 text-xs whitespace-nowrap inline-flex items-center gap-1" to={`/vendor/database/${v.candidate_id}?tab=location`}>Periksa lokasi <ArrowUpRight size={13} /></Link> : canActiveVendors ? <Link className="text-primary-400 text-xs whitespace-nowrap" to="/vendors">Isi melalui Vendor Aktif →</Link> : <span className="text-xs text-ink-400">Minta Admin/HRD menghubungkan profil</span>}</td></tr>)}</tbody></table></div>
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5"><p className="text-xs text-ink-500">Menampilkan {rows.length} dari {attention.length} vendor</p>{attention.length > 5 && <button className="text-xs text-primary-400" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Tampilkan lebih sedikit' : 'Lihat semua'}</button>}</div>
          </>}
        </section>
        <section aria-label="Ringkasan sourcing dan follow-up" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-white">Sourcing dan Follow-Up</h2><p className="text-xs text-ink-400 mt-1">Calon Vendor menyimpan profil dan tahap kualifikasi. Follow-Up mencatat komunikasi serta tugas tindak lanjut.</p></div><div className="flex flex-wrap gap-2"><Link className="btn-secondary text-xs" to="/vendor/database">Calon Vendor <ArrowUpRight size={13} /></Link>{canFollowups && <Link className="btn-secondary text-xs" to="/vendor/followups">Follow-Up <ArrowUpRight size={13} /></Link>}</div></div>
          {(sourceError || overview?.candidateError) && <p role="alert" className="text-sm text-warning-400">{sourceError || `Jumlah calon vendor belum tersedia: ${overview.candidateError}`} <button onClick={retry} className="underline">Coba lagi</button></p>}
          <div className="grid md:grid-cols-3 gap-4"><SummaryItem label="Calon vendor" value={overview?.candidates} hint="Profil belum terhubung ke master vendor" icon={Users} /><SummaryItem label="Tugas follow-up terbuka" value={sourcing?.kpis.open_tasks} hint="Seluruh profil sourcing, termasuk vendor terhubung" icon={MessageSquare} /><SummaryItem label="Tugas terlambat" value={sourcing?.kpis.overdue} hint="Tugas terbuka melewati tenggat" icon={Clock3} overdue /></div>
          <button className="text-xs text-primary-400 inline-flex items-center gap-1" onClick={() => setTab('sourcing')}>Lihat tahap proses dan produktivitas PIC <ArrowUpRight size={13} /></button>
        </section>
      </>}
    </section> : <section role="tabpanel" id="vendor-panel-sourcing" aria-labelledby="vendor-tab-sourcing"><Suspense fallback={<p role="status" className="text-ink-400">Memuat detail sourcing…</p>}><VendorSourcingPanel canMap={canMap} canFollowups={canFollowups} version={version} /></Suspense></section>}
    <p className="text-xs text-ink-500 leading-relaxed">Vendor, fasilitas dan aktivitas dihitung terpisah. Indikator sampel/QC pada tab Sourcing memakai tahap proses sampai Fase 4 tersedia. Pengingat diperiksa saat monitoring dibuka atau di-refresh, belum berjalan terjadwal; satu kejadian keterlambatan dikirim sekali ke PIC.</p>
  </div>;
}
