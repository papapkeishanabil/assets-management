-- MANUAL ONLY. Export decisions/proofs first. Never unlinks/deletes activated vendors.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.vendor_activations') IS NOT NULL THEN
  IF EXISTS(SELECT FROM public.vendor_activations) THEN RAISE EXCEPTION 'Aktivasi sudah tercatat; rollback otomatis ditolak. Perlu rencana pemulihan terpisah tanpa merusak master/aset';END IF;
 END IF;
 IF EXISTS(SELECT FROM storage.objects WHERE bucket_id='vendor-decision-files') THEN RAISE EXCEPTION 'Bucket bukti keputusan belum kosong; ekspor melalui Storage API dahulu';END IF;
END $$;
DROP POLICY IF EXISTS "Vendor decision files read gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor decision files insert gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor decision files update gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor decision files delete gate" ON storage.objects;
DROP POLICY IF EXISTS "Vendor decision files read" ON storage.objects;
DROP POLICY IF EXISTS "Vendor decision files insert" ON storage.objects;
DROP FUNCTION IF EXISTS public.vendor_decision_file_access(text,boolean);
DROP FUNCTION IF EXISTS public.activate_vendor_candidate(uuid,uuid);
DROP FUNCTION IF EXISTS public.vendor_record_decision(uuid,jsonb,timestamptz,text,uuid);
DROP FUNCTION IF EXISTS public.vendor_approval_checklist(uuid);
DROP FUNCTION IF EXISTS public.vendor_phase5_state(uuid);
DROP FUNCTION IF EXISTS public.vendor_phase5_phone(text);
DROP TABLE IF EXISTS public.vendor_activations;
DROP TABLE IF EXISTS public.vendor_decisions;
DROP FUNCTION IF EXISTS public.vendor_phase5_immutable();
DROP SEQUENCE IF EXISTS public.vendor_decision_code_seq;
DROP SEQUENCE IF EXISTS public.vendor_activation_master_code_seq;
-- Empty private bucket is removed separately through Storage API/Dashboard, not SQL DELETE.
-- Prior candidate decisions/status audit stays intact; never reset existing data here.
NOTIFY pgrst,'reload schema';COMMIT;
