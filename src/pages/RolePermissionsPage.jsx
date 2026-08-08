    import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Shield, Save, RefreshCw, CheckCircle2, XCircle, Lock } from 'lucide-react';
import { MODULES, clearPermissionsCache } from '../lib/permissions';

export default function RolePermissionsPage() {
  const { role } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const isSuperAdmin = role?.role_name === 'super_admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('role_name');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      const { data: permsData, error: permsError } = await supabase
        .from('role_permissions')
        .select('role_id, module_key, can_access');

      if (permsError) throw permsError;

      const permMap = {};
      (permsData || []).forEach(p => {
        if (!permMap[p.role_id]) permMap[p.role_id] = {};
        permMap[p.role_id][p.module_key] = p.can_access;
      });
      setPermissions(permMap);

      if (rolesData && rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0].id);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Gagal memuat data akses');
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const togglePermission = (roleId, moduleKey) => {
    setPermissions(prev => {
      const rolePerms = { ...(prev[roleId] || {}) };
      rolePerms[moduleKey] = !rolePerms[moduleKey];
      return { ...prev, [roleId]: rolePerms };
    });
  };

  const toggleAllForRole = (roleId, value) => {
    setPermissions(prev => {
      const rolePerms = {};
      MODULES.forEach(m => { rolePerms[m.key] = value; });
      return { ...prev, [roleId]: rolePerms };
    });
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const rolePerms = permissions[selectedRole] || {};
      const updates = MODULES.map(m => ({
        role_id: selectedRole,
        module_key: m.key,
        can_access: !!rolePerms[m.key]
      }));

      const { error } = await supabase
        .from('role_permissions')
        .upsert(updates, { onConflict: 'role_id,module_key' });

      if (error) throw error;
      clearPermissionsCache();
      toast.success('Akses modul berhasil disimpan');
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Gagal menyimpan akses: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);
  const selectedPerms = permissions[selectedRole] || {};
  const enabledCount = MODULES.filter(m => selectedPerms[m.key]).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Pengaturan Akses Modul</h1>
          <p className="text-sm text-ink-400 mt-1">Atur modul/menu yang dapat diakses oleh masing-masing role</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary text-sm">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button onClick={handleSave} className="btn-primary text-sm" disabled={saving || !selectedRole}>
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan Akses'}
          </button>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="p-4 rounded-lg bg-danger-500/10 border border-danger-500/20 flex items-center gap-3">
          <Lock size={18} className="text-danger-400" />
          <p className="text-sm text-danger-300">Hanya Super Admin yang dapat mengakses halaman ini.</p>
        </div>
      )}

      {isSuperAdmin && (
        <>
          <div className="card p-4">
            <label className="label">Pilih Role</label>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    selectedRole === r.id
                      ? 'bg-gradient-to-br from-primary-500 to-indigo-600 shadow-glow-blue text-white'
                      : 'bg-white/5 text-ink-200 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <Shield size={14} className="inline mr-1.5" />
                  {r.role_name}
                </button>
              ))}
            </div>
          </div>

          {selectedRoleData && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Shield size={18} className="text-primary-400" />
                    Akses Modul untuk <span className="font-mono text-primary-300">{selectedRoleData.role_name}</span>
                  </h2>
                  <p className="text-xs text-ink-400 mt-1">
                    {enabledCount} dari {MODULES.length} modul diaktifkan
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleAllForRole(selectedRole, true)} className="btn-secondary text-xs px-3 py-1.5">
                    <CheckCircle2 size={12} className="mr-1" />
                    Aktifkan Semua
                  </button>
                  <button onClick={() => toggleAllForRole(selectedRole, false)} className="btn-secondary text-xs px-3 py-1.5">
                    <XCircle size={12} className="mr-1" />
                    Nonaktifkan Semua
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {MODULES.map(module => {
                  const isEnabled = !!selectedPerms[module.key];
                  return (
                    <button
                      key={module.key}
                      onClick={() => togglePermission(selectedRole, module.key)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isEnabled
                          ? 'bg-primary-500/10 border-primary-500/30 hover:bg-primary-500/15'
                          : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isEnabled ? 'bg-primary-500/20 text-primary-300' : 'bg-white/5 text-ink-500'
                          }`}>
                            <Shield size={14} />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isEnabled ? 'text-white' : 'text-ink-300'}`}>
                              {module.label}
                            </p>
                            <p className="text-[10px] font-mono text-ink-500">{module.key}</p>
                          </div>
                        </div>
                        <div className={`w-8 h-4 rounded-full transition-all ${
                          isEnabled ? 'bg-primary-500' : 'bg-white/10'
                        }`}>
                          <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${
                            isEnabled ? 'ml-4' : 'ml-0.5'
                          }`}></div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}