-- ============================================================
-- Migration: Vendor Contact untuk Aset di Lokasi Vendor
-- Ketika aset ditempatkan di lokasi vendor, kolom penanggung jawab
-- harus menampilkan nama vendor sebagai pilihan.
-- ============================================================

-- 1. Tambah kolom vendor_contact_name di tabel assets
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS vendor_contact_name TEXT;

-- 2. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- 3. Verifikasi
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assets'
  AND column_name = 'vendor_contact_name';
