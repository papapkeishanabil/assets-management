-- Tabel untuk menyimpan akses peran ke modul/menu
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_key VARCHAR(100) NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, module_key)
);

-- Index untuk query cepat
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- Insert default permissions untuk semua role yang ada
-- Super Admin: akses semua modul
INSERT INTO role_permissions (role_id, module_key, can_access)
SELECT r.id, m.module_key, true
FROM roles r
CROSS JOIN (
  SELECT 'dashboard' AS module_key UNION ALL
  SELECT 'users' UNION ALL
  SELECT 'roles' UNION ALL
  SELECT 'categories' UNION ALL
  SELECT 'locations' UNION ALL
  SELECT 'departments' UNION ALL
  SELECT 'asset_responsibles' UNION ALL
  SELECT 'vendors' UNION ALL
  SELECT 'assets' UNION ALL
  SELECT 'employees' UNION ALL
  SELECT 'contracts' UNION ALL
  SELECT 'contract_types' UNION ALL
  SELECT 'maintenance_schedules' UNION ALL
  SELECT 'maintenance_executions' UNION ALL
  SELECT 'maintenance_drafts' UNION ALL
  SELECT 'maintenance_types' UNION ALL
  SELECT 'ppm' UNION ALL
  SELECT 'inspections' UNION ALL
  SELECT 'notifications' UNION ALL
  SELECT 'settings' UNION ALL
  SELECT 'system_notification_test' UNION ALL
  SELECT 'profile'
) m
WHERE r.role_name = 'super_admin'
ON CONFLICT (role_id, module_key) DO NOTHING;

-- HRD: akses modul yang dibutuhkan
INSERT INTO role_permissions (role_id, module_key, can_access)
SELECT r.id, m.module_key, true
FROM roles r
CROSS JOIN (
  SELECT 'dashboard' AS module_key UNION ALL
  SELECT 'categories' UNION ALL
  SELECT 'locations' UNION ALL
  SELECT 'asset_responsibles' UNION ALL
  SELECT 'vendors' UNION ALL
  SELECT 'assets' UNION ALL
  SELECT 'employees' UNION ALL
  SELECT 'contracts' UNION ALL
  SELECT 'contract_types' UNION ALL
  SELECT 'maintenance_schedules' UNION ALL
  SELECT 'maintenance_executions' UNION ALL
  SELECT 'maintenance_drafts' UNION ALL
  SELECT 'maintenance_types' UNION ALL
  SELECT 'ppm' UNION ALL
  SELECT 'inspections' UNION ALL
  SELECT 'notifications' UNION ALL
  SELECT 'profile'
) m
WHERE r.role_name = 'hrd'
ON CONFLICT (role_id, module_key) DO NOTHING;

-- Direksi: akses modul yang dibutuhkan saja
INSERT INTO role_permissions (role_id, module_key, can_access)
SELECT r.id, m.module_key, true
FROM roles r
CROSS JOIN (
  SELECT 'dashboard' AS module_key UNION ALL
  SELECT 'assets' UNION ALL
  SELECT 'contracts' UNION ALL
  SELECT 'maintenance_schedules' UNION ALL
  SELECT 'maintenance_executions' UNION ALL
  SELECT 'ppm' UNION ALL
  SELECT 'inspections' UNION ALL
  SELECT 'notifications' UNION ALL
  SELECT 'profile'
) m
WHERE r.role_name = 'direksi'
ON CONFLICT (role_id, module_key) DO NOTHING;

-- Pelaksana: akses modul yang dibutuhkan saja
INSERT INTO role_permissions (role_id, module_key, can_access)
SELECT r.id, m.module_key, true
FROM roles r
CROSS JOIN (
  SELECT 'dashboard' AS module_key UNION ALL
  SELECT 'assets' UNION ALL
  SELECT 'maintenance_schedules' UNION ALL
  SELECT 'maintenance_executions' UNION ALL
  SELECT 'ppm' UNION ALL
  SELECT 'inspections' UNION ALL
  SELECT 'notifications' UNION ALL
  SELECT 'profile'
) m
WHERE r.role_name = 'pelaksana'
ON CONFLICT (role_id, module_key) DO NOTHING;

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admin bisa lihat semua
CREATE POLICY "Super admin can view all role permissions"
  ON role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin'
    )
  );

-- Policy: Role member can view permissions for their own role
CREATE POLICY "Role member can view own role permissions"
  ON role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.auth_user_id = auth.uid()
        AND up.role_id = role_permissions.role_id
    )
  );

-- Policy: Super Admin bisa insert/update/delete
CREATE POLICY "Super admin can manage role permissions"
  ON role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin'
    )
  );