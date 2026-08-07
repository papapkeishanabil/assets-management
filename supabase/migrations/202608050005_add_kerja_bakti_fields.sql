-- ============================================================
-- Migration: Tambah kolom khusus untuk Kerja Bakti
-- work_area dan participant_count di maintenance_executions
-- ============================================================

-- 1. Tambah kolom khusus kerja bakti
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS work_area TEXT,
  ADD COLUMN IF NOT EXISTS participant_count INTEGER;

-- 2. Refresh schema cache
NOTIFY pgrst, 'reload schema';