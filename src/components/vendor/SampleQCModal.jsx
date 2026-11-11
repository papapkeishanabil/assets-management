import { useEffect, useId, useRef, useState } from 'react';
import { QC_DECISIONS, saveSampleQC, uploadSampleEvidence } from '../../lib/vendor-sampling';
import { fromJakartaInput, toJakartaInput } from '../../lib/vendor-followup-helpers';
export default function SampleQCModal({ sample, editing, options, onClose, onSaved }) {
  const dialog = useRef(null), pending = useRef(false), prefix = useId();
  const rubric = editing?.parameter_snapshot || options.parameters.filter((p) => p.is_active && (!p.category_id || p.category_id === sample.category_id)).map((p) => ({ id: p.id, name: p.parameter_name, weight: p.weight }));
  const [form, setForm] = useState(() => ({ inspector_name: editing?.inspector_name || '', inspector_employee_id: editing?.inspector_employee_id || '', inspected_at: editing ? toJakartaInput(editing.inspected_at) : toJakartaInput(), pass_mark: editing?.pass_mark ?? '', decision: editing?.decision || '', findings: editing?.findings || '', required_fixes: editing?.required_fixes || '', revision_due: editing?.revision_due || '', notes: editing?.notes || '', reinspection_note: editing?.reinspection_note || '', edit_reason: '', parameter_scores: editing?.parameter_scores || {}, photos: editing?.photos || [], document_path: editing?.document_path || '' }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const d = dialog.current; d.showModal(); return () => d.close(); }, []);
  const change = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const average = rubric.length && rubric.every((p) => Number.isInteger(Number(form.parameter_scores[p.id])) && Number(form.parameter_scores[p.id]) >= 1 && Number(form.parameter_scores[p.id]) <= 5) ? (rubric.reduce((s, p) => s + Number(form.parameter_scores[p.id]) * Number(p.weight), 0) / rubric.reduce((s, p) => s + Number(p.weight), 0)).toFixed(2) : null;
  const field = (name, label, type = 'text', props = {}) => <div key={name}><label className="label" htmlFor={prefix + name}>{label}</label><input id={prefix + name} name={name} type={type} className="input" value={form[name]} disabled={busy || (name === 'inspector_name' && Boolean(form.inspector_employee_id))} onChange={change} {...props} /></div>;
  const text = (name, label, required = false) => <div><label className="label" htmlFor={prefix + name}>{label}</label><textarea id={prefix + name} name={name} className="input" rows={2} maxLength={10000} value={form[name]} onChange={change} disabled={busy} required={required} minLength={required ? 5 : undefined} /></div>;
  const attach = async (e, photo) => {
    const file = e.target.files?.[0]; if (!file || pending.current) return;
    if (photo && !file.type.startsWith('image/')) { setError('Pilih foto JPG, PNG atau WebP'); return; }
    pending.current = true; setBusy(true); setError('');
    try { const path = await uploadSampleEvidence(sample, file); setForm((s) => photo ? { ...s, photos: [...s.photos, { path, caption: file.name.slice(0, 200) }] } : { ...s, document_path: path }); }
    catch (err) { setError(err.message); } finally { pending.current = false; setBusy(false); e.target.value = ''; }
  };
  const submit = async (e) => {
    e.preventDefault(); if (pending.current) return; setError('');
    if (form.decision === 'LULUS' && Number(average) < Number(form.pass_mark)) { setError('Nilai di bawah batas lulus tidak dapat dinyatakan Lulus'); return; }
    pending.current = true; setBusy(true);
    try { await saveSampleQC(sample.id, { ...form, inspector_employee_id: form.inspector_employee_id || null, inspected_at: fromJakartaInput(form.inspected_at), parameter_scores: Object.fromEntries(Object.entries(form.parameter_scores).map(([id, score]) => [id, Number(score)])), pass_mark: Number(form.pass_mark), document_path: form.document_path || null }, editing); onSaved(); }
    catch (err) { setError(err.message); } finally { pending.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby={prefix + 'title'} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-ink-900 text-white p-5 backdrop:bg-black/70"><form onSubmit={submit} className="space-y-4">
    <h2 id={prefix + 'title'} className="text-lg font-semibold">{editing ? `Koreksi QC putaran ${editing.run_no}` : 'Catat Hasil QC'}</h2><p className="text-xs text-ink-400">{sample.sample_code} · Hasil dicatat atas nama petugas pemeriksa. Lulus QC tetap memerlukan persetujuan manajemen.</p>
    <div className="grid sm:grid-cols-2 gap-4">
      <div><label className="label" htmlFor={prefix + 'employee'}>Pemeriksa dari data karyawan (opsional)</label><select id={prefix + 'employee'} className="input" disabled={busy} value={form.inspector_employee_id} onChange={(e) => { const emp = options.employees.find((x) => x.id === e.target.value); setForm((s) => ({ ...s, inspector_employee_id: e.target.value, inspector_name: emp?.full_name || s.inspector_name })); }}><option value="">Isi nama pemeriksa secara manual</option>{options.employees.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
      {field('inspector_name', 'Nama pemeriksa QC *', 'text', { required: true, minLength: 2, maxLength: 200 })}{field('inspected_at', 'Waktu pemeriksaan (WIB) *', 'datetime-local', { required: true })}
      {field('pass_mark', 'Batas nilai lulus (1–5) *', 'number', { required: true, min: 1, max: 5, step: 0.01 })}
    </div>
    <div className="card p-4 space-y-3"><h3 className="font-semibold text-sm">Rubrik penilaian · skor 1–5</h3><p className="text-xs text-ink-400">Batas lulus diisi sesuai ketentuan evaluasi. Server menghitung nilai dari skor dan bobot; koreksi memakai rubrik asli pemeriksaan.</p>
      {rubric.map((p) => <div key={p.id} className="flex items-center justify-between gap-3"><label className="text-sm text-ink-200" htmlFor={prefix + p.id}>{p.name} <span className="text-xs text-ink-500">(bobot {p.weight})</span></label><input id={prefix + p.id} type="number" className="input w-24" required min={1} max={5} step={1} disabled={busy} value={form.parameter_scores[p.id] ?? ''} onChange={(e) => setForm((s) => ({ ...s, parameter_scores: { ...s.parameter_scores, [p.id]: e.target.value } }))} /></div>)}
      <p className="text-sm font-medium">Pratinjau nilai: {average ?? '—'} / 5</p>{!rubric.length && <p role="alert" className="text-danger-400 text-sm">Rubrik aktif belum tersedia. Hubungi administrator.</p>}
    </div>
    <div><label className="label" htmlFor={prefix + 'decision'}>Hasil pemeriksaan *</label><select id={prefix + 'decision'} name="decision" className="input" required value={form.decision} disabled={busy} onChange={change}><option value="">Pilih hasil…</option>{Object.entries(QC_DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    {text('findings', 'Temuan / ketidaksesuaian', form.decision && form.decision !== 'LULUS')}
    {form.decision === 'REVISI' && <>{text('required_fixes', 'Instruksi perbaikan *', true)}{field('revision_due', 'Batas waktu revisi *', 'date', { required: true })}</>}
    {(Number(sample.qc_count) > 0 || editing) && text('reinspection_note', 'Catatan pemeriksaan ulang', !editing && Number(sample.qc_count) > 0)}
    {text('notes', 'Catatan tambahan')}{editing && text('edit_reason', 'Alasan koreksi *', true)}
    <div className="grid sm:grid-cols-2 gap-4"><div><label className="label" htmlFor={prefix + 'photos'}>Foto bukti (maksimal 10)</label><input id={prefix + 'photos'} className="input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || form.photos.length >= 10} onChange={(e) => attach(e, true)} /><p className="text-xs text-ink-400 mt-1">{form.photos.length} foto terlampir · maksimal 5 MB per berkas</p></div><div><label className="label" htmlFor={prefix + 'document'}>Dokumen hasil pemeriksaan</label><input id={prefix + 'document'} className="input" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => attach(e, false)} />{form.document_path && <p className="text-xs text-primary-400 mt-1">Dokumen privat terlampir</p>}</div></div>
    {form.photos.map((p, i) => <p key={p.path} className="text-xs text-ink-400 break-words">Bukti {i + 1}: {p.caption || 'Foto pemeriksaan'}</p>)}
    {error && <p role="alert" className="text-sm text-danger-400">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Batal</button><button className="btn-primary" disabled={busy || !rubric.length}>{busy ? 'Menyimpan…' : editing ? 'Simpan Koreksi QC' : 'Simpan Hasil QC'}</button></div>
  </form></dialog>;
}
