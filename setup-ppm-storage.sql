-- Setup Storage untuk Dokumen PPM
-- Jalankan di Supabase SQL Editor

-- 1. Buat bucket untuk PPM documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ppm-documents',
  'ppm-documents',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies jika ada
DROP POLICY IF EXISTS "PPM: Public read access" ON storage.objects;
DROP POLICY IF EXISTS "PPM: Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "PPM: Authenticated delete" ON storage.objects;

-- 3. RLS Policies untuk storage.objects
-- Note: RLS on storage.objects is managed by Supabase extension, don't use ALTER TABLE

CREATE POLICY "PPM: Public read access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ppm-documents');

CREATE POLICY "PPM: Authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ppm-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "PPM: Authenticated delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ppm-documents'
    AND auth.role() = 'authenticated'
  );

-- 4. Verify
SELECT 'PPM storage bucket berhasil dibuat!' as message;

