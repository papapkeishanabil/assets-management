import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS, ROLE_OPTIONS, ACCOUNT_STATUS_LABELS, ACCOUNT_STATUS, formatDateTime } from '../lib/constants';
import toast from 'react-hot-toast';
import { Search, Filter, Check, X, Ban, RotateCcw, Shield, RefreshCw } from 'lucide-react';

export default function UsersPage() {
  const { refreshProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [showConfirm, setShowConfirm] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(null);
  const [newRole, setNewRole] = useState('');

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Manajemen Pengguna</h1>
          <p className="text-sm text-ink-400 mt-1">Kelola pengguna, role, dan status akun</p>
        </div>
        <button onClick={fetchUsers} className="btn-secondary text-sm" disabled={loading}>
          <RefreshCw size={14} className={`${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
                      <div className="text-xs text-ink-400">{user.department || '-'}</div>
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
              <button onClick={() => { setShowRoleModal(null); setNewRole(''); }} className="p-1.5 text-ink-400 hover:bg-white/5 hover:text-white rounded-md transition-all"><X size={18} /></button>
            </div>
            <p className="text-ink-300 mb-4">
              Ubah role untuk <strong className="text-white">{showRoleModal.full_name}</strong>
            </p>
            <select
              className="input mb-6"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRoleModal(null); setNewRole(''); }}
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
