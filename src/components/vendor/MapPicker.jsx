import { useMemo, useState } from 'react';
import { parseMapCoordinates } from '../../lib/vendor-location-utils';
import VendorMap from './VendorMap';

export default function MapPicker({ latitude, longitude, onChange }) {
  const [input, setInput] = useState(''), [draft, setDraft] = useState(null), [gps, setGps] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const points = useMemo(() => latitude !== '' && longitude !== '' && latitude !== null && longitude !== null ? [{ latitude, longitude }] : [], [latitude, longitude]);
  const parse = () => { try { setDraft(parseMapCoordinates(input)); setError(''); } catch (err) { setDraft(null); setError(err.message); } };
  const locate = () => {
    setError(''); setGps(null);
    if (!navigator.geolocation) return setError('Perangkat tidak mendukung GPS; isi koordinat secara manual.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }); setBusy(false);
    }, () => { setError('Lokasi perangkat tidak tersedia atau izinnya ditolak. Koordinat manual tetap dapat digunakan.'); setBusy(false); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  return <div className="space-y-3 sm:col-span-2">
    <label><span className="label">Tempel koordinat / URL Google Maps</span><input className="input" value={input} onChange={(e) => { setInput(e.target.value); setDraft(null); }} placeholder="-6.9175, 107.6191 atau URL Maps lengkap" /></label>
    <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={parse}>Baca koordinat</button><button type="button" className="btn-secondary" disabled={busy} onClick={locate}>{busy ? 'Mengambil GPS…' : 'Ambil Lokasi Saya'}</button></div>
    {draft && <div className="text-sm text-ink-300 p-3 rounded-lg bg-white/5">Titik terbaca: {draft.latitude}, {draft.longitude}. Periksa sebelum dipakai. <button type="button" className="text-primary-400 underline" onClick={() => { onChange(draft); setDraft(null); }}>Gunakan koordinat ini</button></div>}
    {gps && <div role="status" className="text-sm text-ink-300 p-3 rounded-lg bg-white/5">GPS perangkat: {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)} · perkiraan ±{Math.round(gps.accuracy)} m. Belum menjadi titik vendor. <button type="button" className="text-primary-400 underline" onClick={() => { onChange({ latitude: gps.latitude, longitude: gps.longitude, coordinate_source: 'DEVICE_GPS' }); setGps(null); }}>Gunakan lokasi perangkat ini</button></div>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <VendorMap points={points} editable onPick={onChange} height={260} />
    <p className="text-[11px] text-ink-500">Klik atau geser pin dalam mode edit. Koordinat baru tersimpan setelah Simpan Lokasi; GPS/foto tidak otomatis memverifikasi lokasi.</p>
  </div>;
}
