import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { FOLLOWUP_CHANNELS, FOLLOWUP_OUTCOMES } from '../../lib/vendor-constants';
import { saveFollowup, toJakartaInput } from '../../lib/vendor-followup-helpers';

export default function FollowUpModal({ candidateId = '', candidates, users, currentUserId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    candidate_id: candidateId, contact_at: toJakartaInput(), internal_pic_id: currentUserId || '',
    channel: 'WHATSAPP', contact_outcome: '', contact_result: '', new_info: '', next_action: '', next_action_due: '', attachment_path: '', notes: ''
  }));
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const change = (event) => setForm((old) => ({ ...old, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (!form.contact_result.trim()) return toast.error('Hasil komunikasi wajib diisi');
    if (form.next_action_due && !form.next_action.trim()) return toast.error('Isi aksi berikutnya untuk deadline ini');
    savingRef.current = true;
    setSaving(true);
    try {
      await saveFollowup(form);
      toast.success('Follow-up tercatat');
      onSaved();
    } catch (error) {
      toast.error(`Gagal mencatat: ${error.message}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <dialog ref={dialogRef} aria-labelledby="followup-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-ink-900 text-white border border-white/10 p-0 backdrop:bg-black/70">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="flex justify-between items-center"><h2 id="followup-title" className="text-lg font-semibold">Catat Follow-Up</h2>
          <button type="button" aria-label="Tutup" disabled={saving} onClick={onClose} className="btn-ghost"><X size={18} /></button></div>
        <p className="text-xs text-ink-400">Catatan tersimpan permanen. Gunakan catatan baru untuk koreksi informasi.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2"><span className="label">Calon vendor *</span><select name="candidate_id" className="input" value={form.candidate_id} onChange={change} required disabled={Boolean(candidateId)}>
            <option value="">Pilih calon vendor</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.candidate_code} · {c.business_name}</option>)}
          </select></label>
          <label><span className="label">Tanggal kontak (WIB) *</span><input className="input" type="datetime-local" name="contact_at" value={form.contact_at} onChange={change} required /></label>
          <label><span className="label">PIC internal *</span><select className="input" name="internal_pic_id" value={form.internal_pic_id} onChange={change} required>
            <option value="">Pilih PIC</option>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select></label>
          <label><span className="label">Media komunikasi *</span><select className="input" name="channel" value={form.channel} onChange={change}>
            {Object.entries(FOLLOWUP_CHANNELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label><span className="label">Deadline aksi (WIB)</span><input className="input" type="datetime-local" name="next_action_due" value={form.next_action_due} onChange={change} /></label>
          <label className="sm:col-span-2"><span className="label">Hasil keterhubungan *</span><select className="input" name="contact_outcome" value={form.contact_outcome} onChange={change} required>
            <option value="">Pilih hasil kontak</option>{Object.entries(FOLLOWUP_OUTCOMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label className="sm:col-span-2"><span className="label">Hasil komunikasi *</span><textarea className="input" rows={3} name="contact_result" value={form.contact_result} onChange={change} required /></label>
          <label className="sm:col-span-2"><span className="label">Informasi baru</span><textarea className="input" rows={2} name="new_info" value={form.new_info} onChange={change} /></label>
          <label className="sm:col-span-2"><span className="label">Aksi berikutnya</span><input className="input" name="next_action" value={form.next_action} onChange={change} /></label>
          <label className="sm:col-span-2"><span className="label">Referensi lampiran internal (opsional)</span><input className="input" name="attachment_path" value={form.attachment_path} onChange={change} placeholder="Path dokumen internal" />
            <span className="text-[11px] text-ink-500">Referensi teks; unggah file privat tersedia pada fase dokumen berikutnya.</span></label>
          <label className="sm:col-span-2"><span className="label">Catatan</span><textarea className="input" rows={2} name="notes" value={form.notes} onChange={change} /></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Batal</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Follow-Up'}</button></div>
      </form>
    </dialog>
  );
}
