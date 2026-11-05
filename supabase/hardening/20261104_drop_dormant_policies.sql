-- ============================================================
-- PEMULIHAN INSIDEN — DISETUJUI DARURAT USER 5 Nov 2026
-- Kelima policy di bawah adalah policy DORMAN (inert bertahun-tahun
-- karena RLS ketiga tabel tidak aktif) yang ikut menyala saat hardening
-- RLS v3 diaktifkan, menyebabkan infinite recursion (HTTP 500) pada
-- user_profiles untuk semua role + celah INSERT notifikasi oleh anon.
-- Policy ini duplikat/nominal tergantikan oleh policy hardening v3
-- (tervalidasi lokal 12/12). TEREKSEKUSI 5 Nov 2026, atomik.
-- ============================================================
DROP POLICY IF EXISTS notifications_insert_any ON public.notifications;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
DROP POLICY IF EXISTS "HRD can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Super Admin full access" ON public.user_profiles;

NOTIFY pgrst, 'reload schema';
