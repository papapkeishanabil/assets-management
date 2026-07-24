import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Search, RefreshCw, X, Save, FolderTree, Power } from 'lucide-react';

export default function MaintenanceTypesPage() {
  const { role } = useAuth();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    maintenance_code: '',
    maintenance_name: '',
    description: '',
    is_active: true
  });

  const canEdit = role && ['super_admin', 'hrd'].includes(role.role_name);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maintenance_types')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`maintenance_code.ilike.%${search}%,maintenance_name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTypes(data || []);
    } catch (error) {
      console.error('Error fetching maintenance types:', error);
      toast.error('Gagal memuat data jenis pemeliharaan');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.maintenance_code || !form.maintenance_name) {
      toast.error('Kode dan nama jenis pemeliharaan wajib diisi');
      return;
    }

    try {
      const dataToSubmit = {
        maintenance_code: form.maintenance_code,
        maintenance_name: form.maintenance_name,
        description: form.description || null,
        is_active: form.is_active
      };

      if (editingId) {
        const { error } = await supabase
          .from('maintenance_types')
          .update(dataToSubmit)
          .eq('id', editingId);
        if (error) {
          if (error.code === '23505') {
            toast.error('Kode jenis pemeliharaan sudah ada. Gunakan kode lain.');
            return;
          }
          throw error;
        }
        toast.success('Jenis pemeliharaan berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('maintenance_types')
          .insert([dataToSubmit]);
        if (error) {
          if (error.code === '23505') {
            toast.error('Kode jenis pemeliharaan sudah ada. Gunakan kode lain.');
            return;
          }
          throw error;
        }
        toast.success('Jenis pemeliharaan berhasil ditambahkan');
      }

      setShowModal(false);
      setEditingId(null);
      setForm({
        maintenance_code: '',
        maintenance_name: '',
        description: '',
        is_active: true
      });
      fetchTypes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (type) => {
    setEditingId(type.id);
    setForm({
      maintenance_code: type.maintenance_code,
      maintenance_name: type.maintenance_name,
      description: type.description || '',
      is_active: type.is_active
    });
    setShowModal(true);
  };

  const handleToggleActive = async (type) => {
    try {
      const { error } = await supabase
        .from('maintenance_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);
      if (error) throw error;
      toast.success(`Jenis pemeliharaan ${type.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchTypes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Master Jenis Pemeliharaan</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola kategori jenis pemeliharaan aset</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTypes} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canEdit && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm({ maintenance_code: '', maintenance_name: '', description: '', is_active: true });
                setShowModal(true);
              }}
              className="btn-primary text-sm"
            >
              <Plus size={14} />
              Tambah Jenis
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Cari kode atau nama jenis pemeliharaan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : types.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FolderTree size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data jenis pemeliharaan</h3>
            <p className="empty-state-text">Coba sesuaikan pencarian Anda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Deskripsi</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type.id} className="hover-card">
                    <td className="font-mono text-[13px] text-white">{type.maintenance_code}</td>
                    <td className="font-medium text-white">{type.maintenance_name}</td>
                    <td className="text-ink-400">{type.description || '-'}</td>
                    <td>
                      <span className={type.is_active ? 'badge-green' : 'badge-gray'}>
                        {type.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleEdit(type)}
                              className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(type)}
                              className={`p-1.5 rounded-md transition-all ${
                                type.is_active
                                  ? 'text-orange-400 hover:bg-orange-500/10'
                                  : 'text-success-400 hover:bg-success-500/10'
                              }`}
                              title={type.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              <Power size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <FolderTree size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit Jenis Pemeliharaan' : 'Tambah Jenis Pemeliharaan'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Kode <span className="text-danger-400">*</span></label>
                <input
                  type="text"
                  className="input"
                  value={form.maintenance_code}
                  onChange={(e) => setForm({...form, maintenance_code: e.target.value})}
                  placeholder="contoh: GANTI-OLI"
                  required
                />
              </div>
              <div>
                <label className="label">Nama <span className="text-danger-400">*</span></label>
                <input
                  type="text"
                  className="input"
                  value={form.maintenance_name}
                  onChange={(e) => setForm({...form, maintenance_name: e.target.value})}
                  placeholder="contoh: Penggantian Oli"
                  required
                />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea
                  className="input"
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="Deskripsi jenis pemeliharaan ini..."
                ></textarea>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200">
                <input
                  type="checkbox"
                  id="is_active"
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30"
                  checked={form.is_active}
                  onChange={(e) => setForm({...form, is_active: e.target.checked})}
                />
                Aktif
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">
                  <Save size={14} />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
