import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, RefreshCw, Building2, X, Save } from 'lucide-react';

export default function DepartmentsPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    department_code: '',
    department_name: '',
    description: '',
    is_active: true
  });

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('departments')
        .select('*')
        .order('department_name', { ascending: true });

      if (search) {
        query = query.or(`department_name.ilike.%${search}%,department_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Gagal memuat data departemen');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.department_code || !form.department_name) {
      toast.error('Kode dan nama departemen wajib diisi');
      return;
    }

    try {
      const dataToSubmit = { ...form, created_by: profile?.id };

      if (editingId) {
        const { error } = await supabase.from('departments').update(dataToSubmit).eq('id', editingId);
        if (error) throw error;
        toast.success('Departemen berhasil diperbarui');
      } else {
        const { error } = await supabase.from('departments').insert([dataToSubmit]);
        if (error) throw error;
        toast.success('Departemen berhasil ditambahkan');
      }

      setShowModal(false);
      setEditingId(null);
      setForm({ department_code: '', department_name: '', description: '', is_active: true });
      fetchDepartments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (dept) => {
    setEditingId(dept.id);
    setForm({
      department_code: dept.department_code,
      department_name: dept.department_name,
      description: dept.description || '',
      is_active: dept.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus departemen ini?')) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Departemen berhasil dihapus');
      fetchDepartments();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Master Departemen</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola daftar departemen perusahaan</p>
        </div>
        <button onClick={fetchDepartments} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input type="text" className="input pl-9" placeholder="Cari kode atau nama departemen..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={() => { setEditingId(null); setForm({ department_code: '', department_name: '', description: '', is_active: true }); setShowModal(true); }} className="btn-primary text-sm whitespace-nowrap">
            <Plus size={14} />
            Tambah Departemen
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Building2 size={48} /></div>
            <h3 className="empty-state-title">Tidak ada data departemen</h3>
            <p className="empty-state-text">Tambahkan departemen baru untuk mulai mengelompokkan pengguna</p>
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
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td className="font-mono text-[13px] text-white">{dept.department_code}</td>
                    <td className="font-medium text-white">{dept.department_name}</td>
                    <td className="text-ink-400">{dept.description || '-'}</td>
                    <td>
                      <span className={dept.is_active ? 'badge-green' : 'badge-gray'}>
                        {dept.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(dept)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit"><Edit size={14} /></button>
                        <button onClick={() => handleDelete(dept.id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Hapus"><Trash2 size={14} /></button>
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
                  <Building2 size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Departemen' : 'Tambah Departemen'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Kode Departemen <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={form.department_code} onChange={(e) => setForm({...form, department_code: e.target.value})} required />
              </div>
              <div>
                <label className="label">Nama Departemen <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={form.department_name} onChange={(e) => setForm({...form, department_name: e.target.value})} required />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea className="input" rows="3" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})}></textarea>
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
