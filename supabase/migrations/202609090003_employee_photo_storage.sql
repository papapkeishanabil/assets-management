-- Bucket foto profil karyawan. Kolom employees.photo_url sudah tersedia di schema awal.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-photos', 'employee-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read employee photos" ON storage.objects;
CREATE POLICY "Public read employee photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-photos');

DROP POLICY IF EXISTS "Salary managers upload employee photos" ON storage.objects;
CREATE POLICY "Salary managers upload employee photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-photos' AND public.is_salary_manager());

DROP POLICY IF EXISTS "Salary managers update employee photos" ON storage.objects;
CREATE POLICY "Salary managers update employee photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-photos' AND public.is_salary_manager())
  WITH CHECK (bucket_id = 'employee-photos' AND public.is_salary_manager());

DROP POLICY IF EXISTS "Salary managers delete employee photos" ON storage.objects;
CREATE POLICY "Salary managers delete employee photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-photos' AND public.is_salary_manager());
