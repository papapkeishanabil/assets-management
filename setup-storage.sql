-- Setup Storage untuk Foto Aset
-- Jalankan di Supabase SQL Editor

-- 1. Buat bucket untuk asset photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies jika ada
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete" ON storage.objects;

-- 3. RLS Policies untuk storage.objects
-- Public read access (karena bucket public)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Authenticated users can upload
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets'
  AND auth.role() = 'authenticated'
);

-- Authenticated users can delete
CREATE POLICY "Authenticated delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets'
  AND auth.role() = 'authenticated'
);

-- 4. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

SELECT 'Storage bucket berhasil dibuat!' as message;