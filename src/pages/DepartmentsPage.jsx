import { Fragment, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Plus, Edit, Ban, Search, RefreshCw, Building2, X, Save,
  ChevronRight, Info, Network
} from 'lucide-react';

const emptyDivisionForm = {
  division_code: '',
  division_name: '',
  description: '',
  is_active: true
};

const emptyDepartmentForm = {
  division_id: '',
  department_code: '',
  department_name: '',
  description: '',
  is_active: true
};

const emptySubDepartmentForm = {
  department_id: '',
  sub_department_code: '',
  sub_department_name: '',
  is_active: true
};

export default function DepartmentsPage() {
  const { profile } = useAuth();
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);

  const [editingDivisionId, setEditingDivisionId] = useState(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [editingSubId, setEditingSubId] = useState(null);

  const [divisionForm, setDivisionForm] = useState(emptyDivisionForm);
  const [departmentForm, setDepartmentForm] = useState(emptyDepartmentForm);
  const [subForm, setSubForm] = useState(emptySubDepartmentForm);

  const fetchOrganization = useCallback(async () => {
    setLoading(true);
    try {
      const [divisionResult, departmentResult, subDepartmentResult] = await Promise.all([
        supabase.from('divisions').select('*').order('division_name', { ascending: true }),
        supabase.from('departments').select('*').order('department_name', { ascending: true }),
        supabase.from('sub_departments').select('*').order('sub_department_name', { ascending: true })
      ]);

      if (divisionResult.error) throw divisionResult.error;
      if (departmentResult.error) throw departmentResult.error;
      if (subDepartmentResult.error) throw subDepartmentResult.error;

      setDivisions(divisionResult.data || []);
      setDepartments(departmentResult.data || []);
      setSubDepartments(subDepartmentResult.data || []);
    } catch (error) {
      console.error('Error fetching organization structure:', error);
      toast.error('Gagal memuat struktur organisasi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const searchTerm = search.trim().toLowerCase();
  const activeDivisions = divisions.filter((division) => division.is_active);
  const activeDepartments = departments.filter((department) => department.is_active);

  const getDepartmentsByDivision = (divisionId) => departments.filter((dept) => {
    if (!divisionId) return !dept.division_id;
    return dept.division_id === divisionId;
  });

  const getSubDepartments = (departmentId) => subDepartments.filter((subDept) => subDept.department_id === departmentId);

  const textMatches = (...values) => values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(searchTerm);

  const divisionMatches = (division) => textMatches(division.division_code, division.division_name, division.description);
  const departmentMatches = (dept) => textMatches(dept.department_code, dept.department_name, dept.description);
  const subDepartmentMatches = (subDept) => textMatches(subDept.sub_department_code, subDept.sub_department_name);

  const departmentTreeMatches = (dept) => (
    departmentMatches(dept) || getSubDepartments(dept.id).some(subDepartmentMatches)
  );

  const getVisibleDepartmentsByDivision = (division) => getDepartmentsByDivision(division.id).filter((dept) => {
    if (!searchTerm) return true;
    return divisionMatches(division) || departmentTreeMatches(dept);
  });

  const visibleDivisions = divisions.filter((division) => {
    if (!searchTerm) return true;
    return divisionMatches(division) || getDepartmentsByDivision(division.id).some(departmentTreeMatches);
  });

  const visibleUnassignedDepartments = getDepartmentsByDivision(null).filter((dept) => {
    if (!searchTerm) return true;
    return departmentTreeMatches(dept);
  });

  const hasAnyRows = visibleDivisions.length > 0 || visibleUnassignedDepartments.length > 0;

  const closeDivisionModal = () => {
    setShowDivisionModal(false);
    setEditingDivisionId(null);
    setDivisionForm(emptyDivisionForm);
  };

  const closeDepartmentModal = () => {
    setShowDepartmentModal(false);
    setEditingDepartmentId(null);
    setDepartmentForm(emptyDepartmentForm);
  };

  const closeSubModal = () => {
    setShowSubModal(false);
    setEditingSubId(null);
    setSubForm(emptySubDepartmentForm);
  };

  const handleDivisionSubmit = async (e) => {
    e.preventDefault();
    if (!divisionForm.division_code || !divisionForm.division_name) {
      toast.error('Kode dan nama divisi wajib diisi');
      return;
    }

    try {
      const payload = {
        ...divisionForm,
        division_code: divisionForm.division_code.trim().toUpperCase(),
        division_name: divisionForm.division_name.trim(),
        description: divisionForm.description.trim() || null,
        created_by: profile?.id
      };

      if (editingDivisionId) {
        const { error } = await supabase
          .from('divisions')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingDivisionId);
        if (error) throw error;
        toast.success('Divisi berhasil diperbarui');
      } else {
        const { error } = await supabase.from('divisions').insert([payload]);
        if (error) throw error;
        toast.success('Divisi berhasil ditambahkan');
      }

      closeDivisionModal();
      fetchOrganization();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    if (!departmentForm.department_code || !departmentForm.department_name) {
      toast.error('Kode dan nama departemen wajib diisi');
      return;
    }

    try {
      const payload = {
        ...departmentForm,
        division_id: departmentForm.division_id || null,
        department_code: departmentForm.department_code.trim().toUpperCase(),
        department_name: departmentForm.department_name.trim(),
        description: departmentForm.description.trim() || null,
        created_by: profile?.id
      };

      if (editingDepartmentId) {
        const { error } = await supabase
          .from('departments')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingDepartmentId);
        if (error) throw error;
        toast.success('Departemen berhasil diperbarui');
      } else {
        const { error } = await supabase.from('departments').insert([payload]);
        if (error) throw error;
        toast.success('Departemen berhasil ditambahkan');
      }

      closeDepartmentModal();
      fetchOrganization();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSubSubmit = async (e) => {
    e.preventDefault();
    if (!subForm.department_id || !subForm.sub_department_code || !subForm.sub_department_name) {
      toast.error('Departemen, kode, dan nama subdepartemen wajib diisi');
      return;
    }

    try {
      const payload = {
        ...subForm,
        sub_department_code: subForm.sub_department_code.trim().toUpperCase(),
        sub_department_name: subForm.sub_department_name.trim()
      };

      if (editingSubId) {
        const { error } = await supabase
          .from('sub_departments')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingSubId);
        if (error) throw error;
        toast.success('Subdepartemen berhasil diperbarui');
      } else {
        const { error } = await supabase.from('sub_departments').insert([payload]);
        if (error) throw error;
        toast.success('Subdepartemen berhasil ditambahkan');
      }

      closeSubModal();
      fetchOrganization();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDivisionEdit = (division) => {
    setEditingDivisionId(division.id);
    setDivisionForm({
      division_code: division.division_code,
      division_name: division.division_name,
      description: division.description || '',
      is_active: division.is_active
    });
    setShowDivisionModal(true);
  };

  const handleDepartmentEdit = (dept) => {
    setEditingDepartmentId(dept.id);
    setDepartmentForm({
      division_id: dept.division_id || '',
      department_code: dept.department_code,
      department_name: dept.department_name,
      description: dept.description || '',
      is_active: dept.is_active
    });
    setShowDepartmentModal(true);
  };

  const handleSubEdit = (subDept) => {
    setEditingSubId(subDept.id);
    setSubForm({
      department_id: subDept.department_id,
      sub_department_code: subDept.sub_department_code,
      sub_department_name: subDept.sub_department_name,
      is_active: subDept.is_active
    });
    setShowSubModal(true);
  };

  const deactivateRecord = async ({ table, id, label, successMessage }) => {
    if (!confirm(`Nonaktifkan "${label}"? Data lama tetap aman, tetapi tidak akan muncul sebagai pilihan aktif.`)) return;

    try {
      const { error } = await supabase
        .from(table)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success(successMessage);
      fetchOrganization();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const renderStatus = (isActive) => (
    <span className={isActive ? 'badge-green' : 'badge-gray'}>
      {isActive ? 'Aktif' : 'Nonaktif'}
    </span>
  );

  const renderSubRows = (dept, parentMatched = false) => {
    const visibleSubDepartments = getSubDepartments(dept.id).filter((subDept) => {
      if (!searchTerm || parentMatched || departmentMatches(dept)) return true;
      return subDepartmentMatches(subDept);
    });

    return visibleSubDepartments.map((subDept) => (
      <tr key={subDept.id} className="bg-white/[0.01]">
        <td className="pl-14">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-ink-300">
            <ChevronRight size={12} />
            Subdepartemen
          </span>
        </td>
        <td className="text-ink-300 font-mono text-[13px]">{subDept.sub_department_code}</td>
        <td>
          <div className="flex items-center gap-2 text-ink-200 pl-6 border-l border-primary-500/20">
            {subDept.sub_department_name}
          </div>
        </td>
        <td className="text-ink-400">{dept.department_name}</td>
        <td className="text-ink-500 text-xs">Unit kerja di bawah departemen {dept.department_name}</td>
        <td>{renderStatus(subDept.is_active)}</td>
        <td className="text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => handleSubEdit(subDept)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
              <Edit size={14} />
            </button>
            {subDept.is_active && (
              <button
                onClick={() => deactivateRecord({
                  table: 'sub_departments',
                  id: subDept.id,
                  label: subDept.sub_department_name,
                  successMessage: 'Subdepartemen berhasil dinonaktifkan'
                })}
                className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all"
                title="Nonaktifkan"
              >
                <Ban size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
    ));
  };

  const renderDepartmentRows = (deptList, division = null) => deptList.map((dept) => {
    const parentMatched = division ? divisionMatches(division) : false;
    return (
      <Fragment key={dept.id}>
        <tr className="bg-primary-500/[0.025]">
          <td className="pl-8">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary-500/10 border border-primary-500/20 text-primary-300">
              <ChevronRight size={12} />
              Departemen
            </span>
          </td>
          <td className="font-semibold text-white font-mono text-[13px]">{dept.department_code}</td>
          <td>
            <div className="flex items-center gap-2 font-semibold text-white pl-4 border-l border-primary-500/30">
              {dept.department_name}
            </div>
          </td>
          <td className="text-ink-400">{division?.division_name || 'Tanpa divisi'}</td>
          <td className="text-ink-400">{dept.description || '-'}</td>
          <td>{renderStatus(dept.is_active)}</td>
          <td className="text-right">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => handleDepartmentEdit(dept)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                <Edit size={14} />
              </button>
              {dept.is_active && (
                <button
                  onClick={() => deactivateRecord({
                    table: 'departments',
                    id: dept.id,
                    label: dept.department_name,
                    successMessage: 'Departemen berhasil dinonaktifkan'
                  })}
                  className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all"
                  title="Nonaktifkan"
                >
                  <Ban size={14} />
                </button>
              )}
            </div>
          </td>
        </tr>
        {renderSubRows(dept, parentMatched)}
      </Fragment>
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Struktur Organisasi</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola Divisi, Departemen, dan Subdepartemen perusahaan</p>
        </div>
        <button onClick={fetchOrganization} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari divisi, departemen, atau subdepartemen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => { setEditingDivisionId(null); setDivisionForm(emptyDivisionForm); setShowDivisionModal(true); }}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            <Plus size={14} />
            Tambah Divisi
          </button>
          <button
            onClick={() => { setEditingDepartmentId(null); setDepartmentForm(emptyDepartmentForm); setShowDepartmentModal(true); }}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            <Plus size={14} />
            Tambah Departemen
          </button>
          <button
            onClick={() => { setEditingSubId(null); setSubForm(emptySubDepartmentForm); setShowSubModal(true); }}
            className="btn-primary text-sm whitespace-nowrap"
          >
            <Plus size={14} />
            Tambah Subdepartemen
          </button>
        </div>
      </div>

      <div className="card relative overflow-hidden">
        <div className="absolute inset-0 dot-grid-bg opacity-20 pointer-events-none"></div>
        <div className="relative flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20 flex-shrink-0">
            <Info size={16} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Konsep Hierarki</h3>
            <p className="text-sm text-ink-300 leading-relaxed">
              <strong className="text-white">Produksi</strong> sekarang disebut <strong className="text-white">Divisi</strong>.
              Di bawah Divisi ada <strong className="text-white">Departemen</strong> seperti Project Production dan Stock Production.
              Di bawah Departemen ada <strong className="text-white">Subdepartemen</strong> seperti Project Production QC atau Stock Production QC.
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : !hasAnyRows ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Network size={48} /></div>
            <h3 className="empty-state-title">Tidak ada struktur organisasi</h3>
            <p className="empty-state-text">Tambahkan divisi, departemen, atau subdepartemen untuk mulai mengelompokkan pengguna</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipe</th>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Induk</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleDivisions.map((division) => {
                  const visibleDepartments = getVisibleDepartmentsByDivision(division);
                  return (
                    <Fragment key={division.id}>
                      <tr className="bg-indigo-500/[0.08] border-t border-indigo-500/15">
                        <td>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                            <Building2 size={12} />
                            Divisi
                          </span>
                        </td>
                        <td className="font-semibold text-white font-mono text-[13px]">{division.division_code}</td>
                        <td className="font-semibold text-white">{division.division_name}</td>
                        <td className="text-ink-500">Level induk</td>
                        <td className="text-ink-400">{division.description || '-'}</td>
                        <td>{renderStatus(division.is_active)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleDivisionEdit(division)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all" title="Edit">
                              <Edit size={14} />
                            </button>
                            {division.is_active && (
                              <button
                                onClick={() => deactivateRecord({
                                  table: 'divisions',
                                  id: division.id,
                                  label: division.division_name,
                                  successMessage: 'Divisi berhasil dinonaktifkan'
                                })}
                                className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all"
                                title="Nonaktifkan"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {renderDepartmentRows(visibleDepartments, division)}
                    </Fragment>
                  );
                })}

                {visibleUnassignedDepartments.length > 0 && (
                  <>
                    <tr className="bg-white/[0.03] border-t border-white/10">
                      <td colSpan={7} className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                        Departemen tanpa Divisi
                      </td>
                    </tr>
                    {renderDepartmentRows(visibleUnassignedDepartments)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDivisionModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Building2 size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingDivisionId ? 'Edit Divisi' : 'Tambah Divisi'}</h3>
              </div>
              <button onClick={closeDivisionModal} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDivisionSubmit} className="space-y-4">
              <div>
                <label className="label">Kode Divisi <span className="text-danger-400">*</span></label>
                <input type="text" className="input font-mono uppercase" value={divisionForm.division_code} onChange={(e) => setDivisionForm({ ...divisionForm, division_code: e.target.value })} required />
              </div>
              <div>
                <label className="label">Nama Divisi <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={divisionForm.division_name} onChange={(e) => setDivisionForm({ ...divisionForm, division_name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea className="input" rows="3" value={divisionForm.description} onChange={(e) => setDivisionForm({ ...divisionForm, description: e.target.value })}></textarea>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200">
                <input type="checkbox" checked={divisionForm.is_active} onChange={(e) => setDivisionForm({ ...divisionForm, is_active: e.target.checked })} className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                Aktif
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeDivisionModal} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">
                  <Save size={14} />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDepartmentModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Building2 size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingDepartmentId ? 'Edit Departemen' : 'Tambah Departemen'}</h3>
              </div>
              <button onClick={closeDepartmentModal} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDepartmentSubmit} className="space-y-4">
              <div>
                <label className="label">Divisi</label>
                <select className="input" value={departmentForm.division_id} onChange={(e) => setDepartmentForm({ ...departmentForm, division_id: e.target.value })}>
                  <option value="">Tanpa divisi</option>
                  {activeDivisions.map((division) => (
                    <option key={division.id} value={division.id}>{division.division_name}</option>
                  ))}
                </select>
                <p className="text-xs text-ink-500 mt-1">Contoh: Project Production berada di bawah Divisi Produksi.</p>
              </div>
              <div>
                <label className="label">Kode Departemen <span className="text-danger-400">*</span></label>
                <input type="text" className="input font-mono uppercase" value={departmentForm.department_code} onChange={(e) => setDepartmentForm({ ...departmentForm, department_code: e.target.value })} required />
              </div>
              <div>
                <label className="label">Nama Departemen <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={departmentForm.department_name} onChange={(e) => setDepartmentForm({ ...departmentForm, department_name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Deskripsi</label>
                <textarea className="input" rows="3" value={departmentForm.description} onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}></textarea>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200">
                <input type="checkbox" checked={departmentForm.is_active} onChange={(e) => setDepartmentForm({ ...departmentForm, is_active: e.target.checked })} className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                Aktif
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeDepartmentModal} className="btn-secondary">Batal</button>
                <button type="submit" className="btn-primary">
                  <Save size={14} />
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Building2 size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{editingSubId ? 'Edit Subdepartemen' : 'Tambah Subdepartemen'}</h3>
              </div>
              <button onClick={closeSubModal} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubSubmit} className="space-y-4">
              <div>
                <label className="label">Departemen <span className="text-danger-400">*</span></label>
                <select className="input" value={subForm.department_id} onChange={(e) => setSubForm({ ...subForm, department_id: e.target.value })} required>
                  <option value="">Pilih departemen...</option>
                  {activeDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.department_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Kode Subdepartemen <span className="text-danger-400">*</span></label>
                <input type="text" className="input font-mono uppercase" value={subForm.sub_department_code} onChange={(e) => setSubForm({ ...subForm, sub_department_code: e.target.value })} required />
              </div>
              <div>
                <label className="label">Nama Subdepartemen <span className="text-danger-400">*</span></label>
                <input type="text" className="input" value={subForm.sub_department_name} onChange={(e) => setSubForm({ ...subForm, sub_department_name: e.target.value })} required />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-200">
                <input type="checkbox" checked={subForm.is_active} onChange={(e) => setSubForm({ ...subForm, is_active: e.target.checked })} className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500/30" />
                Aktif
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeSubModal} className="btn-secondary">Batal</button>
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
