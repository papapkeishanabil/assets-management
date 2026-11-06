import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { FOLLOWUP_CHANNELS, FOLLOWUP_STATUSES, FOLLOWUP_BADGES, FOLLOWUP_OUTCOMES, VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { closeFollowup, fetchFollowups, fetchFollowupOptions, formatFollowupTime, isFollowupOverdue, remindOverdueFollowups } from '../../lib/vendor-followup-helpers';
import FollowUpModal from './FollowUpModal';

export default function VendorFollowupsPanel({ candidateId = '', initialCandidate = '', initialOverdue = false, onChanged }) {
  const { profile, role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const allowed = hasAccess('vendor_followups') && ['sourcing', 'hrd', 'super_admin', 'direksi'].includes(role?.role_name);
  const canWrite = allowed && VENDOR_WRITE_ROLES.includes(role?.role_name);
  const [options, setOptions] = useState(null);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState({ candidate: initialCandidate, pic: '', status: '', overdue: initialOverdue });
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!allowed) return;
    let ignore = false;
    setLoading(true);
    setError('');
    Promise.all([
      fetchFollowups({ candidateId: candidateId || filters.candidate, picId: filters.pic, status: filters.status, overdue: filters.overdue, page }),
      fetchFollowupOptions()
    ]).then(([list, opts]) => {
      if (!ignore) { setRows(list.rows); setCount(list.count); setOptions(opts); }
    }).catch((err) => {
      if (!ignore) setError(`Gagal memuat follow-up: ${err.message}`);
    }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [allowed, candidateId, filters.candidate, filters.pic, filters.status, filters.overdue, page, version]);

  const reminder = useCallback(async (silent = false) => {
    if (!canWrite) return;
    if (!silent) setBusy('reminder');
    try {
      const created = await remindOverdueFollowups();
      if (!silent) toast.success(`${created} pengingat baru dikirim ke PIC`);
    } catch (err) {
      if (silent) setError(`Daftar dapat dipakai, tetapi pengingat gagal: ${err.message}`);
      else toast.error(`Pengingat gagal: ${err.message}`);
    } finally { if (!silent) setBusy(''); }
  }, [canWrite]);
  useEffect(() => { if (canWrite) reminder(true); }, [canWrite, reminder]);

  const changeFilter = (key, value) => { setFilters((old) => ({ ...old, [key]: value })); setPage(0); };
  const changed = () => { setVersion((n) => n + 1); onChanged?.(); };
  const closeTask = async (row, status) => {
    if (!canWrite || busy) return;
    if (!window.confirm(`${status === 'SELESAI' ? 'Selesaikan' : 'Batalkan'} tugas ${row.followup_code}? Penutupan dicatat permanen.`)) return;
    setBusy(row.id);
    try {
      await closeFollowup(row.id, status);
      toast.success('Status tugas diperbarui');
      changed();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(''); }
  };

  if (permissionsLoading) return <p role="status" className="text-ink-400">Memuat akses…</p>;
  if (!allowed) return <div className="card p-5 text-ink-400">Anda tidak memiliki akses modul Follow-Up Vendor.</div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-400">Riwayat komunikasi permanen · waktu dalam WIB</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" aria-label="Muat ulang follow-up" disabled={loading} onClick={() => { changed(); if (canWrite) reminder(true); }}><RefreshCw size={14} /> Refresh</button>
          {canWrite && <button className="btn-secondary" disabled={Boolean(busy)} onClick={() => reminder()}><BellRing size={14} /> Ingatkan PIC</button>}
          {canWrite && <button className="btn-primary" disabled={!options} onClick={() => setShowForm(true)}><Plus size={14} /> Catat Follow-Up</button>}
        </div>
      </div>
      <div className="card p-4 flex flex-wrap items-end gap-3">
        {!candidateId && <label className="flex-1 min-w-[180px]"><span className="label">Calon vendor</span><select className="input" value={filters.candidate} onChange={(e) => changeFilter('candidate', e.target.value)}>
          <option value="">Semua vendor</option>{options?.candidates.map((c) => <option key={c.id} value={c.id}>{c.candidate_code} · {c.business_name}</option>)}
        </select></label>}
        <label className="flex-1 min-w-[140px]"><span className="label">PIC internal</span><select className="input" value={filters.pic} onChange={(e) => changeFilter('pic', e.target.value)}>
          <option value="">Semua PIC</option>{options?.users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select></label>
        <label className="flex-1 min-w-[140px]"><span className="label">Status tugas</span><select className="input" disabled={filters.overdue} value={filters.overdue ? 'OPEN' : filters.status} onChange={(e) => changeFilter('status', e.target.value)}>
          <option value="">Semua status</option>{Object.entries(FOLLOWUP_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label className="flex items-center gap-2 text-sm text-ink-300 py-2"><input type="checkbox" checked={filters.overdue} onChange={(e) => changeFilter('overdue', e.target.checked)} /> Hanya overdue</label>
      </div>
      {error && <div role="alert" className="card p-4 text-rose-300">{error} <button className="underline" onClick={changed}>Coba lagi</button></div>}
      {loading ? <div role="status" className="card p-8 text-ink-400">Memuat follow-up…</div> : !error && rows.length === 0 ? (
        <div className="card empty-state p-10">Belum ada follow-up sesuai filter.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => <article key={row.id} className="card p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-mono text-xs text-primary-400">{row.followup_code} · {formatFollowupTime(row.contact_at)}</p>
                <Link className="font-semibold text-white hover:text-primary-400" to={`/vendor/database/${row.candidate_id}`}>{row.candidate?.business_name || row.candidate_id}</Link>
                <p className="text-xs text-ink-400">{row.internal_pic?.full_name || 'PIC tidak tersedia'} · {FOLLOWUP_CHANNELS[row.channel]} · {FOLLOWUP_OUTCOMES[row.contact_outcome] || 'Belum dinilai'}</p></div>
              <div className="flex gap-2"><span className={FOLLOWUP_BADGES[row.task_status]}>{FOLLOWUP_STATUSES[row.task_status]}</span>{isFollowupOverdue(row) && <span className="badge-red">Overdue</span>}</div>
            </div>
            <p className="text-sm text-white whitespace-pre-wrap break-words">{row.contact_result}</p>
            {row.new_info && <p className="text-sm text-ink-300 whitespace-pre-wrap break-words"><span className="font-medium">Informasi baru: </span>{row.new_info}</p>}
            <div className="rounded-lg bg-white/5 p-3 text-sm"><p className="text-ink-200 break-words">Aksi berikutnya: {row.next_action || 'Belum ditentukan'}</p><p className={isFollowupOverdue(row) ? 'text-rose-300' : 'text-ink-400'}>Deadline: {formatFollowupTime(row.next_action_due)}</p></div>
            {row.notes && <p className="text-xs text-ink-400 whitespace-pre-wrap break-words">Catatan: {row.notes}</p>}
            {row.attachment_path && <p className="text-xs text-ink-400 break-all">Referensi lampiran: {row.attachment_path}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-ink-500">Dicatat {row.creator?.full_name || 'Sistem'} · {formatFollowupTime(row.created_at)}{row.completed_at && ` · Selesai ${formatFollowupTime(row.completed_at)}`}</p>
              {canWrite && row.task_status === 'OPEN' && <div className="flex gap-2"><button className="btn-secondary text-xs" disabled={Boolean(busy)} onClick={() => closeTask(row, 'DIBATALKAN')}>Batalkan tugas</button><button className="btn-primary text-xs" disabled={Boolean(busy)} onClick={() => closeTask(row, 'SELESAI')}>Selesaikan</button></div>}
            </div>
          </article>)}
          <div className="flex flex-wrap justify-between items-center gap-3 text-sm text-ink-400"><span>{count} catatan · Halaman {page + 1} / {Math.max(1, Math.ceil(count / 25))}</span><div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((n) => n - 1)}>Sebelumnya</button><button className="btn-secondary" disabled={(page + 1) * 25 >= count} onClick={() => setPage((n) => n + 1)}>Berikutnya</button>
          </div></div>
        </div>
      )}
      {showForm && options && <FollowUpModal candidateId={candidateId} candidates={options.candidates} users={options.users} currentUserId={profile?.id}
        onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); changed(); if (canWrite) reminder(true); }} />}
    </div>
  );
}
