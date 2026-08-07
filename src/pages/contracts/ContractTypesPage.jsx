import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../lib/constants';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Trash2, Search, X, Save,
  FileText, FolderTree, ChevronDown
} from 'lucide-react';
import {
  CONTRACT_CATEGORIES,
  CONTRACT_CATEGORY_LABELS
} from '../../lib/contract-helpers';

export default function ContractTypesPage() {
  const { role } = useAuth();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    type_code: '',
    type_name: '',
    category: 'EMPLOYEE',
    description: '',
    is_active: true
  });

  const canManage = role && ['super_admin', 'hrd'].includes(role.role_name);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contract_types')
        .select('*')
        .order('category', { ascending: true })
        .order('type_name', { ascending: true });

      if (search) {
        query = query.or(`type_name.ilike.%${search}%,type_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTypes(data || []);
    } catch (error) {
      console.error('Error fetching contract types:', error);
      toast.error('Gagal memuat data jenis kontrak');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      type_code: '',
      type_name: '',
      category: 'EMPLOYEE',
      description: '',
      is_active: true
    });
    setShowModal(true);
  };

  const openEdit = (type) => {
    setEditingId(type.id);
    setForm({
      type_code: type.type_code,
      type_name: type.type_name,
      category: type.category,
      description: type.description || '',
      is_active: type.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    if (!form.type_code.trim()) {
      toast.error('Kode jenis kontrak harus diisi');
      return;
    }
    if (!form.type_name.trim()) {
      toast.error('Nama jenis kontrak harus diisi');
      return;
    }

    try {
      const data = {
        type_code: form.type_code.trim().toUpperCase(),
        type_name: form.type_name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        is_active: form.is_active
      };

      if (editingId) {
        const { error } = await supabase
          .from('contract_types')
          .update(data)
          .eq('id', editingId);

        if (error) {
          if (error.code === '23505') {
            toast.error('Kode jenis kontrak sudah digunakan');
            return;
          }
          throw error;
        }
        toast.success('Jenis kontrak berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('contract_types')
          .insert(data);

        if (error) {
          if (error.code === '23505') {
            toast.error('Kode jenis kontrak sudah digunakan');
            return;
          }
          throw error;
        }
        toast.success('Jenis kontrak berhasil ditambahkan');
      }

      setShowModal(false);
      fetchTypes();
    } catch (error) {
      console.error('Error saving contract type:', error);
      toast.error('Gagal menyimpan jenis kontrak');
    }
  };

  const handleToggleActive = async (type) => {
    if (!canManage) return;
    try {
      const { error } = await supabase
        .from('contract_types')
        .update({ is_active: !type.is_active })
        .eq('id', type.id);

      if (error) throw error;
      toast.success(type.is_active ? 'Jenis kontrak dinonaktifkan' : 'Jenis kontrak diaktifkan');
      fetchTypes();
    } catch (error) {
      console.error('Error toggling contract type:', error);
      toast.error('Gagal mengubah status');
    }
  };

  const handleDelete = async (type) => {
    if (!canManage) return;
    if (!window.confirm(`Hapus jenis kontrak "${type.type_name}"?`)) return;

    try {
      const { error } = await supabase
        .from('contract_types')
        .delete()
        .eq('id', type.id);

      if (error) {
        if (error.code === '23503') {
          toast.error('Tidak dapat menghapus: jenis kontrak masih digunakan');
          return;
        }
        throw error;
      }
      toast.success('Jenis kontrak berhasil dihapus');
      fetchTypes();
    } catch (error) {
      console.error('Error deleting contract type:', error);
      toast.error('Gagal menghapus jenis kontrak');
    }
  };

  const getCategoryBadge = (category) => {
    const colorMap = {
      EMPLOYEE: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      VENDOR: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      OTHER: 'bg-teal-500/10 text-teal-300 border-teal-500/20'
    };
    return colorMap[category] || 'bg-ink-500/10 text-ink-300 border-ink-500/20';
  };

  // Group by category
  const groupedTypes = {
    EMPLOYEE: types.filter(t => t.category === 'EMPLOYEE'),
    VENDOR: types.filter(t => t.category === 'VENDOR'),
    OTHER: types.filter(t => t.category === 'OTHER')
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Jenis Kontrak</h1>
          <p className="text-ink-400 text-sm mt-1">Kelola tipe kontrak untuk karyawan, vendor, dan lainnya</p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Tambah Jenis Kontrak
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            placeholder="Cari kode atau nama jenis kontrak..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-ink-400">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            Memuat data...
          </div>
        </div>
      ) : types.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderTree size={40} className="mx-auto text-ink-700 mb-3" />
          <p className="text-ink-400 text-sm">Belum ada jenis kontrak</p>
          {canManage && (
            <button
              onClick={openAdd}
              className="text-primary-400 hover:text-primary-300 text-sm font-medium mt-2"
            >
              Tambah jenis kontrak baru
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Object.entries(groupedTypes).map(([category, items]) => (
            <div key={category} className="card overflow-hidden">
              <div className={`px-4 py-3 border-b border-white/5 ${
                category === 'EMPLOYEE' ? 'bg-blue-500/5' :
                category === 'VENDOR' ? 'bg-purple-500/5' : 'bg-teal-500/5'
              }`}>
                <div className="flex items-center gap-2">
                  <FileText size={16} className={
                    category === 'EMPLOYEE' ? 'text-blue-400' :
                    category === 'VENDOR' ? 'text-purple-400' : 'text-teal-400'
                  } />
                  <h3 className="text-sm font-semibold text-white">
                    {CONTRACT_CATEGORY_LABELS[category] || category}
                  </h3>
                  <span className="text-xs text-ink-500 font-mono ml-auto">{items.length}</span>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {items.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-ink-500">Belum ada data</p>
                  </div>
                ) : items.map((type) => (
                  <div key={type.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">{type.type_name}</p>
                        {!type.is_active && (
                          <span className="text-[10px] text-ink-500 bg-ink-500/10 px-1 py-0.5 rounded">Nonaktif</span>
                        )}
                      </div>
                      <p className="text-xs text-ink-400 font-mono mt-0.5">{type.type_code}</p>
                      {type.description && (
                        <p className="text-xs text-ink-500 mt-0.5 truncate">{type.description}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(type)}
                          className="p-1.5 text-ink-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-md transition-all"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(type)}
                          className={`p-1.5 rounded-md transition-all ${
                            type.is_active
                              ? 'text-ink-400 hover:text-warning-300 hover:bg-warning-500/10'
                              : 'text-ink-400 hover:text-success-300 hover:bg-success-500/10'
                          }`}
                          title={type.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {type.is_active ? <X size={14} /> : <Plus size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(type)}
                          className="p-1.5 text-ink-400 hover:text-danger-300 hover:bg-danger-500/10 rounded-md transition-all"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="card max-w-lg w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? 'Edit Jenis Kontrak' : 'Tambah Jenis Kontrak'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-ink-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">
                    Kode <span className="text-danger-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.type_code}
                    onChange={(e) => setForm(prev => ({ ...prev, type_code: e.target.value }))}
                    placeholder="Contoh: EMP_PKWT"
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all font-mono uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-300 mb-1.5">
                    Kategori <span className="text-danger-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="appearance-none w-full px-3 py-2 pr-8 text-sm bg-white/5 border border-white/10 rounded-md text-white focus:outline-none focus:border-primary-500/50 cursor-pointer"
                    >
                      {Object.entries(CONTRACT_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value} className="bg-ink-900">{label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">
                  Nama Jenis Kontrak <span className="text-danger-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.type_name}
                  onChange={(e) => setForm(prev => ({ ...prev, type_name: e.target.value }))}
                  placeholder="Contoh: PKWT (Kontrak Waktu Tertentu)"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-300 mb-1.5">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Deskripsi jenis kontrak..."
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-md text-white placeholder:text-ink-500 focus:outline-none focus:border-primary-500/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-all resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded bg-white/5 border border-white/10 text-primary-500 focus:ring-primary-500"
                />
                <label htmlFor="is_active" className="text-sm text-ink-300">Aktif</label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-ink-300 hover:text-white hover:bg-white/5 rounded-md transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <Save size={16} />
                  {editingId ? 'Simpan Perubahan' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}