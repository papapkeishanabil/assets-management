import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { VENDOR_WRITE_ROLES } from '../../lib/vendor-constants';
import { LOCATION_READ_ROLES } from '../../lib/vendor-location-utils';
import { fetchLinkedMasterCandidate, linkExistingActiveVendor, locationPayload, saveLocation } from '../../lib/vendor-location-helpers';
import VendorLocationsPanel from './VendorLocationsPanel';
import LocationFormModal from './LocationFormModal';

export default function MasterVendorLocationsPanel({ vendor }) {
  const { role } = useAuth();
  const { hasAccess, loading: permissionsLoading } = useRolePermissions();
  const allowed = hasAccess('vendor_map') && LOCATION_READ_ROLES.includes(role?.role_name);
  const canWrite = allowed && VENDOR_WRITE_ROLES.includes(role?.role_name);
  const [candidateId, setCandidateId] = useState(null);
  const linkedId = useRef(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [adding, setAdding] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => {
    if (!allowed || permissionsLoading) return;
    let ignore = false;
    setLoading(true); setError('');
    fetchLinkedMasterCandidate(vendor.id).then((id) => {
      if (!ignore) { linkedId.current = id; setCandidateId(id); }
    }).catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [allowed, permissionsLoading, vendor.id, version]);
  const saveFirstLocation = async (form) => {
    if (!canWrite || !vendor.is_active) throw new Error('Penambahan lokasi hanya untuk vendor aktif dengan izin lokasi');
    // Validasi sebelum RPC: membuka/membatalkan form atau koordinat tidak valid
    // tidak boleh membuat profil terhubung. RPC idempotent dipakai saat Simpan.
    locationPayload(form, false);
    const id = linkedId.current || await linkExistingActiveVendor(vendor.id);
    linkedId.current = id;
    await saveLocation(id, form, false);
  };
  if (permissionsLoading) return <p role="status" className="p-4 text-ink-400">Memuat akses lokasi…</p>;
  if (!allowed) return <p className="card p-4 text-ink-400">Anda tidak memiliki akses modul Peta Vendor.</p>;
  if (loading) return <p role="status" className="p-4 text-ink-400">Memuat lokasi vendor…</p>;
  if (error) return <div role="alert" className="card p-4 text-rose-300">Gagal memuat lokasi: {error} <button type="button" className="underline" onClick={() => setVersion((v) => v + 1)}>Coba lagi</button></div>;
  return <div className="space-y-4">
    <p className="text-sm text-ink-400">Lokasi dan koordinat yang disimpan di sini juga tampil pada Peta Vendor. Alamat lokasi dikelola terpisah dari alamat profil vendor.</p>
    {candidateId ? <VendorLocationsPanel candidateId={candidateId} initialLocationValues={{ address_line: vendor.address || '', city: vendor.city || '', location_type: 'LAINNYA' }} /> : <div className="card p-5 space-y-3">
      <p className="text-sm text-ink-300">Belum ada lokasi vendor. Tambahkan alamat, latitude dan longitude untuk menampilkan titik di peta.</p>
      {canWrite && vendor.is_active ? <button type="button" className="btn-primary" onClick={() => setAdding(true)}><Plus size={14} /> Tambah Lokasi</button>
        : !vendor.is_active ? <p className="text-sm text-ink-400">Vendor nonaktif belum dapat ditambahkan ke pengelolaan lokasi. Simpan profil sebagai aktif terlebih dahulu.</p>
          : <p className="text-sm text-ink-400">Akses Anda hanya untuk melihat lokasi.</p>}
    </div>}
    {adding && <LocationFormModal canVerify={false} initialValues={{ location_name: 'Lokasi Utama', location_type: 'LAINNYA', address_line: vendor.address || '', city: vendor.city || '' }} onSave={saveFirstLocation}
      onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setCandidateId(linkedId.current); }} />}
    <p className="text-xs text-ink-500 flex items-center gap-2"><MapPin size={14} /> Gunakan lokasi sebenarnya; GPS perangkat perlu dikonfirmasi sebelum disimpan.</p>
  </div>;
}
