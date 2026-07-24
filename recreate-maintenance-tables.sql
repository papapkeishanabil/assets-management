-- ============================================================
-- FILE INI AKAN MENGHAPUS DAN MEMBUAT ULANG TABEL MAINTENANCE
-- Jalankan di Supabase SQL Editor, lalu refresh browser (Ctrl+F5)
-- ============================================================

-- 1. Hapus tabel yang ada (jika ada) - gunakan CASCADE karena work_orders memiliki FK ke maintenance_schedules
DROP TABLE IF EXISTS maintenance_schedules CASCADE;
DROP TABLE IF EXISTS maintenance_types CASCADE;

-- 2. Buat ulang tabel maintenance_types
CREATE TABLE maintenance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_code TEXT UNIQUE NOT NULL,
  maintenance_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO maintenance_types (maintenance_code, maintenance_name, description)
VALUES
  ('GANTI-OLI', 'Penggantian Oli', 'Penggantian oli mesin secara berkala'),
  ('PEMERIKSAAN', 'Pemeriksaan Berkala', 'Pemeriksaan rutin mesin'),
  ('SERVIS-RINGAN', 'Servis Ringan', 'Servis ringan mesin'),
  ('PEMBERSIHAN', 'Pembersihan Mesin', 'Pembersihan mesin dan peralatan')
ON CONFLICT (maintenance_code) DO NOTHING;

-- 3. Buat ulang tabel maintenance_schedules (LENGKAP dengan semua kolom)
CREATE TABLE maintenance_schedules (
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

-- Unique constraint
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

-- Nonaktifkan RLS untuk testing
ALTER TABLE maintenance_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules DISABLE ROW LEVEL SECURITY;

-- Verifikasi semua kolom ada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'maintenance_schedules' 
ORDER BY ordinal_position;

-- Verifikasi data
SELECT count(*) as total_types FROM maintenance_types;
