-- Manual rollback only. Refuses nonempty file bucket; export sample/QC data before use.
BEGIN;
DO $$ BEGIN IF EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-sample-files') THEN RAISE EXCEPTION 'Bucket bukti tidak kosong: backup/ekspor file sebelum rollback';END IF;END $$;
DROP POLICY IF EXISTS "Vendor sample files read gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor sample files insert gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor sample files update gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor sample files delete gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor sample files read" ON storage.objects;
DROP POLICY IF EXISTS "Vendor sample files insert" ON storage.objects;
-- Keep the empty private bucket: Storage forbids SQL DELETE even for an empty bucket.
-- Remove it afterward through the Storage API/Dashboard, without bypassing protect_delete.
DROP FUNCTION IF EXISTS public.vendor_sample_storage_access(text,boolean);
DROP FUNCTION IF EXISTS public.vendor_sampling_dashboard(uuid,uuid);
DROP VIEW IF EXISTS public.vendor_sample_monitor;
DROP FUNCTION IF EXISTS public.vendor_record_sample_qc(uuid,jsonb,uuid,timestamptz);
DROP TABLE IF EXISTS public.vendor_sample_change_history;
DROP TABLE IF EXISTS public.vendor_qc_run_revisions;
DROP TABLE IF EXISTS public.vendor_sample_qc_runs;
DROP TABLE IF EXISTS public.vendor_samples;
DROP TABLE IF EXISTS public.vendor_qc_parameters;
DROP FUNCTION IF EXISTS public.vendor_qc_revisions_guard();
DROP FUNCTION IF EXISTS public.vendor_qc_runs_audit();
DROP FUNCTION IF EXISTS public.vendor_qc_runs_guard();
DROP FUNCTION IF EXISTS public.vendor_qc_parameters_guard();
DROP FUNCTION IF EXISTS public.vendor_samples_audit();
DROP FUNCTION IF EXISTS public.vendor_samples_guard();
DROP FUNCTION IF EXISTS public.vendor_sampling_sync_stage(uuid);
DROP FUNCTION IF EXISTS public.vendor_sample_file_path(text,uuid,uuid);
DROP SEQUENCE IF EXISTS public.vendor_sample_code_seq;
DROP SEQUENCE IF EXISTS public.vendor_qc_code_seq;
NOTIFY pgrst,'reload schema';COMMIT;
