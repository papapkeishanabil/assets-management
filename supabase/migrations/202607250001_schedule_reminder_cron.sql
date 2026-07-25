-- =====================================================================
-- Server-side schedule reminders (Fase 1 + Fase 2)
-- Edge Function "generate-reminders" dipicu tiap hari 08:00 WIB via pg_cron.
-- Ditambah tabel push_subscriptions untuk Web Push (Fase 2).
-- =====================================================================

-- 1) Tabel push_subscriptions (satu subscription per user; cocok dgn
--    helper src/lib/push-notifications.js yang upsert onConflict 'user_id')
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  user_id      UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Ekstensi yang dibutuhkan (jika belum aktif).
--    Di Supabase Cloud, aktifkan juga via Dashboard → Database → Extensions
--    (cari "pg_cron" dan "pg_net") bila perintah di bawah tidak diizinkan.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;   -- umumnya di-skema-kan "extensions" oleh Supabase

-- 3) Jadwalkan pemanggilan Edge Function setiap hari pukul 08:00 WIB.
--    08:00 WIB = 01:00 UTC → cron '0 1 * * *'.
--
--    SEBELUM MENJALANKAN: ganti dua placeholder di bawah:
--      <PROJECT_REF>  → project ref Anda (Dashboard → Settings → General → "Reference ID")
--                      contoh: uwlxkwyauxwewoexfgwi
--      <CRON_SECRET>  → string acak yang SAMA dengan env var CRON_SECRET
--                      pada Edge Function (lihat instruksi setup).
SELECT cron.schedule(
  'harmas-reminders-daily',
  '0 1 * * *',
  $body$
  SELECT net.http_post(
    url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/generate-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  )
  $body$
);

-- =====================================================================
-- Catatan pengelolaan (jalankan manual di SQL Editor bila perlu):
--
-- Lihat daftar job cron:
--   SELECT jobid, schedule, command, active FROM cron.job;
--
-- Cek hasil run terakhir (pg_net menyimpan respons di net._http_response):
--   SELECT id, status_code, content_type, left(content::text, 300) AS body
--   FROM net._http_response ORDER BY id DESC LIMIT 5;
--
-- Hentikan/jadwalkan ulang:
--   SELECT cron.unschedule('harmas-reminders-daily');
-- =====================================================================
