-- ============================================================
-- ROLLBACK: Modul Manajemen Vendor — Fase 1 (Core Sourcing)
-- Menghapus SEMUA objek yang dibuat migration
-- 202611040001_vendor_management_phase1.sql.
--
-- ⚠ PERINGATAN — JANGAN DIJALANKAN OTOMATIS:
--   Rollback ini MENGHAPUS SELURUH data pipeline (kandidat, kontak,
--   riwayat status & aktivitas). Jalankan HANYA jika:
--     1. Sudah ada backup yang terverifikasi, ATAU
--     2. Semua tabel vendor_* masih kosong (cek dulu):
--        SELECT count(*) FROM vendor_candidates;
--        SELECT count(*) FROM vendor_activity_logs;
--   Bila ada data yang perlu dipertahankan: backup dulu, atau
--   pertimbangkan nonaktifkan akses (revoke role_permissions /
--   DROP POLICY) tanpa menghapus tabel.
--
-- AMAN untuk data existing lain: tidak menyentuh vendors, assets,
-- contracts, roles lain, maupun role_permissions existing.
-- Role `sourcing` TIDAK dihapus otomatis (mungkin sudah dipakai
-- user_profiles) — hapus manual bila benar-benar ingin:
--   DELETE FROM roles WHERE role_name = 'sourcing';
-- ============================================================

DROP POLICY IF EXISTS "Vendor activity logs read" ON vendor_activity_logs;
DROP POLICY IF EXISTS "Vendor status history read" ON vendor_status_history;
DROP POLICY IF EXISTS "Vendor contacts update" ON vendor_contacts;
DROP POLICY IF EXISTS "Vendor contacts delete" ON vendor_contacts;
DROP POLICY IF EXISTS "Vendor contacts insert" ON vendor_contacts;
DROP POLICY IF EXISTS "Vendor contacts read" ON vendor_contacts;
DROP POLICY IF EXISTS "Vendor candidate specialties write" ON vendor_candidate_specialties;
DROP POLICY IF EXISTS "Vendor candidate specialties read" ON vendor_candidate_specialties;
DROP POLICY IF EXISTS "Vendor candidates update" ON vendor_candidates;
DROP POLICY IF EXISTS "Vendor candidates insert" ON vendor_candidates;
DROP POLICY IF EXISTS "Vendor candidates read" ON vendor_candidates;
DROP POLICY IF EXISTS "Vendor specialty write" ON vendor_specialties;
DROP POLICY IF EXISTS "Vendor specialty read" ON vendor_specialties;
DROP POLICY IF EXISTS "Vendor master write" ON vendor_categories;
DROP POLICY IF EXISTS "Vendor master read" ON vendor_categories;

DROP TRIGGER IF EXISTS trg_vendor_candidates_activity ON vendor_candidates;
DROP TRIGGER IF EXISTS trg_vendor_candidates_status_history ON vendor_candidates;
DROP TRIGGER IF EXISTS trg_vendor_candidates_updated_at ON vendor_candidates;
DROP TRIGGER IF EXISTS trg_vendor_candidates_guard ON vendor_candidates;
DROP TRIGGER IF EXISTS trg_vendor_specialties_updated_at ON vendor_specialties;
DROP TRIGGER IF EXISTS trg_vendor_categories_updated_at ON vendor_categories;
DROP FUNCTION IF EXISTS vendor_guard_restricted_columns();
DROP FUNCTION IF EXISTS vendor_record_activity();
DROP FUNCTION IF EXISTS vendor_record_status_change();
DROP FUNCTION IF EXISTS vendor_set_updated_at();

DROP TABLE IF EXISTS vendor_activity_logs CASCADE;
DROP TABLE IF EXISTS vendor_status_history CASCADE;
DROP TABLE IF EXISTS vendor_candidate_specialties CASCADE;
DROP TABLE IF EXISTS vendor_contacts CASCADE;
DROP TABLE IF EXISTS vendor_candidates CASCADE;
DROP TABLE IF EXISTS vendor_specialties CASCADE;
DROP TABLE IF EXISTS vendor_categories CASCADE;
DROP SEQUENCE IF EXISTS vendor_candidate_code_seq;

-- Hapus module key vendor_* dari role_permissions (tidak menghapus key lain)
DELETE FROM role_permissions WHERE module_key IN (
  'vendor_management', 'vendor_followups', 'vendor_samples',
  'vendor_qc', 'vendor_map', 'vendor_approval');

NOTIFY pgrst, 'reload schema';
