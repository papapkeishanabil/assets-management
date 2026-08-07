-- ============================================================
-- Migration: Tambah kolom is_draft untuk maintenance_executions
-- agar pelaksanaan bisa disimpan sebagai draft sebelum ditinjau
-- ============================================================

-- 1. Tambah kolom is_draft
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT true;

-- 2. Tambah kolom untuk menyimpan data assessment/penilaian
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS assessment_result TEXT,
  ADD COLUMN IF NOT EXISTS assessment_notes TEXT,
  ADD COLUMN IF NOT EXISTS assessed_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS assessed_at TIMESTAMP WITH TIME ZONE;

-- 3. Update existing records: set is_draft = false untuk data yang sudah ada
UPDATE maintenance_executions
  SET is_draft = false
  WHERE is_draft IS NULL;

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';