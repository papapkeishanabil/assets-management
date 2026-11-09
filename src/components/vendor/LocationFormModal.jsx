import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { LOCATION_TYPES, VERIFICATION_LABELS } from '../../lib/vendor-location-utils';
import { saveLocation } from '../../lib/vendor-location-helpers';
import MapPicker from './MapPicker';

export default function LocationFormModal({ candidateId, editing, canVerify, onClose, onSaved }) {
  const dialog = useRef(null), savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({ id: editing?.id || null, location_name: editing?.location_name || '', location_type: editing?.location_type || 'WORKSHOP_JAHIT',
    ...Object.fromEntries(['address_line', 'village', 'district', 'city', 'province', 'postal_code', 'latitude', 'longitude', 'coordinate_source', 'verification_notes'].map((k) => [k, editing?.[k] ?? ''])), verification_status: editing?.verification_status || 'UNVERIFIED' }));
  useEffect(() => { const el = dialog.current; el.showModal(); return () => el.close(); }, []);
  const change = (e) => setForm((old) => ({ ...old, [e.target.name]: e.target.value, ...(['latitude', 'longitude'].includes(e.target.name) ? { coordinate_source: 'MANUAL' } : {}) }));
  const submit = async (e) => {
    e.preventDefault(); if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try { await saveLocation(candidateId, form, canVerify); toast.success('Lokasi tersimpan'); onSaved(); }
    catch (err) { toast.error(`Gagal menyimpan lokasi: ${err.message}`); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <dialog ref={dialog} aria-labelledby="location-form-title" onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-ink-900 text-white border border-white/10 p-0 backdrop:bg-black/70">
    <form className="p-5 space-y-4" onSubmit={submit}>
      <div className="flex justify-between items-center"><h2 id="location-form-title" className="text-lg font-semibold">{editing ? 'Edit Lokasi' : 'Tambah Lokasi'}</h2><button type="button" aria-label="Tutup lokasi" className="btn-ghost" disabled={saving} onClick={onClose}><X size={18} /></button></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label><span className="label">Nama lokasi *</span><input className="input" name="location_name" value={form.location_name} onChange={change} required maxLength={200} /></label>
        <label><span className="label">Jenis fasilitas *</span><select className="input" name="location_type" value={form.location_type} onChange={change}>{Object.entries(LOCATION_TYPES).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="label">Alamat jalan / nomor</span><textarea className="input" rows={2} name="address_line" value={form.address_line} onChange={change} /></label>
        {[['village', 'Kelurahan / desa'], ['district', 'Kecamatan'], ['city', 'Kota / kabupaten'], ['province', 'Provinsi'], ['postal_code', 'Kode pos']].map(([name, label]) => <label key={name}><span className="label">{label}</span><input className="input" name={name} value={form[name]} onChange={change} /></label>)}
        <div className="hidden sm:block" />
        <label><span className="label">Latitude</span><input className="input" name="latitude" type="number" min="-90" max="90" step="any" value={form.latitude} onChange={change} /></label>
        <label><span className="label">Longitude</span><input className="input" name="longitude" type="number" min="-180" max="180" step="any" value={form.longitude} onChange={change} /></label>
        <MapPicker latitude={form.latitude} longitude={form.longitude} onChange={(point) => setForm((old) => ({ ...old, ...point }))} />
        {canVerify && editing && <>
          <label><span className="label">Status verifikasi</span><select className="input" name="verification_status" value={form.verification_status} onChange={change}>{Object.entries(VERIFICATION_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          <label><span className="label">Catatan pemeriksaan lokasi</span><textarea className="input" name="verification_notes" value={form.verification_notes} onChange={change} /></label>
          <p className="sm:col-span-2 text-xs text-ink-500">Verifikasi memerlukan alamat, kota/provinsi, koordinat dan foto tampak luar. Perubahan alamat/koordinat membatalkan verifikasi sebelumnya.</p>
        </>}
      </div>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Batal</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Lokasi'}</button></div>
    </form>
  </dialog>;
}
