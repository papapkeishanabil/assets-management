-- ============================================
-- SETUP LOKASI ASET (Asset Locations)
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. CEK TABEL LOKASI
SELECT COUNT(*) as total_locations FROM asset_locations;
SELECT * FROM asset_locations LIMIT 10;

-- 2. HAPUS DATA LAMA JIKA ADA (opsional)
-- DELETE FROM asset_locations WHERE location_code IN ('KANTOR', 'PABRIK', 'GUDANG', 'RUANG1', 'RUANG2', 'AREA_PROD', 'VENDOR');

-- 3. INSERT DATA LOKASI UTAMA
INSERT INTO asset_locations (location_code, location_name, location_type, description, is_active) VALUES
  ('KANTOR', 'Kantor Pusat', 'Kantor', 'Lokasi kantor pusat perusahaan', true),
  ('PABRIK', 'Pabrik Utama', 'Pabrik', 'Lokasi pabrik produksi utama', true),
  ('VENDOR', 'Lokasi Vendor', 'Lokasi Vendor', 'Aset berada di lokasi vendor untuk servis/perbaikan', true)
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

-- 4. INSERT DATA LOKASI RUANG (SUB-LOKASI)
-- Ruang di Kantor
INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'KANTOR_R1', 'Ruang Meeting', 'Ruangan', id, 'Ruang meeting lantai 1', true 
FROM asset_locations WHERE location_code = 'KANTOR'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'KANTOR_R2', 'Ruang IT', 'Ruangan', id, 'Ruang IT dan server', true 
FROM asset_locations WHERE location_code = 'KANTOR'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'KANTOR_R3', 'Ruang HR', 'Ruangan', id, 'Ruang HRD dan admin', true 
FROM asset_locations WHERE location_code = 'KANTOR'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

-- Ruang di Pabrik
INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'PABRIK_AREA1', 'Area Produksi 1', 'Area Produksi', id, 'Area produksi mesin jahit', true 
FROM asset_locations WHERE location_code = 'PABRIK'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'PABRIK_AREA2', 'Area Produksi 2', 'Area Produksi', id, 'Area produksi mesin obras', true 
FROM asset_locations WHERE location_code = 'PABRIK'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'PABRIK_AREA3', 'Area Penyelesaian', 'Area Produksi', id, 'Area penyelesaian dan QC', true 
FROM asset_locations WHERE location_code = 'PABRIK'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

-- Ruang di Gudang
INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'GUDANG_A', 'Gudang A', 'Ruangan', id, 'Gudang A - Bahan Baku', true 
FROM asset_locations WHERE location_code = 'GUDANG'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, description, is_active)
SELECT 'GUDANG_B', 'Gudang B', 'Ruangan', id, 'Gudang B - Barang Jadi', true 
FROM asset_locations WHERE location_code = 'GUDANG'
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

-- 5. INSERT LOKASI VENDOR
INSERT INTO asset_locations (location_code, location_name, location_type, description, is_active) VALUES
  ('VENDOR', 'Lokasi Vendor', 'Lokasi Vendor', 'Aset berada di lokasi vendor untuk servis/perbaikan', true)
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

-- 6. VERIFIKASI HASIL
SELECT 
  l1.location_code as parent_code,
  l1.location_name as parent_name,
  l1.location_type as parent_type,
  l2.location_code as child_code,
  l2.location_name as child_name,
  l2.location_type as child_type
FROM asset_locations l1
LEFT JOIN asset_locations l2 ON l2.parent_location_id = l1.id
WHERE l1.parent_location_id IS NULL
ORDER BY l1.location_code, l2.location_code;

-- 7. HITUNG TOTAL LOKASI
SELECT COUNT(*) as total_locations FROM asset_locations WHERE is_active = true;

SELECT 'Setup lokasi aset selesai!' as message;