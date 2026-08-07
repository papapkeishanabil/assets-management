import { useState, useEffect, useCallback, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, RefreshCw, ChevronRight, FolderTree, X, Save, Info } from 'lucide-react';

export default function CategoriesPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    category_code: '',
    category_name: '',
    parent_category_id: '',
    description: '',
    display_order: 0,
    is_active: true
  });

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('asset_categories')
        .select('*, parent:parent_category_id(category_name)')
        .order('display_order', { ascending: true });

      if (search) {
        query = query.or(`category_name.ilike.%${search}%,category_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Gagal memuat data kategori');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_code || !form.category_name) {
      toast.error('Kode dan nama kategori wajib diisi');
      return;
    }

    try {
      let displayOrder = form.display_order;

      // Auto-assign sequential order for new child categories
      if (!editingId && form.parent_category_id) {
        const { data: siblings } = await supabase
          .from('asset_categories')
          .select('display_order')
          .eq('parent_category_id', form.parent_category_id)
          .order('display_order', { ascending: false })
          .limit(1);
        displayOrder = (siblings?.[0]?.display_order ?? 0) + 1;
      }

      const dataToSubmit = {
        ...form,
        display_order: displayOrder,
        parent_category_id: form.parent_category_id || null,
        created_by: profile?.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('asset_categories')
          .update(dataToSubmit)
          .eq('id', editingId);
        if (error) {
          if (error.code === '23505') {
            toast.error('Kode kategori sudah ada. Gunakan kode lain.');
            return;
          }
          throw error;
        }
        toast.success('Kategori berhasil diperbarui');
      } else {
        const { error } = await supabase
          .from('asset_categories')
          .insert([dataToSubmit]);
        if (error) {
          if (error.code === '23505') {
            toast.error('Kode kategori sudah ada. Gunakan kode lain.');
            return;
          }
          throw error;
        }
        toast.success('Kategori berhasil ditambahkan');
      }

      setShowModal(false);
      setEditingId(null);
      setForm({
        category_code: '',
        category_name: '',
        parent_category_id: '',
        description: '',
        display_order: 0,
        is_active: true
      });
      fetchCategories();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (category) => {
    setEditingId(category.id);
    setForm({
      category_code: category.category_code,
      category_name: category.category_name,
      parent_category_id: category.parent_category_id || '',
      description: category.description || '',
      display_order: category.display_order || 0,
      is_active: category.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    try {
      const { error } = await supabase
        .from('asset_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Kategori berhasil dihapus');
      fetchCategories();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const parentOptions = categories.filter(c => !c.parent_category_id);
  const parentCategories = categories.filter(c => !c.parent_category_id);
  const childCategories = categories.filter(c => c.parent_category_id);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Master Kategori Aset</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola hierarki kategori aset perusahaan</p>
        </div>
        <button onClick={fetchCategories} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search & Add */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari kode atau nama kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => { setEditingId(null); setForm({ category_code: '', category_name: '', parent_category_id: '', description: '', display_order: 0, is_active: true }); setShowModal(true); }} className="btn-primary text-sm whitespace-nowrap">
            <Plus size={14} />
            Tambah Kategori
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 dot-grid-bg opacity-20 pointer-events-none"></div>
        <div className="relative flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20 flex-shrink-0">
            <Info size={16} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Struktur Hierarki Kategori</h3>
            <p className="text-sm text-ink-300 leading-relaxed">
              <strong className="text-white">Kategori Utama</strong> (Parent) adalah kelompok besar seperti "Mesin Produksi" atau "Kendaraan Operasional".
              <strong className="text-white"> Sub-Kategori</strong> (Child) adalah jenis spesifik seperti "Mesin Jahit" atau "Mobil" yang masuk di bawah kategori utama.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FolderTree size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data kategori</h3>
            <p className="empty-state-text">Tambahkan kategori baru untuk mulai mengelompokkan aset</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Kategori</th>
                  <th>Kategori Induk</th>
                  <th>Urutan</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {parentCategories.map((parent) => (
                  <Fragment key={parent.id}>
                    <tr className="bg-white/[0.02]">
                      <td className="font-semibold text-white font-mono text-[13px]">{parent.category_code}</td>
                      <td className="font-semibold text-white">{parent.category_name}</td>
                      <td className="text-ink-500">-</td>
                      <td className="text-ink-300 font-mono tabular-nums">{parent.display_order}</td>
                      <td>
                        <span className={parent.is_active ? 'badge-green' : 'badge-gray'}>
                          {parent.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEdit(parent)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(parent.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {childCategories
                      .filter(child => child.parent_category_id === parent.id)
                      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                      .map((child) => (
                        <tr key={child.id}>
                          <td className="pl-10 text-ink-300 font-mono text-[13px]">{child.category_code}</td>
                          <td className="pl-10">
                            <div className="flex items-center gap-2 text-ink-200">
                              <ChevronRight size={14} className="text-ink-600" />
                              {child.category_name}
                            </div>
                          </td>
                          <td className="text-ink-400">{parent.category_name}</td>
                          <td className="text-ink-300 font-mono tabular-nums">{child.display_order}</td>
                          <td>
                            <span className={child.is_active ? 'badge-green' : 'badge-gray'}>
                              {child.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(child)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDelete(child.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <FolderTree size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Kode Kategori <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={form.category_code} onChange={(e) => setForm({...form, category_code: e.target.value})} required />
              </div>
              <div>
                <label className="label">Nama Kategori <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={form.category_name} onChange={(e) => setForm({...form, category_name: e.target.value})} required />
              </div>
              <div>
                <label className="label">Kategori Induk</label>
                <select className="input" value={form.parent_category_id} onChange={(e) => setForm({...form, parent_category_id: e.target.value})}>
                  <option value="">Tidak ada (Kategori Utama)</option>
                  {parentOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.category_name}</option>
                  ))}
                </select>
                <p className="text-xs text-ink-500 mt-1.5">Biarkan kosong jika ini adalah kategori utama</p>
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea className="input" rows="3" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}></textarea>
              </div>
              <div>
                <label className="label">Urutan Tampilan</label>
                <input type="number" className="input" value={form.display_order} onChange={(e) => setForm({...form, display_order: parseInt(e.target.value) || 0})} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                Aktif
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="btn-secondary">Batal</button>
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
