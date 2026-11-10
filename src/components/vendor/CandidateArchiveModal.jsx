import { useEffect, useId, useRef, useState } from 'react';
import { Archive, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { setCandidateArchive } from '../../lib/vendor-helpers';

export default function CandidateArchiveModal({ candidate, onClose, onSaved }) {
  const dialog = useRef(null), savingRef = useRef(false);
  const reasonId = useId();
  const [reason, setReason] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const archive = !candidate.archived_at;
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close(); }, []);
  const submit = async (event) => {
    event.preventDefault(); if (savingRef.current) return;
    if (reason.trim().length < 5) { setError('Isi alasan minimal 5 karakter.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    try {
      await setCandidateArchive(candidate, archive, reason);
      toast.success(archive ? 'Kandidat dihapus dari daftar kerja dan dipindahkan ke arsip' : 'Kandidat dipulihkan. Tugas lama tetap ditutup.');
      onSaved();
    } catch (err) { setError(err.message || 'Tindakan belum tersimpan. Silakan coba lagi.'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <dialog ref={dialog} aria-labelledby="candidate-archive-title" onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-ink-900 text-white border border-white/10 p-5 backdrop:bg-black/70">
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 id="candidate-archive-title" className="text-lg font-semibold">{archive ? 'Hapus calon vendor dari daftar?' : 'Pulihkan calon vendor?'}</h2><button type="button" disabled={saving} aria-label="Tutup konfirmasi kandidat" className="btn-ghost" onClick={onClose}><X size={18} /></button></div>
      <p className="font-medium break-words">{candidate.business_name} <span className="text-ink-400 text-xs">{candidate.candidate_code}</span></p>
      <p className="text-sm text-ink-300">{archive ? 'Kandidat dipindahkan ke Arsip. Profil, lokasi, foto dan seluruh riwayat tetap disimpan. Semua tugas follow-up yang masih terbuka akan dibatalkan dan tercatat dalam riwayat.' : 'Kandidat kembali ke daftar kerja. Tugas follow-up yang sudah dibatalkan tidak dibuka ulang; catat tindak lanjut baru bila diperlukan.'}</p>
      {candidate.archive_reason && <p className="text-xs text-ink-400 whitespace-pre-wrap">Alasan arsip: {candidate.archive_reason}</p>}
      <div><label className="label" htmlFor={reasonId}>{archive ? 'Alasan penghapusan dari daftar' : 'Alasan pemulihan'}</label><textarea id={reasonId} autoFocus className="input" rows={3} minLength={5} maxLength={1000} required disabled={saving} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-danger-400">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Batal</button><button type="submit" className={archive ? 'btn-danger' : 'btn-primary'} disabled={saving}>{archive ? <Archive size={14} /> : <RotateCcw size={14} />}{saving ? 'Menyimpan…' : archive ? 'Hapus dari Daftar' : 'Pulihkan Kandidat'}</button></div>
    </form>
  </dialog>;
}
