import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../lib/constants';
import toast from 'react-hot-toast';
import { Plus, Search, RefreshCw, Eye, Edit, Trash2, Ban, Filter, Package, X, Truck, QrCode, Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { permanentDeleteAsset } from '../lib/asset-helpers';
import { formatDateID, WORK_CATEGORY, WORK_CATEGORY_BADGES, getWorkCategoryFromLog } from '../lib/maintenance-helpers';

// Label singkat kategori untuk kolom tabel (label lengkap terlalu panjang untuk sel).
const SHORT_CATEGORY_LABELS = {
  [WORK_CATEGORY.ROUTINE]: 'Rutin',
  [WORK_CATEGORY.REPAIR]: 'Perbaikan',
  [WORK_CATEGORY.OTHER]: 'Lainnya'
};

const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || 'https://harmas-asset-management.vercel.app').replace(/\/$/, '');

export default function AssetsPage() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category_id: '',
    location_id: '',
    department_id: '',
    condition_id: '',
    status_id: '',
    vendor_id: '',
    is_active: ''
  });
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [photosMap, setPhotosMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [responsiblesMap, setResponsiblesMap] = useState({});
  // Riwayat service per aset: { lastDate, lastCategory, repairCount } untuk kolom tabel.
  const [serviceStats, setServiceStats] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  const canEdit = role && ['super_admin', 'hrd'].includes(role.role_name);
  const canDelete = role && role.role_name === ROLES.SUPER_ADMIN;

  const fetchMasterData = useCallback(async () => {
    const [catRes, locRes, deptRes, condRes, statRes, vendorRes] = await Promise.all([
      supabase.from('asset_categories').select('*').eq('is_active', true).order('category_name'),
      supabase.from('asset_locations').select('*').eq('is_active', true).order('location_name'),
      supabase.from('departments').select('*').eq('is_active', true).order('department_name'),
      supabase.from('asset_conditions').select('*').eq('is_active', true).order('display_order'),
      supabase.from('asset_statuses').select('*').eq('is_active', true).order('display_order'),
      supabase.from('vendors').select('id, vendor_name, vendor_code, vendor_type').eq('is_active', true).order('vendor_name')
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (locRes.data) setLocations(locRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (condRes.data) setConditions(condRes.data);
    if (statRes.data) setStatuses(statRes.data);
    if (vendorRes.data) setVendors(vendorRes.data);
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        const searchTerm = search.trim().replace(/[(),]/g, ' ');
        const { data: matchingResponsibles } = await supabase
          .from('asset_responsibles')
          .select('id')
          .ilike('responsible_name', `%${searchTerm}%`);

        let responsibleAssetIds = [];
        const responsibleIds = (matchingResponsibles || []).map((item) => item.id);
        if (responsibleIds.length > 0) {
          const { data: matchingAssignments } = await supabase
            .from('asset_responsible_assignments')
            .select('asset_id')
            .in('responsible_id', responsibleIds);
          responsibleAssetIds = [...new Set((matchingAssignments || []).map((item) => item.asset_id))];
        }

        const searchFilters = [
          `asset_code.ilike.%${searchTerm}%`,
          `asset_name.ilike.%${searchTerm}%`,
          `serial_number.ilike.%${searchTerm}%`
        ];
        if (responsibleAssetIds.length > 0) {
          searchFilters.push(`id.in.(${responsibleAssetIds.join(',')})`);
        }
        query = query.or(searchFilters.join(','));
      }

      if (filters.category_id) query = query.eq('category_id', filters.category_id);
      if (filters.location_id) query = query.eq('location_id', filters.location_id);
      if (filters.department_id) query = query.eq('department_id', filters.department_id);
      if (filters.condition_id) query = query.eq('condition_id', filters.condition_id);
      if (filters.status_id) query = query.eq('status_id', filters.status_id);
      if (filters.vendor_id) query = query.eq('vendor_id', filters.vendor_id);
      if (filters.is_active !== '') query = query.eq('is_active', filters.is_active === 'true');

      const { data, error } = await query;
      if (error) throw error;
      setAssets(data || []);

      const assetIds = data?.map(a => a.id) || [];
      if (assetIds.length > 0) {
        const { data: photos } = await supabase
          .from('asset_photos')
          .select('asset_id, photo_url, is_primary')
          .in('asset_id', assetIds)
          .order('is_primary', { ascending: false });

        const photoMap = {};
        if (photos) {
          photos.forEach(p => {
            if (!photoMap[p.asset_id]) {
              photoMap[p.asset_id] = p.photo_url;
            }
          });
        }
        setPhotosMap(photoMap);

        const { data: assignments } = await supabase
          .from('asset_responsible_assignments')
          .select('asset_id, is_primary, responsible:asset_responsibles(responsible_name)')
          .in('asset_id', assetIds)
          .order('is_primary', { ascending: false });

        const assignmentMap = {};
        if (assignments) {
          assignments.forEach(item => {
            if (!assignmentMap[item.asset_id]) assignmentMap[item.asset_id] = [];
            if (item.responsible?.responsible_name) {
              assignmentMap[item.asset_id].push(item.responsible.responsible_name);
            }
          });
        }
        setResponsiblesMap(assignmentMap);

        // Agregat riwayat service: tanggal terakhir (service_date, fallback created_at)
        // + jumlah kategori perbaikan (log SERVICE lama tanpa work_category = perbaikan).
        const { data: serviceLogs } = await supabase
          .from('asset_activity_logs')
          .select('asset_id, action_type, created_at, new_data')
          .eq('action_type', 'SERVICE')
          .in('asset_id', assetIds);

        const statsMap = {};
        if (serviceLogs) {
          for (const log of serviceLogs) {
            const cat = getWorkCategoryFromLog(log);
            const date = log.new_data?.service_date || log.created_at;
            if (!statsMap[log.asset_id]) {
              statsMap[log.asset_id] = { lastDate: date, lastCategory: cat, repairCount: 0 };
            }
            if (cat === WORK_CATEGORY.REPAIR) statsMap[log.asset_id].repairCount++;
            if (new Date(date) > new Date(statsMap[log.asset_id].lastDate)) {
              statsMap[log.asset_id].lastDate = date;
              statsMap[log.asset_id].lastCategory = cat;
            }
          }
        }
        setServiceStats(statsMap);
      }

      const userIds = [...new Set(data?.filter(a => a.responsible_user_id).map(a => a.responsible_user_id) || [])];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);

        const userMap = {};
        if (users) {
          users.forEach(u => { userMap[u.id] = u.full_name; });
        }
        setUsersMap(userMap);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Gagal memuat data aset');
    } finally {
      setLoading(false);
    }
  }, [search, filters]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleDeactivate = async (asset) => {
    const reason = prompt('Alasan penonaktifan:\n1. Dijual\n2. Dihapuskan\n3. Rusak Berat\n4. Hilang\n5. Tidak Digunakan\n6. Data Duplikat\n7. Lainnya\n\nMasukkan nomor atau alasan:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('assets')
        .update({
          is_active: false,
          deactivation_reason: reason,
          deactivated_by: profile?.id,
          deactivated_at: new Date().toISOString()
        })
        .eq('id', asset.id);

      if (error) throw error;
      toast.success('Aset berhasil dinonaktifkan');
      fetchAssets();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleActivate = async (asset) => {
    if (!confirm('Aktifkan kembali aset ini?')) return;
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          is_active: true,
          deactivation_reason: null,
          deactivated_by: null,
          deactivated_at: null
        })
        .eq('id', asset.id);

      if (error) throw error;
      toast.success('Aset berhasil diaktifkan');
      fetchAssets();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePermanentDelete = async (asset) => {
    const input = prompt(
      `HAPUS PERMANEN aset berikut?\n\n` +
      `Kode: ${asset.asset_code}\n` +
      `Nama: ${asset.asset_name}\n\n` +
      `Tindakan ini tidak dapat dibatalkan. Semua foto, dokumen, riwayat pemeliharaan, dan log aktivitas terkait akan ikut terhapus.\n\n` +
      `Ketik kode aset PERSIS (${asset.asset_code}) untuk konfirmasi:`
    );
    if (input === null) return;
    if (input.trim() !== asset.asset_code) {
      toast.error('Kode aset tidak cocok. Penghapusan dibatalkan.');
      return;
    }

    const toastId = toast.loading('Menghapus aset permanen...');
    try {
      await permanentDeleteAsset(asset.id);
      toast.success('Aset permanen dihapus', { id: toastId });
      fetchAssets();
    } catch (error) {
      toast.error('Gagal hapus permanen: ' + error.message, { id: toastId });
    }
  };

  const resetFilters = () => {
    setFilters({
      category_id: '',
      location_id: '',
      department_id: '',
      condition_id: '',
      status_id: '',
      vendor_id: '',
      is_active: ''
    });
    setSearch('');
  };

  const getLocationName = (id) => locations.find(l => l.id === id)?.location_name || '-';
  const getConditionName = (id) => conditions.find(c => c.id === id)?.condition_name || '-';
  const getVendorName = (id) => vendors.find(v => v.id === id)?.vendor_name || '-';
  const getStatusName = (id) => statuses.find(status => status.id === id)?.status_name || '-';
  const getStatusBadge = (statusName) => {
    if (statusName === 'Aktif') return 'badge-green';
    if (statusName === 'Cadangan/Backup') return 'badge-blue';
    if (['Dalam Pemeliharaan', 'Dipinjamkan', 'Berada di Vendor'].includes(statusName)) return 'badge-yellow';
    if (['Rusak', 'Tidak Layak Pakai', 'Hilang'].includes(statusName)) return 'badge-red';
    return 'badge-gray';
  };

  const handleOpenQr = async (asset) => {
    if (!asset.qr_token) {
      toast.error('Token QR aset belum tersedia');
      return;
    }
    setQrLoading(true);
    try {
      const scanUrl = `${PUBLIC_APP_URL}/scan/assets/${asset.qr_token}`;
      const dataUrl = await QRCode.toDataURL(scanUrl, { errorCorrectionLevel: 'Q', margin: 4, width: 900 });
      setQrPreview({ asset, dataUrl, scanUrl });
    } catch (error) {
      toast.error('Gagal membuat QR Code');
    } finally {
      setQrLoading(false);
    }
  };

  const handleDownloadQr = async () => {
    if (!qrPreview?.asset?.qr_token) return;
    const fileName = `QR-${qrPreview.asset.asset_code}.png`;
    const endpoint = `${PUBLIC_APP_URL}/api/qr/${encodeURIComponent(fileName)}?token=${encodeURIComponent(qrPreview.asset.qr_token)}&code=${encodeURIComponent(qrPreview.asset.asset_code)}`;

    if (!window.showSaveFilePicker) {
      const downloadWindow = window.open(endpoint, '_blank', 'noopener,noreferrer');
      if (!downloadWindow) window.location.assign(endpoint);
      toast.success('Download QR Code dimulai');
      return;
    }

    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'PNG Image',
          accept: { 'image/png': ['.png'] }
        }]
      });
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Respons download tidak valid');
      if (!response.headers.get('content-type')?.includes('image/png')) {
        throw new Error('Server tidak mengirim file PNG');
      }
      const writable = await fileHandle.createWritable();
      await writable.write(await response.blob());
      await writable.close();
      toast.success('QR Code berhasil disimpan');
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error('Gagal mengunduh QR Code');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Daftar Aset</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola seluruh aset perusahaan</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/assets/qr-labels')} className="btn-secondary text-sm">
            <QrCode size={14} />
            Cetak Label QR
          </button>
          {canEdit && (
            <button onClick={() => navigate('/assets/new')} className="btn-primary text-sm">
              <Plus size={14} />
              Tambah Aset
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari kode, nama, atau nomor seri..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary text-sm ${showFilters ? '!bg-primary-500/10 !text-primary-300 !border-primary-500/20' : ''}`}>
              <Filter size={14} />
              Filter
            </button>
            {showFilters && (
              <button onClick={resetFilters} className="btn-secondary text-sm" title="Reset filter">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5 animate-fade-in">
            <div>
              <label className="label flex items-center gap-1.5">
                <Truck size={12} className="text-ink-500" />
                Vendor
              </label>
              <select className="input" value={filters.vendor_id} onChange={(e) => setFilters({...filters, vendor_id: e.target.value})}>
                <option value="">Semua</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name}{vendor.vendor_type ? ` (${vendor.vendor_type})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={filters.category_id} onChange={(e) => setFilters({...filters, category_id: e.target.value})}>
                <option value="">Semua</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lokasi</label>
              <select className="input" value={filters.location_id} onChange={(e) => setFilters({...filters, location_id: e.target.value})}>
                <option value="">Semua</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Departemen</label>
              <select className="input" value={filters.department_id} onChange={(e) => setFilters({...filters, department_id: e.target.value})}>
                <option value="">Semua</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kondisi</label>
              <select className="input" value={filters.condition_id} onChange={(e) => setFilters({...filters, condition_id: e.target.value})}>
                <option value="">Semua</option>
                {conditions.map(cond => (
                  <option key={cond.id} value={cond.id}>{cond.condition_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={filters.status_id} onChange={(e) => setFilters({...filters, status_id: e.target.value})}>
                <option value="">Semua</option>
                {statuses.map(stat => (
                  <option key={stat.id} value={stat.id}>{stat.status_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status Aktif</label>
              <select className="input" value={filters.is_active} onChange={(e) => setFilters({...filters, is_active: e.target.value})}>
                <option value="">Semua</option>
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-400">Menampilkan <span className="text-white font-medium font-mono">{assets.length}</span> aset</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data aset</h3>
            <p className="empty-state-text">Coba sesuaikan pencarian atau filter Anda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                <th>Foto</th>
                <th>No. Aset</th>
                <th>Kode</th>
                  <th>Nama</th>
                  <th>Merek</th>
                  <th>Model</th>
                  <th>Lokasi</th>
                  <th>Penanggung Jawab</th>
                  <th>Service Terakhir</th>
                  <th>Jumlah Perbaikan</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const condName = getConditionName(asset.condition_id).toLowerCase();
                  const condBadge = condName.includes('baik') ? 'badge-green' : condName.includes('rusak') ? 'badge-red' : 'badge-yellow';
                  const stats = serviceStats[asset.id];
                  return (
                    <tr key={asset.id} className="hover-card">
                      <td>
                        {photosMap[asset.id] ? (
                          <button
                            onClick={() => setPreviewPhoto({ url: photosMap[asset.id], name: asset.asset_name })}
                            className="cursor-zoom-in"
                            title="Klik untuk perbesar"
                          >
                            <img src={photosMap[asset.id]} alt={asset.asset_name} className="w-28 h-20 object-contain bg-black/30 rounded-lg hover:ring-2 hover:ring-primary-500/50 transition-all" />
                          </button>
                        ) : (
                          <div className="w-28 h-20 bg-white/5 rounded-lg flex items-center justify-center">
                            <Package size={24} className="text-ink-600" />
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="asset-label-badge">
                          {asset.label_number ? `ASET ${String(asset.label_number).padStart(4, '0')}` : '-'}
                        </span>
                      </td>
                      <td className="font-mono text-[12px] text-ink-300">{asset.asset_code}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-ink-500 flex-shrink-0" />
                          <span className="font-medium text-white">{asset.asset_name}</span>
                        </div>
                      </td>
                      <td className="text-ink-300">{asset.brand || '-'}</td>
                      <td className="text-ink-300">{asset.model || '-'}</td>
                      <td className="text-ink-300">{getLocationName(asset.location_id)}</td>
                      <td className="text-ink-300">
                        {responsiblesMap[asset.id]?.length ? (
                          responsiblesMap[asset.id].join(', ')
                        ) : asset.vendor_id ? (
                          <span title={'Vendor sebagai penanggung jawab' + (asset.vendor_contact_name ? ` — kontak: ${asset.vendor_contact_name}` : '')}>
                            <span className="text-white">{getVendorName(asset.vendor_id)}</span>
                            {asset.vendor_contact_name && (
                              <span className="block text-[11px] text-ink-400">Kontak: {asset.vendor_contact_name}</span>
                            )}
                          </span>
                        ) : (
                          usersMap[asset.responsible_user_id] || '-'
                        )}
                      </td>
                      <td>
                        {stats ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-mono text-[12px] text-ink-200">{formatDateID(stats.lastDate)}</span>
                            <span className={WORK_CATEGORY_BADGES[stats.lastCategory]}>
                              {SHORT_CATEGORY_LABELS[stats.lastCategory]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-500">-</span>
                        )}
                      </td>
                      <td>
                        {stats?.repairCount ? (
                          <span className="font-mono font-medium text-white" title={`${stats.repairCount} kali perbaikan`}>
                            {stats.repairCount}×
                          </span>
                        ) : (
                          <span className="font-mono text-ink-500">0×</span>
                        )}
                      </td>
                      <td>
                        <span className={condBadge}>{getConditionName(asset.condition_id)}</span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <span className={getStatusBadge(getStatusName(asset.status_id))}>
                            {getStatusName(asset.status_id)}
                          </span>
                          {!asset.is_active && <span className="text-[10px] text-danger-400">Nonaktif dari inventaris</span>}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/assets/${asset.id}`)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Detail">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => handleOpenQr(asset)} disabled={qrLoading} className="p-1.5 text-ink-300 hover:bg-white/5 rounded-md transition-all" title="Lihat QR Code">
                            <QrCode size={14} />
                          </button>
                          {canEdit && (
                            <button onClick={() => navigate(`/assets/${asset.id}/edit`)} className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all" title="Edit">
                              <Edit size={14} />
                            </button>
                          )}
                          {asset.is_active ? (
                            <button onClick={() => handleDeactivate(asset)} className="p-1.5 text-orange-400 hover:bg-orange-500/10 rounded-md transition-all" title="Nonaktifkan">
                              <Ban size={14} />
                            </button>
                          ) : (
                            <>
                              <button onClick={() => handleActivate(asset)} className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all" title="Aktifkan kembali">
                                <RefreshCw size={14} />
                              </button>
                              {canDelete && (
                                <button onClick={() => handlePermanentDelete(asset)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus Permanen">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {qrPreview && (
        <div className="modal-overlay" onClick={() => setQrPreview(null)}>
          <div className="modal-content max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-white">QR Code Aset</h3>
                <p className="text-xs font-mono text-primary-400 mt-1">{qrPreview.asset.asset_code}</p>
              </div>
              <button onClick={() => setQrPreview(null)} className="p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md"><X size={18} /></button>
            </div>
            <div className="rounded-2xl bg-white p-5 flex justify-center">
              <img src={qrPreview.dataUrl} alt={`QR ${qrPreview.asset.asset_code}`} className="w-full max-w-[300px] aspect-square" />
            </div>
            <div className="text-center mt-4">
              <p className="font-semibold text-white">{qrPreview.asset.asset_name}</p>
              <p className="text-sm font-mono font-bold text-white mt-1">ASET {String(qrPreview.asset.label_number).padStart(4, '0')}</p>
              <p className="text-xs text-ink-500 mt-1 break-all">{qrPreview.scanUrl}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={handleDownloadQr} className="btn-primary justify-center">
                <Download size={15} /> Download PNG
              </button>
              <button onClick={() => navigate(`/assets/qr-labels?ids=${qrPreview.asset.id}`)} className="btn-secondary justify-center">
                <Printer size={15} /> Cetak Label
              </button>
            </div>
          </div>
        </div>
      )}

      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewPhoto.url}
              alt={previewPhoto.name}
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-soft-lg"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white px-4 py-3 rounded-b-xl">
              <p className="text-sm font-medium">{previewPhoto.name}</p>
            </div>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 p-2 text-white hover:bg-white/20 rounded-lg transition-all"
              title="Tutup"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
