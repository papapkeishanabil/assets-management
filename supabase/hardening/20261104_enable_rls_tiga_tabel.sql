-- ============================================================
-- PROPOSAL HARDENING #2 (v2 hasil validasi lokal) — MENUNGGU
-- PERSETUJUAN, JANGAN DIJALANKAN DI PRODUKSI TANPA PERSETUJUAN.
--
-- Temuan audit 4 Nov 2026 (read-only): tiga tabel TANPA RLS sehingga
-- bisa dibaca ANON (terbukti probe: HTTP 200 + data):
--   - public.user_profiles  (nama, email, telepon semua user)
--   - public.notifications  (isi notifikasi internal)
--   - public.roles
--
-- v2: versi awal menimpa INFINITE RECURSION (policy user_profiles
-- membaca user_profiles/roles secara melingkar). Solusi standar
-- Supabase: helper SECURITY DEFINER sehingga pengecekan role tidak
-- menerapkan RLS tabel yang diperiksa. Tervalidasi lokal (stack uji):
-- anon tertutup; registrasi insert profil sendiri jalan; dropdown PIC
-- jalan; roles hanya super_admin; notifikasi milik sendiri.
-- ============================================================

-- ---------- Helper pengecekan role (SECURITY DEFINER anti-rekursi) ----------
CREATE OR REPLACE FUNCTION public.is_app_role(p_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up JOIN roles r ON r.id = up.role_id
    WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
      AND r.role_name = ANY(p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.my_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id FROM user_profiles up WHERE up.auth_user_id = auth.uid();
$$;

-- Helper hanya menilai diri pemanggil: boleh dieksekusi role internal,
-- tidak berguna bagi penyerang (output boolean/uuid milik sendiri).
REVOKE ALL ON FUNCTION public.is_app_role(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile_id() TO authenticated;

-- ---------- user_profiles ----------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles select authenticated" ON public.user_profiles;
CREATE POLICY "profiles select authenticated" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

-- Registrasi: user baru memasang profil SENDIRI (RegisterPage tetap jalan);
-- admin (hrd/super_admin) mengelola semua user (UsersPage).
DROP POLICY IF EXISTS "profiles insert own or admin" ON public.user_profiles;
CREATE POLICY "profiles insert own or admin" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_id = auth.uid() OR public.is_app_role(ARRAY['hrd', 'super_admin'])
  );

DROP POLICY IF EXISTS "profiles update own or admin" ON public.user_profiles;
CREATE POLICY "profiles update own or admin" ON public.user_profiles
  FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid() OR public.is_app_role(ARRAY['hrd', 'super_admin']))
    WITH CHECK (auth_user_id = auth.uid() OR public.is_app_role(ARRAY['hrd', 'super_admin']));
-- Tanpa policy DELETE: penghapusan akun via dashboard auth admin.

-- ---------- roles ----------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles select authenticated" ON public.roles;
CREATE POLICY "roles select authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles write super admin" ON public.roles;
CREATE POLICY "roles write super admin" ON public.roles
  FOR ALL TO authenticated
    USING (public.is_app_role(ARRAY['super_admin']))
    WITH CHECK (public.is_app_role(ARRAY['super_admin']));

-- ---------- notifications ----------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = public.my_profile_id());

-- INSERT oleh authenticated (pengirim reminder internal; anon tertutup).
-- Penguatan lebih ketat (batasi role pengirim) menyusul terpisah agar
-- tidak memutus fitur reminder yang berjalan.
DROP POLICY IF EXISTS "notifications insert authenticated" ON public.notifications;
CREATE POLICY "notifications insert authenticated" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own" ON public.notifications
  FOR UPDATE TO authenticated
    USING (user_id = public.my_profile_id())
    WITH CHECK (user_id = public.my_profile_id());
-- Tanpa policy DELETE (riwayat notifikasi tidak dihapus via API).

NOTIFY pgrst, 'reload schema';
