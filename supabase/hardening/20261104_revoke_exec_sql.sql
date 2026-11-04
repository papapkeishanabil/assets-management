-- ============================================================
-- HARDENING PRODUKSI — DISETUJUI USER 4 Nov 2026 (persetujuan
-- khusus revoc ini saja; tanpa hak mengubah hal lain)
--
-- Temuan audit 4 Nov 2026: fungsi public.exec_sql(text) bersifat
-- SECURITY DEFINER namun EXECUTE-nya di-grant ke PUBLIC/anon/
-- authenticated. Terbukti (probe read-only): kunci anon yang publik
-- di bundle frontend DAPAT mengeksekusi SQL arbitrer sebagai
-- current_user=postgres — melewati SELURUH RLS.
--
-- Perbaikan: cabut eksekusi dari role non-service. Aplikasi
-- (frontend & api/ Vercel) TIDAK memakai exec_sql — hanya script
-- maintenance lokal dengan service key (tetap berfungsi).
--
-- Prasyarat: tidak ada. Idempotent. TEREKSEKUSI 4 Nov 2026.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;

-- Verifikasi (harus hanya: postgres, service_role)
SELECT grantee
FROM information_schema.routine_privileges
WHERE routine_schema = 'public' AND routine_name = 'exec_sql'
ORDER BY grantee;
