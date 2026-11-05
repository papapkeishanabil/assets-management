-- ============================================================
-- ROLLBACK hardening RLS 3 tabel (v3) — hanya jika terjadi gangguan.
-- PERINGATAN: mengembalikan kondisi SEBELUM hardening = anon bisa
-- membaca user_profiles/notifications/roles lagi. Jalankan HANYA
-- sementara menunggu perbaikan, atau setelah restore backup.
-- ============================================================
DROP TRIGGER IF EXISTS trg_profiles_guard_admin_fields ON public.user_profiles;
DROP FUNCTION IF EXISTS public.profiles_guard_admin_fields();

DROP POLICY IF EXISTS "profiles select authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles insert own or admin" ON public.user_profiles;
DROP POLICY IF EXISTS "profiles update own or admin" ON public.user_profiles;
DROP POLICY IF EXISTS "roles select authenticated" ON public.roles;
DROP POLICY IF EXISTS "roles write super admin" ON public.roles;
DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
DROP POLICY IF EXISTS "notifications insert authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications update own" ON public.notifications;

ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Helper dibiarkan (dipakai potensi modul lain) — atau hapus bila yakin:
-- DROP FUNCTION IF EXISTS public.is_app_role(text[]);
-- DROP FUNCTION IF EXISTS public.my_profile_id();

NOTIFY pgrst, 'reload schema';
