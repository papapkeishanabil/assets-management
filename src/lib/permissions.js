import { supabase } from './supabase';

// Daftar semua modul yang tersedia di aplikasi
export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'Home' },
  { key: 'users', label: 'Pengguna', icon: 'Users' },
  { key: 'roles', label: 'Role & Hak Akses', icon: 'Shield' },
  { key: 'categories', label: 'Kategori Aset', icon: 'FolderTree' },
  { key: 'locations', label: 'Lokasi Aset', icon: 'MapPin' },
  { key: 'departments', label: 'Struktur Organisasi', icon: 'Building2' },
  { key: 'asset_responsibles', label: 'Penanggung Jawab', icon: 'UserCheck' },
  { key: 'vendors', label: 'Vendor', icon: 'Truck' },
  { key: 'assets', label: 'Daftar Aset', icon: 'Package' },
  { key: 'employees', label: 'Data Karyawan', icon: 'Users' },
  { key: 'contracts', label: 'Daftar Kontrak', icon: 'FileText' },
  { key: 'contract_types', label: 'Jenis Kontrak', icon: 'FolderTree' },
  { key: 'maintenance_schedules', label: 'Jadwal Pemeliharaan', icon: 'Calendar' },
  { key: 'maintenance_executions', label: 'Pelaksanaan Pemeliharaan', icon: 'History' },
  { key: 'maintenance_drafts', label: 'Draft Pemeliharaan', icon: 'FileText' },
  { key: 'maintenance_types', label: 'Jenis Pemeliharaan', icon: 'FolderTree' },
  { key: 'ppm', label: 'PPM / Produksi', icon: 'MessageSquare' },
  { key: 'inspections', label: 'Hasil Pemeriksaan', icon: 'ClipboardCheck' },
  { key: 'notifications', label: 'Notifikasi', icon: 'Bell' },
  { key: 'settings', label: 'Instalasi Aplikasi', icon: 'Settings' },
  { key: 'system_notification_test', label: 'Tes Notifikasi Sistem', icon: 'BellRing' },
  { key: 'profile', label: 'Profil Saya', icon: 'User' }
];

// Cache permissions per role
const permissionsCache = new Map();

/**
 * Ambil permissions untuk role tertentu
 * @param {string} roleId - ID role
 * @returns {Promise<Set<string>>} - Set module keys yang bisa diakses
 */
export async function fetchRolePermissions(roleId) {
  if (!roleId) return new Set();
  if (permissionsCache.has(roleId)) return permissionsCache.get(roleId);

  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('module_key, can_access')
      .eq('role_id', roleId);

    if (error) throw error;

    const allowed = new Set(
      (data || [])
        .filter(p => p.can_access)
        .map(p => p.module_key)
    );

    permissionsCache.set(roleId, allowed);
    return allowed;
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return new Set();
  }
}

/**
 * Cek apakah role bisa mengakses modul tertentu
 * @param {Set<string>} permissions - Set module keys
 * @param {string} moduleKey - Module key yang dicek
 * @returns {boolean}
 */
export function canAccessModule(permissions, moduleKey) {
  if (!permissions || permissions.size === 0) return false;
  return permissions.has(moduleKey);
}

/**
 * Clear cache permissions
 */
export function clearPermissionsCache() {
  permissionsCache.clear();
}