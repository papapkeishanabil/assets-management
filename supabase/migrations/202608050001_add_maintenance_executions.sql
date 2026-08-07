-- ============================================================
-- Migration: Maintenance Executions (Riwayat Pelaksanaan)
-- Mencatat setiap pelaksanaan kegiatan dari jadwal pemeliharaan rutin
-- ============================================================

-- 1. Buat tabel maintenance_executions
CREATE TABLE IF NOT EXISTS maintenance_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
  execution_date DATE NOT NULL,
  odometer_at_execution DECIMAL(12,2),
  result TEXT,
  cost DECIMAL(18,2),
  photos JSONB DEFAULT '[]'::jsonb,
  performed_by UUID REFERENCES user_profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_executions_schedule_id ON maintenance_executions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_executions_date ON maintenance_executions(execution_date);

-- 3. Trigger untuk updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_maintenance_executions_updated_at ON maintenance_executions;
CREATE TRIGGER trigger_maintenance_executions_updated_at
  BEFORE UPDATE ON maintenance_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. RLS Policies
ALTER TABLE maintenance_executions ENABLE ROW LEVEL SECURITY;

-- Read: semua user authenticated yang aktif
CREATE POLICY "Authenticated read maintenance_executions" ON maintenance_executions
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
    )
  );

-- Write: super_admin, hrd, pelaksana
CREATE POLICY "Write maintenance_executions" ON maintenance_executions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin', 'hrd', 'pelaksana')
      AND up.account_status = 'ACTIVE'
    )
  );

-- 5. Buat storage bucket untuk foto pelaksanaan
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos',
  'maintenance-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage policies untuk maintenance-photos
DROP POLICY IF EXISTS "Public read maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload maintenance photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete maintenance photos" ON storage.objects;

CREATE POLICY "Public read maintenance photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Authenticated upload maintenance photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'maintenance-photos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated delete maintenance photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'maintenance-photos'
  AND auth.role() = 'authenticated'
);

-- 7. Verifikasi
SELECT 'maintenance_executions' as table_name, count(*) as row_count FROM maintenance_executions;