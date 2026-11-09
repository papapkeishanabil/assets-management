import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { PHOTO_TYPES, validatePhotoFile } from '../../lib/vendor-location-utils';
import { setCoverPhoto, updateLocationPhoto, uploadLocationPhoto } from '../../lib/vendor-location-helpers';
import { formatFollowupTime } from '../../lib/vendor-followup-helpers';
import SignedVendorPhoto from './SignedVendorPhoto';

function Preview({ photo, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; d.showModal(); return () => d.close(); }, []);
  return <dialog ref={ref} aria-label="Preview foto lokasi privat" onCancel={onClose} className="m-auto max-w-[95vw] w-[900px] max-h-[90vh] overflow-auto bg-ink-900 text-white p-4 rounded-xl backdrop:bg-black/80">
    <div className="flex justify-between mb-3"><p>{PHOTO_TYPES[photo.photo_type]} · {photo.caption || 'Foto lokasi'}</p><button className="btn-secondary" onClick={onClose}>Tutup foto</button></div>
    <SignedVendorPhoto path={photo.storage_path} alt={photo.caption || PHOTO_TYPES[photo.photo_type]} className="w-full max-h-[70vh] object-contain" />
  </dialog>;
}

export default function LocationPhotos({ location, canWrite, canArchive, onChanged }) {
  const [file, setFile] = useState(null), [previewUrl, setPreviewUrl] = useState(''), [busy, setBusy] = useState(false), [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState({ photo_type: 'EXTERIOR', caption: '', taken_at: '' });
  const [editing, setEditing] = useState(null), [preview, setPreview] = useState(null);
  const input = useRef(null), selection = useRef(0), pending = useRef(false);
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = async (event) => {
    const n = ++selection.current, selected = event.target.files?.[0]; setFile(null);
    if (!selected) return;
    try { await validatePhotoFile(selected); if (n === selection.current) setFile(selected); }
    catch (error) { if (n === selection.current) { toast.error(error.message); event.target.value = ''; } }
  };
  const run = async (action) => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await action(); toast.success('Foto diperbarui'); onChanged(); }
    catch (error) { toast.error(error.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const upload = async (event) => {
    event.preventDefault(); if (!file) return toast.error('Pilih foto terlebih dahulu');
    await run(async () => { await uploadLocationPhoto(location, file, form); setFile(null); if (input.current) input.current.value = ''; setForm({ photo_type: 'EXTERIOR', caption: '', taken_at: '' }); });
  };
  const photos = (location.photos || []).filter((p) => showArchived || !p.is_archived).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order || a.uploaded_at.localeCompare(b.uploaded_at));
  return <div className="space-y-4 border-t border-white/10 pt-4">
    <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-white">Foto lokasi</h4><label className="text-xs text-ink-400 flex gap-2 items-center"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Tampilkan arsip</label></div>
    {photos.length === 0 ? <p className="text-sm text-ink-400">Belum ada foto lokasi. Tambahkan foto asli tampak luar untuk melengkapi data.</p> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {photos.map((photo) => <div key={photo.id} className="rounded-lg border border-white/10 p-3 space-y-2">
        <SignedVendorPhoto path={photo.storage_path} alt={photo.caption || PHOTO_TYPES[photo.photo_type]} onClick={() => setPreview(photo)} />
        <div className="flex flex-wrap gap-2"><span className="badge-blue">{PHOTO_TYPES[photo.photo_type]}</span>{photo.is_cover && <span className="badge-green">Cover</span>}{photo.is_archived && <span className="badge-gray">Diarsipkan</span>}</div>
        <p className="text-sm text-ink-200 break-words">{photo.caption || 'Tanpa keterangan'}</p>
        <p className="text-[11px] text-ink-500">Unggah: {photo.uploader?.full_name || 'Petugas'} · {formatFollowupTime(photo.uploaded_at)}{photo.taken_at && ` · Diambil ${formatFollowupTime(photo.taken_at)}`}</p>
        {canWrite && <div className="flex flex-wrap gap-2">
          {!photo.is_archived && !photo.is_cover && <button className="btn-secondary text-xs" disabled={busy} onClick={() => run(() => setCoverPhoto(photo.id))}>Jadikan cover</button>}
          {!photo.is_archived && <button className="btn-secondary text-xs" disabled={busy} onClick={() => setEditing({ id: photo.id, caption: photo.caption || '', photo_type: photo.photo_type })}>Edit keterangan</button>}
          {canArchive && <button className="btn-secondary text-xs" disabled={busy} onClick={() => { if (window.confirm(`${photo.is_archived ? 'Pulihkan' : 'Arsipkan'} foto ini? Riwayat dan berkas tetap disimpan.`)) run(() => updateLocationPhoto(photo.id, { is_archived: !photo.is_archived })); }}>{photo.is_archived ? 'Pulihkan' : 'Arsipkan'}</button>}
        </div>}
        {editing?.id === photo.id && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await updateLocationPhoto(photo.id, { caption: editing.caption.trim() || null, photo_type: editing.photo_type }); setEditing(null); }); }}>
          <label><span className="label">Jenis foto</span><select className="input" value={editing.photo_type} onChange={(e) => setEditing((old) => ({ ...old, photo_type: e.target.value }))}>{Object.entries(PHOTO_TYPES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          <label><span className="label">Keterangan foto</span><input className="input" value={editing.caption} onChange={(e) => setEditing((old) => ({ ...old, caption: e.target.value }))} /></label>
          <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary text-xs" disabled={busy}>Simpan keterangan</button><button type="button" className="btn-secondary text-xs" onClick={() => setEditing(null)}>Batal edit</button></div>
        </form>}
      </div>)}
    </div>}
    {canWrite && <form className="rounded-lg bg-white/5 p-4 space-y-3" onSubmit={upload}>
      <p className="text-sm font-medium text-white">Unggah foto asli lokasi</p>
      <p className="text-xs text-ink-400">JPG/PNG/WebP maksimal 5 MB. Foto diperkecil bila perlu dan metadata EXIF dibuang. Foto lama dapat diarsipkan oleh Super Admin setelah penggantinya diunggah.</p>
      <label><span className="label">Berkas foto *</span><input ref={input} type="file" className="input" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choose} disabled={busy} /></label>
      {previewUrl && <img src={previewUrl} alt="Preview sebelum unggah" className="h-32 max-w-full object-contain rounded-lg" />}
      <div className="grid sm:grid-cols-2 gap-3"><label><span className="label">Jenis foto *</span><select className="input" value={form.photo_type} onChange={(e) => setForm((old) => ({ ...old, photo_type: e.target.value }))}>{Object.entries(PHOTO_TYPES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label><span className="label">Tanggal diambil (WIB, bila diketahui)</span><input className="input" type="datetime-local" value={form.taken_at} onChange={(e) => setForm((old) => ({ ...old, taken_at: e.target.value }))} /></label>
        <label className="sm:col-span-2"><span className="label">Keterangan</span><input className="input" value={form.caption} onChange={(e) => setForm((old) => ({ ...old, caption: e.target.value }))} /></label>
      </div>
      <button className="btn-primary" disabled={busy || !file} type="submit">{busy ? 'Memproses / mengunggah…' : 'Unggah Foto'}</button>
    </form>}
    {preview && <Preview photo={preview} onClose={() => setPreview(null)} />}
  </div>;
}
