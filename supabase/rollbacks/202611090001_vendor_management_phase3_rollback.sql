-- Destruktif hanya objek Fase 3; butuh izin dan backup. Tidak menghapus blob via SQL.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='vendor-photos') THEN
    RAISE EXCEPTION 'Bucket berisi file: backup dan kosongkan via Storage API dengan persetujuan sebelum rollback';
  END IF;
  IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='vendor-photos') THEN
    RAISE EXCEPTION 'Hapus bucket vendor-photos yang kosong via Storage API dahulu; jangan menghapus metadata storage dengan SQL';
  END IF;
END $$;
DROP POLICY IF EXISTS "Vendor storage read gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor storage insert gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor storage update gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor storage delete gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor storage read" ON storage.objects;
DROP POLICY IF EXISTS "Vendor storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Vendor storage delete orphan" ON storage.objects;
DROP FUNCTION IF EXISTS public.vendor_photo_valid_path(text);
DROP FUNCTION IF EXISTS public.vendor_photo_can_remove(text,text);
DROP FUNCTION IF EXISTS public.vendor_photo_reader();
DROP FUNCTION IF EXISTS public.vendor_photo_upload_allowed(text);
DROP FUNCTION IF EXISTS public.vendor_location_monitoring(uuid,uuid);
DROP VIEW IF EXISTS public.vendor_map_points;
DROP VIEW IF EXISTS public.vendor_location_summary;
DROP FUNCTION IF EXISTS public.vendor_set_primary_location(uuid);
DROP FUNCTION IF EXISTS public.vendor_set_cover_photo(uuid);
DROP FUNCTION IF EXISTS public.vendor_link_existing_active(uuid);
DROP TABLE IF EXISTS public.vendor_location_photos;
DROP TABLE IF EXISTS public.vendor_locations;
DROP FUNCTION IF EXISTS public.vendor_photos_guard();
DROP FUNCTION IF EXISTS public.vendor_locations_guard();
DROP FUNCTION IF EXISTS public.vendor_location_audit();
NOTIFY pgrst,'reload schema';
COMMIT;
