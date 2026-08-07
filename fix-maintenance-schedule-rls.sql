-- ============================================================
-- PERBAIKAN: Menu Jadwal Pemeliharaan Tidak Menampilkan Data
-- 
-- Masalah: Tabel `assets` memiliki RLS enabled, tetapi policy
-- "Read assets" mungkin belum ada di database. Akibatnya, join
-- `maintenance_schedules → assets` gagal dan halaman menampilkan
-- error "Gagal memuat data jadwal pemeliharaan".
--
-- Jalankan di Supabase SQL Editor, lalu refresh browser (Ctrl+F5)
-- ============================================================

-- 1. Pastikan policy "Read assets" ada (untuk user authenticated)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'Read assets'
  ) THEN
    CREATE POLICY "Read assets" ON assets
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 2. Pastikan policy "Read assets" juga mengizinkan anon (opsional,
--    jika ingin halaman bisa diakses tanpa login - tidak disarankan)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies
--     WHERE schemaname = 'public'
--       AND tablename = 'assets'
--       AND policyname = 'Read assets anon'
--   ) THEN
--     CREATE POLICY "Read assets anon" ON assets
--       FOR SELECT USING (auth.role() = 'anon');
--   END IF;
-- END $$;

-- 3. Pastikan foreign key maintenance_schedules.asset_id → assets ada
ALTER TABLE maintenance_schedules
  DROP CONSTRAINT IF EXISTS maintenance_schedules_asset_id_fkey;
ALTER TABLE maintenance_schedules
  ADD CONSTRAINT maintenance_schedules_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

-- 4. Refresh PostgREST schema cache agar relasi FK terdeteksi
NOTIFY pgrst, 'reload schema';

-- 5. Verifikasi: cek policy yang ada pada tabel assets
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'assets';