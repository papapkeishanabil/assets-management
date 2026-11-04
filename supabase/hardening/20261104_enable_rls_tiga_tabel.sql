-- ============================================================
-- PROPOSAL HARDENING #2 — BELUM DISETUJUI, JANGAN DIJALANKAN
--
-- Temuan audit 4 Nov 2026 (read-only): tiga tabel TANPA RLS sehingga
-- bisa dibaca ANON (terbukti via probe: HTTP 200 + data):
--   - public.user_profiles  (nama, email, telepon, role semua user!)
--   - public.notifications  (isi notifikasi internal)
--   - public.roles
--
-- Perbaikan di bawah menjaga SEMUA alur aplikasi yang ada:
--   - Registrasi: user baru insert profil SENDIRI (auth_user_id =
--     auth.uid()) → RegisterPage tetap jalan
--   - Dropdown PIC / penampilan nama: SELECT untuk authenticated
--   - UsersPage (admin): insert/update user oleh hrd/super_admin
--   - RolesPage: write roles oleh super_admin saja
--   - Notifikasi: baca/ubah milik sendiri; INSERT oleh authenticated
--     (fitur kirim reminder lintas role tetap jalan; anon tertutup)
--   - QR publik TIDAK terpengaruh (fungsi SECURITY DEFINER bypass RLS)
--
-- Setelah eksekusi, verifikasi: anon SELECT ketiga tabel → 401/42501;
-- login + registrasi + notifikasi tetap normal.
-- ============================================================

-- ---------- user_profiles ----------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles select authenticated" ON public.user_profiles;
CREATE POLICY "profiles select authenticated" ON public.user_profiles
  FOR SELECT TO authenticated USING (true);

-- Registrasi memasang profil milik sendiri; admin mengelola semua user
DROP POLICY IF EXISTS "profiles insert own or admin" ON public.user_profiles;
CREATE POLICY "profiles insert own or admin" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (
    auth_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
               WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
                 AND r.role_name IN ('hrd', 'super_admin'))
  );

DROP POLICY IF EXISTS "profiles update own or admin" ON public.user_profiles;
CREATE POLICY "profiles update own or admin" ON public.user_profiles
  FOR UPDATE TO authenticated USING (
    auth_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
               WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
                 AND r.role_name IN ('hrd', 'super_admin'))
  ) WITH CHECK (
    auth_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
               WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
                 AND r.role_name IN ('hrd', 'super_admin'))
  );
-- Tanpa policy DELETE: penghapusan akun via dashboard auth admin.

-- ---------- roles ----------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles select authenticated" ON public.roles;
CREATE POLICY "roles select authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles write super admin" ON public.roles;
CREATE POLICY "roles write super admin" ON public.roles
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id
            WHERE up.auth_user_id = auth.uid() AND up.account_status = 'ACTIVE'
              AND r.role_name = 'super_admin')
  );

-- ---------- notifications ----------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own" ON public.notifications
  FOR SELECT TO authenticated USING (
    user_id = (SELECT up.id FROM user_profiles up WHERE up.auth_user_id = auth.uid())
  );

-- INSERT oleh authenticated (pengirim reminder internal; anon tertutup).
-- Penguatan lebih ketat (batasi role pengirim) dapat menyusul terpisah
-- agar tidak memutus fitur reminder yang berjalan.
DROP POLICY IF EXISTS "notifications insert authenticated" ON public.notifications;
CREATE POLICY "notifications insert authenticated" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own" ON public.notifications
  FOR UPDATE TO authenticated USING (
    user_id = (SELECT up.id FROM user_profiles up WHERE up.auth_user_id = auth.uid())
  ) WITH CHECK (
    user_id = (SELECT up.id FROM user_profiles up WHERE up.auth_user_id = auth.uid())
  );
-- Tanpa policy DELETE (riwayat notifikasi tidak dihapus via API).

NOTIFY pgrst, 'reload schema';
