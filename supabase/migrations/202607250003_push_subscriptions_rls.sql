-- =====================================================================
-- RLS untuk push_subscriptions.
-- Tiap user hanya boleh membaca/menulis langganan MILIKNYA sendiri
-- (user_id = user_profiles.id milik auth.uid()).
-- Edge Function memakai service_role (bypass RLS) untuk membaca semua
-- subscription saat mengirim push.
-- =====================================================================

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama (jika ada) lalu buat yang baru
DROP POLICY IF EXISTS push_subscriptions_user_manage ON public.push_subscriptions;

CREATE POLICY push_subscriptions_user_manage ON public.push_subscriptions
  FOR ALL
  USING (
    user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.user_profiles WHERE auth_user_id = auth.uid())
  );
