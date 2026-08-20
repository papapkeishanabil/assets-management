-- ============================================================
-- Migration: Catatan service (asset_activity_logs) bisa diedit
--  - kolom updated_at (backfill = created_at agar baris lama
--    tidak tampak "pernah diedit")
--  - trigger updated_at (fungsi sudah ada, re-declare idempotent)
--  - policy UPDATE (mirror predicate "Update assets",
--    schema-phase2.sql): super_admin / hrd aktif saja
-- Idempotent — aman dijalankan berulang.
-- ============================================================

-- 1. Kolom updated_at
ALTER TABLE asset_activity_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE asset_activity_logs SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE asset_activity_logs
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- 2. Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_asset_activity_logs_updated_at ON asset_activity_logs;
CREATE TRIGGER trigger_asset_activity_logs_updated_at
  BEFORE UPDATE ON asset_activity_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Policy UPDATE (super_admin / hrd aktif)
DROP POLICY IF EXISTS "Update activity logs" ON asset_activity_logs;
CREATE POLICY "Update activity logs" ON asset_activity_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  );
