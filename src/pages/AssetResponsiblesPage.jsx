import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Plus, Edit, Ban, Search, RefreshCw, UserCheck, X, Save } from 'lucide-react';

const emptyForm = {
  responsible_code: '',
  responsible_name: '',
  role_title: '',
  department_id: '',
  sub_department_id: '',
  user_profile_id: '',
  phone: '',
  notes: '',
  is_active: true
};

export default function AssetResponsiblesPage() {
  const { profile } = useAuth();
  const [responsibles, setResponsibles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const fetchMasterData = useCallback(async () => {
    const [deptRes, subDeptRes, userRes] = await Promise.all([
      supabase.from('departments').select('id, department_name').eq('is_active', true).order('department_name'),
      supabase.from('sub_departments').select('id, department_id, sub_department_name').eq('is_active', true).order('sub_department_name'),
      supabase.from('user_profiles').select('id, full_name, position').eq('account_status', 'ACTIVE').order('full_name')
    ]);

    if (deptRes.data) setDepartments(deptRes.data);
    if (subDeptRes.data) setSubDepartments(subDeptRes.data);
    if (userRes.data) setUsers(userRes.data);
  }, []);

  const fetchResponsibles = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('asset_responsibles')
        .select('*')
        .order('responsible_name', { ascending: true });

      if (search) {
        query = query.or(`responsible_name.ilike.%${search}%,responsible_code.ilike.%${search}%,role_title.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setResponsibles(data || []);
    } catch (error) {
      console.error('Error fetching asset responsibles:', error);
      toast.error('Gagal memuat data penanggung jawab');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  useEffect(() => {
    fetchResponsibles();
  }, [fetchResponsibles]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.responsible_code.trim() || !form.responsible_name.trim()) {
      toast.error('Kode dan nama penanggung jawab wajib diisi');
      return;
    }

    try {
      const payload = {
        ...form,
        responsible_code: form.responsible_code.trim().toUpperCase(),
        responsible_name: form.responsible_name.trim(),
        role_title: form.role_title.trim() || null,
        department_id: form.department_id || null,
        sub_department_id: form.sub_department_id || null,
        user_profile_id: form.user_profile_id || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        created_by: profile?.id
      };

      if (editingId) {
        const { error } = await supabase.from('asset_responsibles').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Penanggung jawab berhasil diperbarui');
      } else {
        const { error } = await supabase.from('asset_responsibles').insert([payload]);
        if (error) throw error;
        toast.success('Penanggung jawab berhasil ditambahkan');
      }

      setShowModal(false);
      resetForm();
      fetchResponsibles();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      responsible_code: item.responsible_code,
      responsible_name: item.responsible_name,
      role_title: item.role_title || '',
      department_id: item.department_id || '',
      sub_department_id: item.sub_department_id || '',
      user_profile_id: item.user_profile_id || '',
      phone: item.phone || '',
      notes: item.notes || '',
      is_active: item.is_active
    });
    setShowModal(true);
  };

  const handleDeactivate = async (item) => {
    if (!confirm(`Nonaktifkan "${item.responsible_name}"? Data historis aset tetap aman.`)) return;
    try {
      const { error } = await supabase
        .from('asset_responsibles')
        .update({ is_active: false })
        .eq('id', item.id);
      if (error) throw error;
      toast.success('Penanggung jawab berhasil dinonaktifkan');
      fetchResponsibles();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const selectedDepartmentSubDepartments = subDepartments.filter((item) => item.department_id === form.department_id);
  const getDepartmentName = (id) => departments.find((item) => item.id === id)?.department_name || '-';
  const getSubDepartmentName = (id) => subDepartments.find((item) => item.id === id)?.sub_department_name || '-';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Penanggung Jawab Aset</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola supervisor, operator, dan PIC aset</p>
        </div>
        <button onClick={fetchResponsibles} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari kode, nama, atau jabatan..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary text-sm whitespace-nowrap">
            <Plus size={14} />
            Tambah Penanggung Jawab
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : responsibles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><UserCheck size={48} /></div>
            <h3 className="empty-state-title">Belum ada penanggung jawab</h3>
            <p className="empty-state-text">Tambahkan supervisor, operator, atau PIC aset</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Jabatan/Peran</th>
                  <th>Departemen</th>
                  <th>Subdepartemen</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {responsibles.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-[13px] text-white">{item.responsible_code}</td>
                    <td className="font-medium text-white">{item.responsible_name}</td>
                    <td className="text-ink-400">{item.role_title || '-'}</td>
                    <td className="text-ink-400">{getDepartmentName(item.department_id)}</td>
                    <td className="text-ink-400">{getSubDepartmentName(item.sub_department_id)}</td>
                    <td>
                      <span className={item.is_active ? 'badge-green' : 'badge-gray'}>
                        {item.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(item)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit"><Edit size={14} /></button>
                        {item.is_active && (
                          <button onClick={() => handleDeactivate(item)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all" title="Nonaktifkan"><Ban size={14} /></button>
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
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <UserCheck size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Penanggung Jawab' : 'Tambah Penanggung Jawab'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Kode <span className="text-danger-400">*</span></label>
                  <input className="input font-mono uppercase" value={form.responsible_code} onChange={(event) => setForm({ ...form, responsible_code: event.target.value })} placeholder="Contoh: SPV-BORDIR" required />
                </div>
                <div>
                  <label className="label">Nama <span className="text-danger-400">*</span></label>
                  <input className="input" value={form.responsible_name} onChange={(event) => setForm({ ...form, responsible_name: event.target.value })} placeholder="Contoh: Supervisor Bordir" required />
                </div>
                <div>
                  <label className="label">Jabatan / Peran</label>
                  <input className="input" value={form.role_title} onChange={(event) => setForm({ ...form, role_title: event.target.value })} placeholder="Contoh: Operator Bordir" />
                </div>
                <div>
                  <label className="label">Akun Login Terkait</label>
                  <select className="input" value={form.user_profile_id} onChange={(event) => setForm({ ...form, user_profile_id: event.target.value })}>
                    <option value="">Tidak ditautkan</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.full_name}{user.position ? ` - ${user.position}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Departemen</label>
                  <select
                    className="input"
                    value={form.department_id}
                    onChange={(event) => setForm({ ...form, department_id: event.target.value, sub_department_id: '' })}
                  >
                    <option value="">Pilih departemen...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Subdepartemen</label>
                  <select className="input" value={form.sub_department_id} onChange={(event) => setForm({ ...form, sub_department_id: event.target.value })} disabled={!form.department_id}>
                    <option value="">{form.department_id ? 'Pilih subdepartemen...' : 'Pilih departemen dulu'}</option>
                    {selectedDepartmentSubDepartments.map((subDept) => (
                      <option key={subDept.id} value={subDept.id}>{subDept.sub_department_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Kontak</label>
                  <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200 md:self-end md:pb-2">
                  <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                  Aktif
                </label>
                <div className="md:col-span-2">
                  <label className="label">Catatan</label>
                  <textarea className="input" rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })}></textarea>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary">Batal</button>
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
