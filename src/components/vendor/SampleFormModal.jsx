import { useEffect, useId, useRef, useState } from 'react';
import { SAMPLE_TYPES, MATERIAL_SOURCES, saveSample } from '../../lib/vendor-sampling';
import { fromJakartaInput, toJakartaInput } from '../../lib/vendor-followup-helpers';
import { createOfissioSample } from '../../lib/vendor-product-catalog';
import OfissioProductPicker from './OfissioProductPicker';
import SampleProductReference from './SampleProductReference';
export default function SampleFormModal({ editing, candidateId, related, options, onClose, onSaved }) {
  const dialog = useRef(null), pending = useRef(false), prefix = useId();
  const [form, setForm] = useState(() => ({ candidate_id: editing?.candidate_id || candidateId || related?.candidate_id || '', sample_type: editing?.sample_type || related?.sample_type || 'JAHIT_PRODUK', product_code: editing?.product_code || related?.product_code || '', brief: editing?.brief || '', material_source: editing?.material_source || 'HARMAS', quantity: editing?.quantity || 1, unit: editing?.unit || 'pcs', cost: editing?.cost ?? '', internal_pic_id: editing?.internal_pic_id || '', assigned_at: editing?.assigned_at ? toJakartaInput(editing.assigned_at) : '', target_date: editing?.target_date || '', received_at: editing?.received_at ? toJakartaInput(editing.received_at) : '', notes: editing?.notes || '', revision_note: editing?.revision_note || '', related_sample_id: related?.id || '' }));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const locked = Number(editing?.qc_count) > 0;
  const [source, setSource] = useState('MANUAL'), [product, setProduct] = useState(null);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => { const d = dialog.current; d.showModal(); return () => d.close(); }, []);
  const change = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const field = (name, label, type = 'text', props = {}) => <div key={name}><label className="label" htmlFor={prefix + name}>{label}</label><input {...props} id={prefix + name} name={name} type={type} className="input" value={form[name]} onChange={change} disabled={busy || (name === 'product_code' && (source === 'OFISSIO' || editing?.product_reference)) || (locked && ['product_code', 'quantity', 'unit'].includes(name))} /></div>;
  const select = (name, label, entries, disabled = false) => <div><label className="label" htmlFor={prefix + name}>{label}</label><select id={prefix + name} name={name} className="input" disabled={busy || disabled} value={form[name]} onChange={change}>{entries.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div>;
  const submit = async (e) => {
    e.preventDefault(); if (pending.current) return;
    if (!editing && source === 'OFISSIO' && !product) { setError('Pilih produk acuan Ofissio terlebih dahulu.'); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const dates = { assigned_at: form.assigned_at ? fromJakartaInput(form.assigned_at) : '', received_at: form.received_at ? fromJakartaInput(form.received_at) : '' };
      if (!editing && source === 'OFISSIO') await createOfissioSample({ ...form, ...dates }, product, requestId.current);
      else await saveSample({ ...form, ...dates }, editing);
      onSaved();
    } catch (err) { setError(err.message); } finally { pending.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby={prefix + 'title'} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 bg-ink-900 text-white p-5 backdrop:bg-black/70"><form onSubmit={submit} className="space-y-4">
    <h2 id={prefix + 'title'} className="text-lg font-semibold">{editing ? 'Edit Sampel' : related ? 'Sampel Terkait Baru' : 'Tambah Sampel'}</h2>
    <p className="text-xs text-ink-400">Brief disimpan dahulu. Penugasan dan perkembangan dicatat pada detail sampel. Semua tanggal/jam menggunakan WIB.</p>
    {related && <p className="badge-blue">Terkait {related.sample_code}</p>}
    {!editing && <><div><label className="label" htmlFor={prefix + 'source'}>Sumber produk acuan</label><select id={prefix + 'source'} className="input" value={source} disabled={busy} onChange={e => { setSource(e.target.value); setProduct(null); setForm(s => ({ ...s, product_code: '' })); }}><option value="MANUAL">Produk Harmas / isi manual</option><option value="OFISSIO">Katalog Ofissio (termasuk Sasienala)</option></select></div>{source === 'OFISSIO' && <OfissioProductPicker disabled={busy} value={product} onChange={p => { setProduct(p); setForm(s => ({ ...s, product_code: p.sku })); }} />}</>}
    {editing?.product_reference && <><SampleProductReference reference={editing.product_reference} /><p className="text-xs text-ink-400">Acuan produk dan kode dikunci sejak dibuat. Untuk produk acuan berbeda, buat sampel terkait baru.</p></>}
    {related?.product_reference && <p className="text-xs text-ink-400">Sampel sebelumnya memakai {related.product_reference.product_name}. Pilih kembali produk katalog untuk acuan baru, atau isi manual jika spesifikasi berbeda.</p>}
    <div className="grid sm:grid-cols-2 gap-4">
      {select('candidate_id', 'Vendor *', [['', 'Pilih vendor…'], ...options.candidates.map((c) => [c.id, `${c.candidate_code} · ${c.business_name}`])], Boolean(editing || candidateId || related))}
      {select('sample_type', 'Jenis sampel *', Object.entries(SAMPLE_TYPES), locked)}
      {field('product_code', 'Kode produk', 'text', { maxLength: 100 })}{select('material_source', 'Penyedia bahan', Object.entries(MATERIAL_SOURCES), locked)}
      {field('quantity', 'Jumlah *', 'number', { min: 0.001, step: 'any', required: true })}{field('unit', 'Satuan *', 'text', { required: true, maxLength: 50 })}
      {field('cost', 'Biaya sampel (Rp)', 'number', { min: 0, step: 0.01 })}{select('internal_pic_id', 'PIC HARMAS', [['', 'Belum ditugaskan'], ...options.users.map((u) => [u.id, u.full_name])])}
      {field('assigned_at', 'Tanggal penugasan (WIB)', 'datetime-local')}{field('target_date', 'Target selesai', 'date')}{field('received_at', 'Tanggal diterima (WIB)', 'datetime-local')}
    </div>
    <div><label className="label" htmlFor={prefix + 'brief'}>Brief / spesifikasi *</label><textarea id={prefix + 'brief'} name="brief" className="input" rows={3} required minLength={5} maxLength={10000} value={form.brief} disabled={busy || locked} onChange={change} placeholder="Pekerjaan yang diuji, warna, ukuran, bahan, detail jahitan dan standar pengerjaan…" /></div>
    {locked && <p className="text-xs text-ink-400">Brief/bahan/jumlah telah menjadi bukti QC dan dikunci. Gunakan sampel terkait baru untuk spesifikasi berbeda.</p>}
    {field('notes', 'Catatan')}{field('revision_note', 'Catatan revisi / alasan pembatalan')}
    {error && <p role="alert" className="text-sm text-danger-400">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Batal</button><button className="btn-primary" disabled={busy || !form.candidate_id}>{busy ? 'Menyimpan…' : 'Simpan Sampel'}</button></div>
  </form></dialog>;
}
