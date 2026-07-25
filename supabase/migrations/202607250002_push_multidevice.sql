-- =====================================================================
-- Push subscriptions: dukungan MULTI-PERANGKAT per user.
-- Sebelumnya: user_id sebagai PK → aktifkan di perangkat baru menimpa yang lama.
-- Sekarang: unik per endpoint (satu baris per perangkat/langganan), sehingga
-- satu user bisa punya banyak perangkat aktif bersamaan (HP + PC + dst.).
-- Migration ini menjaga data lama (endpoint diekstrak dari JSON subscription).
-- =====================================================================

-- 1) Lepas primary key lama (user_id) bila ada
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_pkey;

-- 2) Tambah kolom endpoint + isi dari JSON subscription yang sudah ada
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint TEXT;

UPDATE public.push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL AND subscription->>'endpoint' IS NOT NULL;

-- 3) Buang baris yang endpoint-nya tetap NULL (tidak valid), lalu NOT NULL
DELETE FROM public.push_subscriptions WHERE endpoint IS NULL;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint SET NOT NULL;

-- 4) Unik per endpoint (satu baris per perangkat)
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);

-- 5) Index user_id untuk lookup cepat di Edge Function
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);
