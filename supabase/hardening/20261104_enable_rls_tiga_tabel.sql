-- ============================================================
-- HARDENING RLS 3 TABEL — v3 FINAL, DISETUJUI USER 4 Nov 2026
-- Target HANYA: public.user_profiles, public.roles,
-- public.notifications. Menutup kebocoran anon (terbukti) TANPA
-- mengganggu alur aplikasi.
--
-- Riwayat versi:
--  v1: policy inline → infinite recursion (self-read melingkar)
--  v2: helper SECURITY DEFINER → tervalidasi, tapi checklist akhir
--      user menemukan 2 celah eskalasi: self-insert bebas memilih
--      role_id (termasuk super_admin) & self-update role_id/
--      account_status (privesc)
--  v3: insert sendiri DIBATASI (role pelaksana/NULL + PENDING —
--      persis alur RegisterPage.jsx), kolom administratif profile
--      dilindungi trigger guard (pola vendor_guard yang sudah
--      tervalidasi), helper eksplisit schema-qualified + search_path
--      dikunci.
-- ============================================================

-- ---------- Helper pengecekan role (SECURITY DEFINER anti-rekursi) ----------
-- CASCADE: policy lama yang bergantung di-drop dan dibuat ulang di bawah.
DROP FUNCTION IF EXISTS public.is_app_role(text[]) CASCADE;
CREATE FUNCTION public.is_app_role(p_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.roles r ON r.id = up.role_id
    WHERE up.auth_user_id = auth.uid()
      AND up.account_status = 'ACTIVE'
      AND r.role_name = ANY(p_roles)
  );
$$;

DROP FUNCTION IF EXISTS public.my_profile_id() CASCADE;
CREATE FUNCTION public.my_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT up.id FROM public.user_profiles up WHERE up.auth_user_id = auth.uid();
$$;

-- Helper hanya menilai identitas PEMANGGIL (auth.uid()) — tidak bisa
-- dipakai membaca/mengubah data orang lain. Execute minimal.
REVOKE ALL ON FUNCTION public.is_app_role(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile_id() TO authenticated;

-- ---------- Guard kolom administratif user_profiles (anti-privesc) ----------
-- Perubahan role_id / account_status / approved_by / approved_at /
-- auth_user_id hanya untuk admin (hrd/super_admin) atau konteks
-- service tepercaya (RPC/backend). Tanpa guard, policy self-update
-- masih mengizinkan pengguna menaikkan role dirinya sendiri.
CREATE OR REPLACE FUNCTION public.profiles_guard_admin_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_service BOOLEAN;
  v_admin BOOLEAN;
BEGIN
  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN

    SELECT (auth.role() = 'service_role'
            OR current_user IN ('postgres', 'supabase_admin'))
    INTO v_service;
    SELECT public.is_app_role(ARRAY['hrd', 'super_admin']) INTO v_admin;

    IF NOT (v_service OR v_admin) THEN
      RAISE EXCEPTION 'DITOLAK: kolom administratif profil (role/status) hanya boleh diubah admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_guard_admin_fields ON public.user_profiles;
CREATE TRIGGER trg_profiles_guard_admin_fields BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_admin_fields();

-- ---------- user_profiles ----------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles select authenticated" ON public.user_profiles;
CREATE POLICY "profiles select authenticated" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

-- Registrasi (RegisterPage.jsx): user baru memasang profil SENDIRI dengan
-- role pelaksana/NULL dan status PENDING — selain itu ditolak.
-- Admin (hrd/super_admin) bebas mengelola (UsersPage).
DROP POLICY IF EXISTS "profiles insert own or admin" ON public.user_profiles;
CREATE POLICY "profiles insert own or admin" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (
    (
      auth_user_id = auth.uid()
      AND (account_status IS NULL OR account_status = 'PENDING')
      AND (
        role_id IS NULL
        OR EXISTS (SELECT 1 FROM public.roles rr
                   WHERE rr.id = role_id AND rr.role_name = 'pelaksana')
      )
    )
    OR public.is_app_role(ARRAY['hrd', 'super_admin'])
  );

-- Update baris: profil sendiri (kolom aman saja — kolom administratif
-- dijaga trigger di atas) atau admin.
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
