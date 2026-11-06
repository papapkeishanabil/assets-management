-- HANYA rollback Fase 2 setelah persetujuan. Menghapus permanen log Fase 2!
-- Tidak CASCADE ke tabel existing; riwayat audit dan notifikasi tetap tersimpan.
BEGIN;
DROP FUNCTION IF EXISTS public.vendor_remind_overdue_followups();
DROP FUNCTION IF EXISTS public.vendor_sourcing_dashboard(uuid,uuid);
DROP TABLE IF EXISTS public.vendor_followups;
DROP FUNCTION IF EXISTS public.vendor_followups_audit();
DROP FUNCTION IF EXISTS public.vendor_followups_guard();
DROP SEQUENCE IF EXISTS public.vendor_followup_code_seq;
NOTIFY pgrst, 'reload schema';
COMMIT;
