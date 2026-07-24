import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, ROLE_OPTIONS, ACCOUNT_STATUS_LABELS, ACCOUNT_STATUS, formatDateTime } from '../lib/constants';
import toast from 'react-hot-toast';
import { Search, Filter, Check, X, Ban, RotateCcw, Shield, RefreshCw, UserPlus, Eye, EyeOff, ChevronDown } from 'lucide-react';

export default function UsersPage() {
  const { refreshProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateRoleOptions, setShowCreateRoleOptions] = useState(false);
  const [showCreateDepartmentOptions, setShowCreateDepartmentOptions] = useState(false);
  const [showCreateSubDepartmentOptions, setShowCreateSubDepartmentOptions] = useState(false);
  const [showEditRoleOptions, setShowEditRoleOptions] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
    department_id: '',
    sub_department_id: '',
    position: '',
    role: 'pelaksana'
  });

  const closeCreateModal = (force = false) => {
    if (createLoading && !force) return;
    setShowCreateModal(false);
    setShowCreatePassword(false);
    setShowCreateRoleOptions(false);
    setShowCreateDepartmentOptions(false);
    setShowCreateSubDepartmentOptions(false);
    setCreateForm({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      department: '',
      department_id: '',
      sub_department_id: '',
      position: '',
      role: 'pelaksana'
    });
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (createForm.password.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }

    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: createForm
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Gagal membuat pengguna');

      toast.success(`Akun ${createForm.full_name} berhasil dibuat dan sudah aktif`);
      closeCreateModal(true);
      await fetchUsers();
    } catch (error) {
      let message = error.message || 'Gagal membuat pengguna';
      if (error.context) {
        try {
          const payload = await error.context.json();
          message = payload?.error || message;
        } catch {
          // Response bukan JSON; gunakan pesan standar.
        }
      }
      toast.error(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('account_status', filterStatus);
      }
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch roles separately to avoid ambiguous relationship error
      const userIds = data?.map(u => u.id) || [];
      let rolesMap = {};
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role_name')
          .in('user_id', userIds);
        if (roles) {
          roles.forEach(r => {
            rolesMap[r.user_id] = r.role_name;
          });
        }
      }

      // Attach role to each user
      const usersWithRoles = data?.map(u => ({
        ...u,
        role_name: rolesMap[u.id] || null
      })) || [];

      // Apply role filter after fetching
      let filteredUsers = usersWithRoles;
      if (filterRole !== 'all') {
        filteredUsers = usersWithRoles.filter(u => u.role_name === filterRole);
      }

      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Gagal memuat data pengguna');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterRole]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchDepartments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, department_name, department_code')
        .eq('is_active', true)
        .order('department_name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Gagal memuat daftar departemen');
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const fetchSubDepartments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sub_departments')
        .select('id, department_id, sub_department_name, sub_department_code')
        .eq('is_active', true)
        .order('sub_department_name', { ascending: true });

      if (error) throw error;
      setSubDepartments(data || []);
    } catch (error) {
      console.error('Error fetching sub departments:', error);
      toast.error('Gagal memuat daftar subdepartemen');
    }
  }, []);

  useEffect(() => {
    fetchSubDepartments();
  }, [fetchSubDepartments]);

  const handleAction = async (userId, action) => {
    setActionLoading(userId);
    try {
      let updates = {};

      switch (action) {
        case 'approve':
          updates = { account_status: ACCOUNT_STATUS.ACTIVE, approved_at: new Date().toISOString() };
          break;
        case 'reject':
          updates = { account_status: ACCOUNT_STATUS.REJECTED };
          break;
        case 'activate':
          updates = { account_status: ACCOUNT_STATUS.ACTIVE };
          break;
        case 'disable':
          updates = { account_status: ACCOUNT_STATUS.DISABLED };
          break;
        default:
          break;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;

      toast.success('Status akun berhasil diperbarui');
      await refreshProfile();
      fetchUsers();
      setShowConfirm(null);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async () => {
    if (!showRoleModal || !newRole) return;
    setActionLoading(showRoleModal.id);
    try {
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('role_name', newRole)
        .single();

      if (!roleData) throw new Error('Role tidak ditemukan');

      const { error } = await supabase
        .from('user_profiles')
        .update({ role_id: roleData.id })
        .eq('id', showRoleModal.id);

      if (error) throw error;

      toast.success(`Role ${showRoleModal.full_name} diubah ke ${ROLE_LABELS[newRole]}`);
      fetchUsers();
      setShowRoleModal(null);
      setShowEditRoleOptions(false);
      setNewRole('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const classes = {
      PENDING: 'badge-yellow',
      ACTIVE: 'badge-green',
      REJECTED: 'badge-red',
      DISABLED: 'badge-gray'
    };
    return classes[status] || 'badge-gray';
  };

  const getRoleLabel = (roleName) => ROLE_LABELS[roleName] || roleName || 'Pilih role';

  const getDepartmentLabel = (departmentName) => departmentName || 'Pilih departemen';

  const selectedDepartment = departments.find((dept) => dept.id === createForm.department_id);
  const selectedSubDepartment = subDepartments.find((sub) => sub.id === createForm.sub_department_id);
  const availableSubDepartments = subDepartments.filter((sub) => sub.department_id === createForm.department_id);

  const getUserDepartmentDisplay = (user) => {
    const department = departments.find((dept) => dept.id === user.department_id);
    const subDepartment = subDepartments.find((sub) => sub.id === user.sub_department_id);
    const departmentName = department?.department_name || user.department;

    if (!departmentName && !subDepartment) return '-';
    if (departmentName && subDepartment) return `${departmentName} / ${subDepartment.sub_department_name}`;
    return departmentName || subDepartment?.sub_department_name || '-';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Manajemen Pengguna</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola pengguna, role, dan status akun</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm">
            <UserPlus size={15} />
            Tambah Pengguna
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
              <select
                className="input pl-9 pr-8"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Semua Status</option>
                {Object.entries(ACCOUNT_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="relative group">
              <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 group-focus-within:text-primary-400 transition-colors pointer-events-none" />
              <select
                className="input pl-9 pr-8"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">Semua Role</option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-white/5 rounded-md animate-pulse"></div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Shield size={48} /></div>
            <h3 className="empty-state-title">Tidak ada pengguna ditemukan</h3>
            <p className="empty-state-text">Coba sesuaikan pencarian atau filter Anda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Bergabung</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="hover-card">
                    <td>
                      <div className="font-medium text-white">{user.full_name}</div>
                      <div className="text-xs text-ink-400">{getUserDepartmentDisplay(user)}</div>
                    </td>
                    <td className="text-sm text-ink-200 font-mono text-[12px]">{user.email}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-500/10 border border-primary-500/20 text-primary-400">
                        <Shield size={12} />
                        {ROLE_LABELS[user.role_name] || '-'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(user.account_status)}`}>
                        {ACCOUNT_STATUS_LABELS[user.account_status] || user.account_status}
                      </span>
                    </td>
                    <td className="text-sm text-ink-400">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* PENDING actions */}
                        {user.account_status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => setShowConfirm({ id: user.id, action: 'approve', name: user.full_name })}
                              className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all"
                              title="Setujui"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setShowConfirm({ id: user.id, action: 'reject', name: user.full_name })}
                              className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md transition-all"
                              title="Tolak"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}

                        {/* ACTIVE/REJECTED/DISABLED actions */}
                        {user.account_status !== 'PENDING' && (
                          <>
                            {user.account_status === 'ACTIVE' ? (
                              <button
                                onClick={() => setShowConfirm({ id: user.id, action: 'disable', name: user.full_name })}
                                className="p-1.5 text-orange-400 hover:bg-orange-500/10 rounded-md transition-all"
                                title="Nonaktifkan"
                              >
                                <Ban size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => setShowConfirm({ id: user.id, action: 'activate', name: user.full_name })}
                                className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md transition-all"
                                title="Aktifkan"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </>
                        )}

                        {/* Change Role */}
                        <button
                          onClick={() => {
                            setShowRoleModal(user);
                            setNewRole(user.role_name || '');
                            setShowEditRoleOptions(false);
                          }}
                          className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md transition-all"
                          title="Ubah Role"
                        >
                          <Shield size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <UserPlus size={18} className="text-primary-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Tambah Pengguna</h3>
                  <p className="text-xs text-ink-400">Akun langsung aktif dan dapat digunakan untuk login.</p>
                </div>
              </div>
              <button onClick={() => closeCreateModal()} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nama Lengkap <span className="text-danger-400">*</span></label>
                  <input className="input" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Email <span className="text-danger-400">*</span></label>
                  <input type="email" className="input" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required autoComplete="off" />
                </div>
                <div>
                  <label className="label">Password Awal <span className="text-danger-400">*</span></label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      className="input pr-11"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowCreatePassword(!showCreatePassword)} className="absolute inset-y-0 right-0 px-3 text-ink-500 hover:text-ink-200">
                      {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">Minimal 8 karakter.</p>
                </div>
                <div>
                  <label className="label">Role <span className="text-danger-400">*</span></label>
                  <div className="relative">
                    <button
                      type="button"
                      className="input flex items-center justify-between text-left"
                      onClick={() => {
                        setShowCreateRoleOptions((open) => !open);
                        setShowCreateDepartmentOptions(false);
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={showCreateRoleOptions}
                    >
                      <span>{getRoleLabel(createForm.role)}</span>
                      <ChevronDown size={16} className={`text-ink-400 transition-transform ${showCreateRoleOptions ? 'rotate-180' : ''}`} />
                    </button>
                    {showCreateRoleOptions && (
                      <div className="absolute left-0 right-0 top-full z-[70] mt-1 overflow-hidden rounded-md border border-white/10 bg-ink-900 shadow-soft-lg" role="listbox">
                        {ROLE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-500/10 hover:text-primary-300 ${
                              createForm.role === option.value ? 'bg-primary-500/15 text-primary-300' : 'text-white'
                            }`}
                            onClick={() => {
                              setCreateForm({ ...createForm, role: option.value });
                              setShowCreateRoleOptions(false);
                            }}
                            role="option"
                            aria-selected={createForm.role === option.value}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">Nomor Telepon</label>
                  <input className="input" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Departemen</label>
                  <div className="relative">
                    <button
                      type="button"
                      className="input flex items-center justify-between text-left"
                      onClick={() => {
                        setShowCreateDepartmentOptions((open) => !open);
                        setShowCreateRoleOptions(false);
                        setShowCreateSubDepartmentOptions(false);
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={showCreateDepartmentOptions}
                    >
                      <span className={createForm.department_id ? '' : 'text-ink-500'}>{getDepartmentLabel(selectedDepartment?.department_name)}</span>
                      <ChevronDown size={16} className={`text-ink-400 transition-transform ${showCreateDepartmentOptions ? 'rotate-180' : ''}`} />
                    </button>
                    {showCreateDepartmentOptions && (
                      <div className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-56 overflow-y-auto rounded-md border border-white/10 bg-ink-900 shadow-soft-lg" role="listbox">
                        <button
                          type="button"
                          className={`w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-500/10 hover:text-primary-300 ${
                            !createForm.department_id ? 'bg-primary-500/15 text-primary-300' : 'text-white'
                          }`}
                          onClick={() => {
                            setCreateForm({ ...createForm, department: '', department_id: '', sub_department_id: '' });
                            setShowCreateDepartmentOptions(false);
                          }}
                          role="option"
                          aria-selected={!createForm.department_id}
                        >
                          Tanpa departemen
                        </button>
                        {departments.map((dept) => (
                          <button
                            key={dept.id}
                            type="button"
                            className={`w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-500/10 hover:text-primary-300 ${
                              createForm.department_id === dept.id ? 'bg-primary-500/15 text-primary-300' : 'text-white'
                            }`}
                            onClick={() => {
                              setCreateForm({
                                ...createForm,
                                department: dept.department_name,
                                department_id: dept.id,
                                sub_department_id: ''
                              });
                              setShowCreateDepartmentOptions(false);
                            }}
                            role="option"
                            aria-selected={createForm.department_id === dept.id}
                          >
                            <span className="font-medium">{dept.department_name}</span>
                            {dept.department_code && <span className="ml-2 text-xs text-ink-500 font-mono">{dept.department_code}</span>}
                          </button>
                        ))}
                        {departments.length === 0 && (
                          <div className="px-3.5 py-2 text-sm text-ink-400">Belum ada departemen aktif</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">Subdepartemen</label>
                  <div className="relative">
                    <button
                      type="button"
                      className="input flex items-center justify-between text-left"
                      onClick={() => {
                        if (!createForm.department_id) return;
                        setShowCreateSubDepartmentOptions((open) => !open);
                        setShowCreateRoleOptions(false);
                        setShowCreateDepartmentOptions(false);
                      }}
                      disabled={!createForm.department_id}
                      aria-haspopup="listbox"
                      aria-expanded={showCreateSubDepartmentOptions}
                    >
                      <span className={createForm.sub_department_id ? '' : 'text-ink-500'}>
                        {selectedSubDepartment?.sub_department_name || (createForm.department_id ? 'Pilih subdepartemen' : 'Pilih departemen dulu')}
                      </span>
                      <ChevronDown size={16} className={`text-ink-400 transition-transform ${showCreateSubDepartmentOptions ? 'rotate-180' : ''}`} />
                    </button>
                    {showCreateSubDepartmentOptions && (
                      <div className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-56 overflow-y-auto rounded-md border border-white/10 bg-ink-900 shadow-soft-lg" role="listbox">
                        <button
                          type="button"
                          className={`w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-500/10 hover:text-primary-300 ${
                            !createForm.sub_department_id ? 'bg-primary-500/15 text-primary-300' : 'text-white'
                          }`}
                          onClick={() => {
                            setCreateForm({ ...createForm, sub_department_id: '' });
                            setShowCreateSubDepartmentOptions(false);
                          }}
                          role="option"
                          aria-selected={!createForm.sub_department_id}
                        >
                          Tanpa subdepartemen
                        </button>
                        {availableSubDepartments.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            className={`w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-500/10 hover:text-primary-300 ${
                              createForm.sub_department_id === sub.id ? 'bg-primary-500/15 text-primary-300' : 'text-white'
                            }`}
                            onClick={() => {
                              setCreateForm({ ...createForm, sub_department_id: sub.id });
                              setShowCreateSubDepartmentOptions(false);
                            }}
                            role="option"
                            aria-selected={createForm.sub_department_id === sub.id}
                          >
                            <span className="font-medium">{sub.sub_department_name}</span>
                            {sub.sub_department_code && <span className="ml-2 text-xs text-ink-500 font-mono">{sub.sub_department_code}</span>}
                          </button>
                        ))}
                        {availableSubDepartments.length === 0 && (
                          <div className="px-3.5 py-2 text-sm text-ink-400">Belum ada subdepartemen aktif</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">Jabatan</label>
                  <input className="input" value={createForm.position} onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => closeCreateModal()} className="btn-secondary" disabled={createLoading}>Batal</button>
                <button type="submit" className="btn-primary" disabled={createLoading}>
                  <UserPlus size={15} />
                  {createLoading ? 'Membuat Akun...' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Shield size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Konfirmasi</h3>
              </div>
              <button onClick={() => setShowConfirm(null)} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <p className="text-ink-300 mb-6">
              {showConfirm.action === 'approve' && `Setujui akun "${showConfirm.name}"?`}
              {showConfirm.action === 'reject' && `Tolak akun "${showConfirm.name}"?`}
              {showConfirm.action === 'activate' && `Aktifkan akun "${showConfirm.name}"?`}
              {showConfirm.action === 'disable' && `Nonaktifkan akun "${showConfirm.name}"?`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(null)} className="btn-secondary">
                Batal
              </button>
              <button
                onClick={() => handleAction(showConfirm.id, showConfirm.action)}
                disabled={actionLoading === showConfirm.id}
                className={`btn-primary ${
                  showConfirm.action === 'reject' || showConfirm.action === 'disable'
                    ? '!bg-danger-500 hover:!bg-danger-600'
                    : ''
                }`}
              >
                {actionLoading === showConfirm.id ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20">
                  <Shield size={18} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Ubah Role</h3>
              </div>
              <button onClick={() => { setShowRoleModal(null); setShowEditRoleOptions(false); setNewRole(''); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <p className="text-ink-300 mb-4">
              Ubah role untuk <strong className="text-white">{showRoleModal.full_name}</strong>
            </p>
            <div className="relative mb-6">
              <button
                type="button"
                className="input flex items-center justify-between text-left"
                onClick={() => setShowEditRoleOptions((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={showEditRoleOptions}
              >
                <span>{getRoleLabel(newRole)}</span>
                <ChevronDown size={16} className={`text-ink-400 transition-transform ${showEditRoleOptions ? 'rotate-180' : ''}`} />
              </button>
              {showEditRoleOptions && (
                <div className="absolute left-0 right-0 top-full z-[70] mt-1 overflow-hidden rounded-md border border-white/10 bg-ink-900 shadow-soft-lg" role="listbox">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-primary-500/10 hover:text-primary-300 ${
                        newRole === opt.value ? 'bg-primary-500/15 text-primary-300' : 'text-white'
                      }`}
                      onClick={() => {
                        setNewRole(opt.value);
                        setShowEditRoleOptions(false);
                      }}
                      role="option"
                      aria-selected={newRole === opt.value}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRoleModal(null); setNewRole(''); }}
                onMouseDown={() => setShowEditRoleOptions(false)}
                className="btn-secondary"
              >
                Batal
              </button>
              <button
                onClick={handleRoleChange}
                disabled={actionLoading === showRoleModal.id || !newRole}
                className="btn-primary"
              >
                {actionLoading === showRoleModal.id ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
