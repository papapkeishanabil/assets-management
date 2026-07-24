import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Shield, X, Save, AlertCircle } from 'lucide-react';

export default function RolesPage() {
  const { profile, role } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ role_name: '', description: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const canEdit = role && ['super_admin'].includes(role.role_name);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('roles').select('*').order('created_at', { ascending: false });
      if (search) {
        query = query.or(`role_name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Gagal memuat data role');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.role_name.trim()) {
      toast.error('Nama role wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingRole) {
        // Update
        const { error } = await supabase
          .from('roles')
          .update({ role_name: formData.role_name, description: formData.description, is_active: formData.is_active })
          .eq('id', editingRole.id);
        if (error) throw error;
        toast.success('Role berhasil diperbarui');
      } else {
        // Insert
        const { error } = await supabase.from('roles').insert([{
          role_name: formData.role_name,
          description: formData.description,
          is_active: formData.is_active
        }]);
        if (error) throw error;
        toast.success('Role berhasil ditambahkan');
      }
      setShowModal(false);
      setEditingRole(null);
      setFormData({ role_name: '', description: '', is_active: true });
      fetchRoles();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roleItem) => {
    if (!confirm(`Hapus role "${roleItem.role_name}"?`)) return;
    try {
      const { error } = await supabase.from('roles').delete().eq('id', roleItem.id);
      if (error) throw error;
      toast.success('Role berhasil dihapus');
      fetchRoles();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Manajemen Role</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola role dan hak akses pengguna</p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowModal(true); setEditingRole(null); setFormData({ role_name: '', description: '', is_active: true }); }} className="btn-primary text-sm">
            <Plus size={16} />
            Tambah Role
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
          <input type="text" className="input pl-9" placeholder="Cari nama role..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Roles Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Shield size={48} /></div>
            <h3 className="empty-state-title">Tidak ada role ditemukan</h3>
            <p className="empty-state-text">Coba sesuaikan pencarian Anda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Role</th>
                  <th>Deskripsi</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((roleItem) => (
                  <tr key={roleItem.id} className="hover-card">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center">
                          <Shield size={16} className="text-primary-400" />
                        </div>
                        <span className="font-medium text-white font-mono text-[13px]">{roleItem.role_name}</span>
                      </div>
                    </td>
                    <td className="text-ink-200">{roleItem.description || '-'}</td>
                    <td>
                      <span className={`badge ${roleItem.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {roleItem.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-sm text-ink-400">
                      {new Date(roleItem.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => { setShowModal(true); setEditingRole(roleItem); setFormData({ role_name: roleItem.role_name, description: roleItem.description || '', is_active: roleItem.is_active }); }}
                              className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(roleItem)}
                              className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Shield size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {editingRole ? 'Edit Role' : 'Tambah Role Baru'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Nama Role <span className="text-danger-400">*</span></label>
                <input
                  type="text"
                  className="input"
                  value={formData.role_name}
                  onChange={(e) => setFormData({...formData, role_name: e.target.value})}
                  placeholder="contoh: super_admin, hrd, pelaksana"
                  required
                />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea
                  className="input"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Deskripsi role ini..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  className="w-4 h-4 rounded border-white/10 text-primary-400 focus:ring-primary-500"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                />
                <label htmlFor="is_active" className="text-sm text-ink-200">Role aktif</label>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
