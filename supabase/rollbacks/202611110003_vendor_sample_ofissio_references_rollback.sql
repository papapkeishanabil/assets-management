-- Manual rollback only. Preserve all sample/QC/decision rows and existing Storage policies.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.vendor_sample_product_references') IS NOT NULL THEN
  IF EXISTS(SELECT FROM public.vendor_sample_product_references) THEN
   RAISE EXCEPTION 'Acuan sampel sudah berisi; ekspor bukti dan rencanakan pemulihan sebelum rollback';
  END IF;
 END IF;
 IF EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-product-references') THEN
  RAISE EXCEPTION 'Bucket acuan masih berisi file; inventaris/ekspor dan bersihkan melalui Storage API sebelum rollback';
 END IF;
END $$;
DROP POLICY IF EXISTS "Vendor product reference files read" ON storage.objects;
DROP POLICY IF EXISTS "Vendor product reference files read gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor product reference files insert gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor product reference files update gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor product reference files delete gate" ON storage.objects;
DROP FUNCTION IF EXISTS public.vendor_product_reference_storage_read(text);
DROP TRIGGER IF EXISTS trg_vendor_sample_reference_code_guard ON public.vendor_samples;
DROP FUNCTION IF EXISTS public.vendor_sample_reference_code_guard();
DROP FUNCTION IF EXISTS public.vendor_create_ofissio_sample(uuid,jsonb,jsonb,uuid);
DROP TABLE IF EXISTS public.vendor_sample_product_references;
DROP FUNCTION IF EXISTS public.vendor_product_reference_immutable();
-- Empty private bucket deliberately remains; remove only via Storage API after inventory/review.
COMMIT;
