import { useEffect, useId, useRef, useState } from 'react';
import { DECISIONS, todayWIB, recordVendorDecision, uploadDecisionProof } from '../../lib/vendor-approvals';
export default function VendorDecisionModal({ state, users, onClose, onSaved, onReload }) {
  const ref = useRef(null), pending = useRef(false), request = useRef(null), prefix = useId();
  const [form, setForm] = useState({ decision: '', basis_reason: '', scope_limit: '', effective_from: todayWIB(), reeval_date: '', follow_up_action: '', pic_id: '', proof_path: '', override_reason: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reviewed, setReviewed] = useState(false);
  useEffect(() => { const d = ref.current; d.showModal(); return () => d.close(); }, []);
  useEffect(() => setReviewed(false), [state.basis_token, state.updated_at]);
  const change = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const needsOverride = form.decision === 'APPROVED' && state.checks.some((c) => !c.passed && c.overrideable);
  const identityMissing = state.checks.some((c) => !c.passed && !c.overrideable);
  const attach = async (e) => { const file = e.target.files?.[0]; if (!file || pending.current) return; pending.current = true; setBusy(true); setError(''); try { const path = await uploadDecisionProof(state.candidate_id, file); setForm((s) => ({ ...s, proof_path: path })); } catch (err) { setError(err.message); } finally { pending.current = false; setBusy(false); e.target.value = ''; } };
  const submit = async (e) => {
    e.preventDefault(); if (pending.current || !reviewed) return; pending.current = true; setBusy(true); setError('');
    const payload = { ...form, basis_reason: form.basis_reason.trim(), proof_path: form.proof_path || null, pic_id: form.pic_id || null, reeval_date: form.reeval_date || null, override_reason: needsOverride ? form.override_reason.trim() || null : null };
    const serialized = JSON.stringify(payload); if (request.current?.payload !== serialized) request.current = { id: crypto.randomUUID(), payload: serialized };
    try { await recordVendorDecision(state, payload, request.current.id); onSaved(); } catch (err) { setError(err.message); } finally { pending.current = false; setBusy(false); }
  };
  const text = (name, label, required = false, maxLength = 5000) => <div><label className="label" htmlFor={prefix + name}>{label}</label><textarea id={prefix + name} name={name} className="input" rows={3} value={form[name]} onChange={change} disabled={busy} required={required} minLength={required ? 10 : undefined} maxLength={maxLength} /></div>;
  return <dialog ref={ref} aria-labelledby={prefix + 'title'} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-ink-900 text-white p-5 backdrop:bg-black/70"><form className="space-y-4" onSubmit={submit}>
    <h2 id={prefix + 'title'} className="text-lg font-semibold">Catat Keputusan Vendor</h2><p className="text-sm text-ink-400">{state.candidate_code} · {state.business_name}. Keputusan disimpan permanen; koreksi melalui keputusan baru.</p>
    <ul className="card p-4 space-y-2 text-sm">{state.checks.map((c) => <li key={c.key} className={c.passed ? 'text-success-400' : 'text-warning-400'}>{c.passed ? '✓' : '•'} {c.label}{!c.passed && !c.overrideable ? ' — wajib dilengkapi' : ''}</li>)}</ul>
    <div><label className="label" htmlFor={prefix + 'decision'}>Keputusan kelayakan *</label><select id={prefix + 'decision'} name="decision" className="input" required value={form.decision} onChange={change} disabled={busy}><option value="">Pilih keputusan…</option>{Object.entries(DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    {text('basis_reason', 'Dasar keputusan *', true)}{text('scope_limit', 'Batas ruang lingkup kerja sama')}
    <div className="grid sm:grid-cols-2 gap-4"><div><label className="label" htmlFor={prefix + 'date'}>Tanggal efektif (WIB)</label><input id={prefix + 'date'} type="date" className="input" value={form.effective_from} readOnly /><p className="text-xs text-ink-400 mt-1">Berlaku hari ini; penjadwalan/backdate belum tersedia.</p></div><div><label className="label" htmlFor={prefix + 'reeval'}>Tanggal evaluasi ulang</label><input id={prefix + 'reeval'} name="reeval_date" type="date" className="input" min={form.effective_from} value={form.reeval_date} onChange={change} disabled={busy} /></div></div>
    {text('follow_up_action', 'Tindak lanjut keputusan')}
    <div><label className="label" htmlFor={prefix + 'pic'}>PIC tindak lanjut (opsional)</label><select id={prefix + 'pic'} name="pic_id" className="input" value={form.pic_id} onChange={change} disabled={busy}><option value="">Belum ditetapkan</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
    {needsOverride && <div className="card p-4 space-y-3 border-warning-500/30"><p className="text-sm text-warning-400">Persetujuan ini memakai pengecualian lokasi/QC. Alasan harus menjelaskan seluruh syarat yang belum terpenuhi; syarat identitas tidak dapat dikecualikan.</p>{text('override_reason', 'Alasan pengecualian lokasi/QC *', true, 2000)}</div>}
    <div><label className="label" htmlFor={prefix + 'proof'}>Bukti keputusan (PDF/foto, maksimal 5 MB)</label><input id={prefix + 'proof'} type="file" className="input" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={attach} disabled={busy} />{form.proof_path && <p className="text-xs text-primary-400 mt-1">Bukti privat terlampir</p>}</div>
    {state.vendor_id && <p className="text-xs text-warning-400">Profil ini terhubung ke master. Keputusan tidak mengubah sakelar aktif/nonaktif master atau relasi aset; penanganan operasional dilakukan terpisah.</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} disabled={busy} required />Saya telah meninjau checklist dan dasar keputusan ini.</label>
    {form.decision === 'APPROVED' && identityMissing && <p role="alert" className="text-sm text-warning-400">Identitas/kontak/pemetaan master harus dilengkapi sebelum Disetujui.</p>}
    {error && <div role="alert" className="text-sm text-danger-400">{error} <button type="button" className="underline" disabled={busy} onClick={onReload}>Muat ulang checklist</button></div>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Batal</button><button className="btn-primary" disabled={busy || !reviewed || (form.decision === 'APPROVED' && identityMissing)}>{busy ? 'Menyimpan…' : 'Simpan Keputusan'}</button></div>
  </form></dialog>;
}
