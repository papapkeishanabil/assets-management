-- =====================================================================
-- INSPECTION REVIEW MIGRATION
-- Fitur: Pemeriksaan lapangan surveyor (draft) -> Penilaian HRD/Teknisi
-- Jalankan di Supabase SQL Editor (Project > SQL Editor > New query)
-- Idempotent: aman dijalankan ulang.
-- =====================================================================

-- =====================================================================
-- 1. TAMBAH KOLOM PADA maintenance_records (siklus inspeksi + penilaian)
-- =====================================================================
ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS inspection_status   VARCHAR(30),
  ADD COLUMN IF NOT EXISTS inspection_notes    TEXT,
  ADD COLUMN IF NOT EXISTS inspection_photos   JSONB        NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS condition_assessment VARCHAR(50),
  ADD COLUMN IF NOT EXISTS needs_repair        BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes        TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by        UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by         UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ;

-- =====================================================================
-- 2. TAMBAH KOLOM LINK PADA notifications (menunjuk ke hasil pemeriksaan)
-- =====================================================================
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS maintenance_record_id UUID REFERENCES maintenance_records(id);

-- =====================================================================
-- 3. STORAGE BUCKET UNTUK FOTO PEMERIKSAAN
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-photos',
  'inspection-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Inspection photos public read"  ON storage.objects;
DROP POLICY IF EXISTS "Inspection photos auth upload"  ON storage.objects;
DROP POLICY IF EXISTS "Inspection photos auth delete"  ON storage.objects;

CREATE POLICY "Inspection photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-photos');

CREATE POLICY "Inspection photos auth upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Inspection photos auth delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

-- =====================================================================
-- 4. RLS POLICIES maintenance_records (alur inspeksi)
-- CATATAN: sesuaikan bila proyek Anda sudah punya policy RLS lain
--          pada tabel ini (drop & recreate yang relevan).
-- =====================================================================
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- 4a. Membaca: semua pengguna terautentikasi yang aktif
DROP POLICY IF EXISTS "Read maintenance records" ON maintenance_records;
CREATE POLICY "Read maintenance records"
ON maintenance_records FOR SELECT
USING (auth.role() = 'authenticated');

-- 4b. Insert: surveyor/penanggung jawab dari WO terkait, atau HRD/admin
DROP POLICY IF EXISTS "Insert inspection records" ON maintenance_records;
CREATE POLICY "Insert inspection records"
ON maintenance_records FOR INSERT
WITH CHECK (
  work_order_id IS NULL OR
  EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN user_profiles up ON up.id IN (wo.assigned_user_id, wo.responsible_user_id)
    JOIN roles r ON r.id = up.role_id
    WHERE wo.id = maintenance_records.work_order_id
      AND up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
  ) OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin','hrd')
      AND up.account_status = 'ACTIVE'
  )
);

-- 4c. Update draft oleh surveyor (hanya saat masih draft)
DROP POLICY IF EXISTS "Surveyor update draft inspection" ON maintenance_records;
CREATE POLICY "Surveyor update draft inspection"
ON maintenance_records FOR UPDATE
USING (
  inspection_status = 'draft' AND
  EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN user_profiles up ON up.id = wo.assigned_user_id
    WHERE wo.id = maintenance_records.work_order_id
      AND up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
  )
)
WITH CHECK (inspection_status IN ('draft','menunggu_penilaian'));

-- 4d. Update/penilaian oleh HRD / admin / koordinator
DROP POLICY IF EXISTS "Reviewer assess inspection" ON maintenance_records;
CREATE POLICY "Reviewer assess inspection"
ON maintenance_records FOR UPDATE
USING (
  inspection_status IN ('draft','menunggu_penilaian') AND
  EXISTS (
    SELECT 1 FROM work_orders wo
    JOIN user_profiles up ON up.id = wo.responsible_user_id
    WHERE wo.id = maintenance_records.work_order_id
      AND up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
  ) OR
  NOT EXISTS (SELECT 1 FROM maintenance_records WHERE id = maintenance_records.id AND work_order_id IS NULL) AND
  EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.auth_user_id = auth.uid()
      AND r.role_name IN ('super_admin','hrd','direksi')
      AND up.account_status = 'ACTIVE'
  )
)
WITH CHECK (inspection_status IN ('menunggu_penilaian','selesai'));

SELECT 'Migration inspection-review berhasil dijalankan' AS message;
