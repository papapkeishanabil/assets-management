import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../lib/constants';
import toast from 'react-hot-toast';
import { Plus, Search, RefreshCw, Eye, Edit, Trash2, Ban, Filter, Package, X } from 'lucide-react';
import { permanentDeleteAsset } from '../lib/asset-helpers';

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
    is_active: ''
  });
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [photosMap, setPhotosMap] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [responsiblesMap, setResponsiblesMap] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const canEdit = role && ['super_admin', 'hrd'].includes(role.role_name);
  const canDelete = role && role.role_name === ROLES.SUPER_ADMIN;

  const fetchMasterData = useCallback(async () => {
    const [catRes, locRes, deptRes, condRes, statRes] = await Promise.all([
      supabase.from('asset_categories').select('*').eq('is_active', true).order('category_name'),
      supabase.from('asset_locations').select('*').eq('is_active', true).order('location_name'),
      supabase.from('departments').select('*').eq('is_active', true).order('department_name'),
      supabase.from('asset_conditions').select('*').eq('is_active', true).order('display_order'),
      supabase.from('asset_statuses').select('*').eq('is_active', true).order('display_order')
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (locRes.data) setLocations(locRes.data);
    if (deptRes.data) setDepartments(deptRes.data);
    if (condRes.data) setConditions(condRes.data);
    if (statRes.data) setStatuses(statRes.data);
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`asset_code.ilike.%${search}%,asset_name.ilike.%${search}%,serial_number.ilike.%${search}%`);
      }

      if (filters.category_id) query = query.eq('category_id', filters.category_id);
      if (filters.location_id) query = query.eq('location_id', filters.location_id);
      if (filters.department_id) query = query.eq('department_id', filters.department_id);
      if (filters.condition_id) query = query.eq('condition_id', filters.condition_id);
      if (filters.status_id) query = query.eq('status_id', filters.status_id);
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
      is_active: ''
    });
    setSearch('');
  };

  const getCategoryName = (id) => categories.find(c => c.id === id)?.category_name || '-';
  const getLocationName = (id) => locations.find(l => l.id === id)?.location_name || '-';
  const getConditionName = (id) => conditions.find(c => c.id === id)?.condition_name || '-';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Daftar Aset</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola seluruh aset perusahaan</p>
        </div>
        {canEdit && (
          <button onClick={() => navigate('/assets/new')} className="btn-primary text-sm">
            <Plus size={14} />
            Tambah Aset
          </button>
        )}
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
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Lokasi</th>
                  <th>Penanggung Jawab</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const condName = getConditionName(asset.condition_id).toLowerCase();
                  const condBadge = condName.includes('baik') ? 'badge-green' : condName.includes('rusak') ? 'badge-red' : 'badge-yellow';
                  return (
                    <tr key={asset.id} className="hover-card">
                      <td>
                        {photosMap[asset.id] ? (
                          <button
                            onClick={() => setPreviewPhoto({ url: photosMap[asset.id], name: asset.asset_name })}
                            className="cursor-zoom-in"
                            title="Klik untuk perbesar"
                          >
                            <img src={photosMap[asset.id]} alt={asset.asset_name} className="w-10 h-10 object-cover rounded-md hover:ring-2 hover:ring-primary-500/50 transition-all" />
                          </button>
                        ) : (
                          <div className="w-10 h-10 bg-white/5 rounded-md flex items-center justify-center">
                            <Package size={14} className="text-ink-600" />
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-[12px] text-ink-300">{asset.asset_code}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-ink-500 flex-shrink-0" />
                          <span className="font-medium text-white">{asset.asset_name}</span>
                        </div>
                      </td>
                      <td className="text-ink-300">{getCategoryName(asset.category_id)}</td>
                      <td className="text-ink-300">{getLocationName(asset.location_id)}</td>
                      <td className="text-ink-300">
                        {responsiblesMap[asset.id]?.join(', ') || usersMap[asset.responsible_user_id] || '-'}
                      </td>
                      <td>
                        <span className={condBadge}>{getConditionName(asset.condition_id)}</span>
                      </td>
                      <td>
                        <span className={asset.is_active ? 'badge-green' : 'badge-gray'}>
                          {asset.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/assets/${asset.id}`)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Detail">
                            <Eye size={14} />
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
