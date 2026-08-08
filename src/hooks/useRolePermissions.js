import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchRolePermissions, canAccessModule } from '../lib/permissions';

const MODULES_ALL_KEYS = new Set([
  'dashboard', 'users', 'roles', 'categories', 'locations',
  'departments', 'asset_responsibles', 'vendors', 'assets',
  'employees', 'contracts', 'contract_types', 'maintenance_schedules',
  'maintenance_executions', 'maintenance_drafts', 'maintenance_types',
  'ppm', 'inspections', 'notifications', 'settings', 'system_notification_test', 'profile'
]);

/**
 * Hook untuk memuat permissions pengguna saat ini
 */
export function useRolePermissions() {
  const { role, profile } = useAuth();
  const [permissions, setPermissions] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!role) {
      setPermissions(new Set());
      setLoading(false);
      return;
    }

    // Super admin selalu punya akses semua
    if (role.role_name === 'super_admin') {
      setPermissions(MODULES_ALL_KEYS);
      setLoading(false);
      return;
    }

    const perms = await fetchRolePermissions(role.id);
    setPermissions(perms);
    setLoading(false);
  }, [role]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasAccess = (moduleKey) => {
    if (!role) return false;
    if (role.role_name === 'super_admin') return true;
    return canAccessModule(permissions, moduleKey);
  };

  return { permissions, loading, hasAccess, refetch: loadPermissions };
}