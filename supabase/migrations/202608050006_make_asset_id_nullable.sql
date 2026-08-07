-- ============================================================
-- Migration: Buat kolom asset_id nullable untuk jadwal kerja bakti
-- agar jadwal tanpa aset tertentu bisa dibuat
-- ============================================================

-- 1. Drop constraint NOT NULL yang ada
ALTER TABLE maintenance_schedules
  ALTER COLUMN asset_id DROP NOT NULL;

-- 2. Refresh schema cache
NOTIFY pgrst, 'reload schema';