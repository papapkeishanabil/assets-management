-- ============================================
-- DIAGNOSTIC: LOKASI ASET HILANG
-- Cek data lokasi aset yang seharusnya ada
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. CEK TABEL LOKASI SEKARANG
SELECT 
  id,
  location_code,
  location_name,
  location_type,
  parent_location_id,
  is_active,
  created_at
FROM asset_locations 
ORDER BY location_name;

-- 2. CEK APAKAH DATA PERNAH ADA?
-- Lihat log/perubahan tabel
SELECT 
  table_name,
  operation,
  occurred_at
FROM audit_log_table 
WHERE table_name = 'asset_locations'
ORDER BY occurred_at DESC
LIMIT 10;

-- 3. CEK MIGRASI YANG BERMASALAH
-- DROP TABLE yg mungkin menghapus data
SELECT 
  'schema-phase2.sql line 25: DROP TABLE IF EXISTS asset_locations CASCADE;' as warning,
  'Migration ini bisa menghapus semua data lokasi!' as impact
FROM information_schema.tables 
WHERE table_name = 'asset_locations';

-- 4. CEK APAKAH RLS BLOKING
-- Nonaktifkan RLS sementara untuk testing
-- ALTER TABLE asset_locations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE asset_locations ENABLE ROW LEVEL SECURITY;

-- 5. INSERT DATA LOKASI YG HILANG (KANTOR, PABRIK, VENDOR)
INSERT INTO asset_locations (location_code, location_name, location_type, description, is_active) VALUES
  ('KANTOR', 'Kantor Pusat', 'Kantor', 'Lokasi kantor pusat perusahaan', true),
  ('PABRIK', 'Pabrik Utama', 'Pabrik', 'Lokasi pabrik produksi utama', true),
  ('VENDOR', 'Lokasi Vendor', 'Lokasi Vendor', 'Aset berada di vendor untuk servis/perbaikan', true)
ON CONFLICT (location_code) DO UPDATE SET 
  is_active = true,
  location_name = EXCLUDED.location_name,
  location_type = EXCLUDED.location_type;

-- 6. INSERT GUDANG JIKA PERLU
INSERT INTO asset_locations (location_code, location_name, location_type, description, is_active) VALUES
  ('GUDANG', 'Gudang Pusat', 'Gudang', 'Gudang penyimpanan aset', true)
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

-- 7. VERIFIKASI LOKASI SETELAH INSERT
SELECT 
  'After Fix:' as status,
  location_code,
  location_name,
  location_type,
  is_active
FROM asset_locations 
WHERE location_code IN ('KANTOR', 'PABRIK', 'VENDOR', 'GUDANG')
ORDER BY location_code;

-- 8. CEK ASSET YG CATEGORY_ID OKE TAPI LOCATION_ID NULL
SELECT 
  a.id,
  a.asset_code,
  a.asset_name,
  a.category_id,
  ac.category_name,
  a.location_id,
  al.location_name,
  CASE 
    WHEN a.location_id IS NULL THEN '⚠️ LOKASI KOSONG'
    WHEN al.id IS NULL THEN '⚠️ LOKASI TIDAK VALID'
    ELSE '✅ OK'
  END as status
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN asset_locations al ON a.location_id = al.id
WHERE a.is_active = true
  AND (a.location_id IS NULL OR al.id IS NULL)
LIMIT 20;

SELECT 'Diagnostic complete. Run setup-asset-locations.sql if data missing.' as message;