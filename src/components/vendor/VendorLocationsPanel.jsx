import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { LOCATION_READ_ROLES, LOCATION_TYPES, VERIFICATION_LABELS, googleMapsUrl, locationReadiness } from '../../lib/vendor-location-utils';
import { fetchLocations, setPrimaryLocation } from '../../lib/vendor-location-helpers';
import { formatFollowupTime } from '../../lib/vendor-followup-helpers';
import LocationFormModal from './LocationFormModal';
import LocationPhotos from './LocationPhotos';
import VendorLocationNavigation from './VendorLocationNavigation';

export default function VendorLocationsPanel({ candidateId, onChanged, initialLocationValues }) {
  const { role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const allowed = hasAccess('vendor_map') && LOCATION_READ_ROLES.includes(role?.role_name);
  const canVerify = ['hrd', 'super_admin'].includes(role?.role_name);
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0), [editing, setEditing] = useState(null), [busy, setBusy] = useState(false);
  const [backendPending, setBackendPending] = useState(false);
  const canWrite = allowed && VENDOR_WRITE_ROLES.includes(role?.role_name) && !backendPending && !loading && !error;
  useEffect(() => {
    if (!allowed) return;
    let ignore = false; setLoading(true); setError('');
    fetchLocations(candidateId).then((data) => { if (!ignore) { setRows(data || []); setBackendPending(data === null); } }).catch((err) => { if (!ignore) setError(err.message); }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [allowed, candidateId, version]);
  const refresh = () => { setVersion((v) => v + 1); onChanged?.(); };
  const makePrimary = async (id) => {
    if (busy) return; setBusy(true);
    try { await setPrimaryLocation(id); toast.success('Lokasi utama diperbarui'); refresh(); }
    catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  if (permissionsLoading) return <p role="status" className="text-ink-400">Memuat akses lokasi…</p>;
  if (!allowed) return <p className="card p-5 text-ink-400">Anda tidak memiliki akses modul Peta Vendor.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-3"><p className="text-sm text-ink-400">Satu vendor dapat memiliki beberapa fasilitas; satu lokasi utama.</p><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={refresh} disabled={loading}><RefreshCw size={14} /> Refresh lokasi</button><Link to={`/vendor/map?candidate=${candidateId}`} className="btn-secondary"><MapPin size={14} /> Peta Vendor</Link>{canWrite && <button className="btn-primary" onClick={() => setEditing({})}><Plus size={14} /> Tambah Lokasi</button>}</div></div>
    {error && <div role="alert" className="card p-4 text-rose-300">Gagal memuat lokasi: {error} <button className="underline" onClick={refresh}>Coba lagi</button></div>}
    {loading ? <p role="status" className="card p-6 text-ink-400">Memuat lokasi dan foto…</p> : backendPending ? <p role="status" className="card p-4 text-sm text-ink-400">Lokasi dan foto vendor belum aktif. Data sourcing dan follow-up tetap dapat digunakan.</p> : !error && rows.length === 0 ? <div className="card empty-state p-8">Belum ada lokasi. Lead dapat disimpan dahulu, lalu alamat, GPS dan foto dilengkapi setelah survei.</div> : rows.map((location) => {
      const readiness = locationReadiness(location), navigation = googleMapsUrl(location.latitude, location.longitude);
      return <article key={location.id} className="card p-5 space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3"><div><h3 className="text-lg font-semibold text-white">{location.location_name}</h3><p className="text-sm text-ink-400">{LOCATION_TYPES[location.location_type]}</p><div className="flex flex-wrap gap-2 mt-2">{location.is_primary && <span className="badge-blue">Lokasi utama</span>}<span className={readiness.badge}>{readiness.label}</span>{location.verification_status === 'NEEDS_REVISIT' && <span className="badge-orange">Perlu kunjungan ulang</span>}</div></div>
          {canWrite && <div className="flex flex-wrap gap-2">{!location.is_primary && <button className="btn-secondary" disabled={busy} onClick={() => makePrimary(location.id)}>Jadikan lokasi utama</button>}<button className="btn-secondary" onClick={() => setEditing(location)}>Edit lokasi</button></div>}
        </div>
        <p className="text-sm text-ink-200 whitespace-pre-wrap break-words">{[location.address_line, location.village, location.district, location.city, location.province, location.postal_code].filter(Boolean).join(', ') || 'Alamat belum dilengkapi'}</p>
        <div className="flex flex-wrap gap-3 text-sm text-ink-400"><span>Koordinat: {navigation ? `${location.latitude}, ${location.longitude}` : 'Belum diisi'}</span><VendorLocationNavigation latitude={location.latitude} longitude={location.longitude} /><span>Sumber: {location.coordinate_source || 'Belum ada'}</span></div>
        <p className="text-xs text-ink-500">{VERIFICATION_LABELS[location.verification_status]}{location.verified_at && ` · ${location.verifier?.full_name || 'Petugas'} · ${formatFollowupTime(location.verified_at)}`}{location.verification_notes && ` · ${location.verification_notes}`}</p>
        <LocationPhotos location={location} canWrite={canWrite} canArchive={role?.role_name === 'super_admin'} onChanged={refresh} />
      </article>;
    })}
    {editing && <LocationFormModal candidateId={candidateId} editing={editing.id ? editing : null} initialValues={initialLocationValues} canVerify={canVerify} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
  </div>;
}
