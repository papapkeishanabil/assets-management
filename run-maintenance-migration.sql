-- ============================================================
-- FILE INI SUDAH SIAP JALANKAN DI SUPABASE SQL EDITOR
-- Copy-paste seluruh isi file ini, lalu klik "RUN"
-- ============================================================

-- 1. TABLE MAINTENANCE_TYPES
CREATE TABLE IF NOT EXISTS maintenance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_code TEXT UNIQUE NOT NULL,
  maintenance_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default maintenance types
INSERT INTO maintenance_types (maintenance_code, maintenance_name, description)
VALUES
  ('GANTI-OLI', 'Penggantian Oli', 'Penggantian oli mesin secara berkala'),
  ('PEMERIKSAAN', 'Pemeriksaan Berkala', 'Pemeriksaan rutin mesin'),
  ('SERVIS-RINGAN', 'Servis Ringan', 'Servis ringan mesin'),
  ('PEMBERSIHAN', 'Pembersihan Mesin', 'Pembersihan mesin dan peralatan')
ON CONFLICT (maintenance_code) DO NOTHING;

-- 2. TABLE MAINTENANCE_SCHEDULES
-- Constraint langsung di dalam CREATE TABLE untuk kompatibilitas
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  maintenance_type_id UUID NOT NULL REFERENCES maintenance_types(id),
  last_maintenance_date DATE NOT NULL,
  interval_value INTEGER NOT NULL CHECK (interval_value > 0),
  interval_unit TEXT NOT NULL CHECK (interval_unit IN ('DAY', 'WEEK', 'MONTH', 'YEAR')),
  next_maintenance_date DATE NOT NULL,
  reminder_days_before INTEGER NOT NULL DEFAULT 7 CHECK (reminder_days_before >= 0),
  responsible_user_id UUID,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivation_reason TEXT,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint (gunakan CREATE UNIQUE INDEX yang sudah support IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_schedules_unique_active
  ON maintenance_schedules (asset_id, maintenance_type_id)
  WHERE is_active = true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_asset_id ON maintenance_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_type_id ON maintenance_schedules(maintenance_type_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_date ON maintenance_schedules(next_maintenance_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_is_active ON maintenance_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_responsible ON maintenance_schedules(responsible_user_id);

-- Trigger untuk updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_maintenance_schedules_updated_at ON maintenance_schedules;
CREATE TRIGGER trigger_maintenance_schedules_updated_at
  BEFORE UPDATE ON maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_maintenance_types_updated_at ON maintenance_types;
CREATE TRIGGER trigger_maintenance_types_updated_at
  BEFORE UPDATE ON maintenance_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE maintenance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Maintenance Types Policies
CREATE POLICY "Authenticated read maintenance_types" ON maintenance_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin write maintenance_types" ON maintenance_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin', 'hrd')
      AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "Admin update maintenance_types" ON maintenance_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin', 'hrd')
      AND up.account_status = 'ACTIVE'
    )
  );

-- Maintenance Schedules Policies
CREATE POLICY "Authenticated read maintenance_schedules" ON maintenance_schedules
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "Admin write maintenance_schedules" ON maintenance_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin', 'hrd')
      AND up.account_status = 'ACTIVE'
    )
  );

CREATE POLICY "Admin update maintenance_schedules" ON maintenance_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin', 'hrd')
      AND up.account_status = 'ACTIVE'
    )
  );

-- Verify
SELECT 'maintenance_types' as table_name, count(*) as row_count FROM maintenance_types
UNION ALL
SELECT 'maintenance_schedules', count(*) FROM maintenance_schedules;
