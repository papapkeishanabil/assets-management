-- Fix untuk kategori kendaraan yang hilang
-- Jalankan di Supabase SQL Editor

-- 1. Periksa apakah kategori kendaraan ada
SELECT * FROM asset_categories WHERE category_code IN ('KEND', 'MBL', 'MTR');

-- 2. Hapus kategori kendaraan yang bermasalah (jika ada self-reference)
DELETE FROM asset_categories WHERE category_code = 'KEND' AND parent_category_id IS NOT NULL;

-- 3. Hapus sub-kategori kendaraan
DELETE FROM asset_categories WHERE category_code IN ('MBL', 'MTR');

-- 4. Tambah ulang kategori kendaraan dengan benar
-- Parent kategori: Kendaraan Operasional
INSERT INTO asset_categories (category_code, category_name, display_order) VALUES
  ('KEND', 'Kendaraan Operasional', 1)
ON CONFLICT (category_code) DO UPDATE SET
  parent_category_id = NULL,
  is_active = true;

-- 5. Tambah sub-kategori kendaraan
-- Mobil
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MBL', 'Mobil', id, 1 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO UPDATE SET
  parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND'),
  is_active = true;

-- Motor
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MTR', 'Motor', id, 2 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO UPDATE SET
  parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND'),
  is_active = true;

-- 6. Tambah kategori kendaraan lainnya jika diperlukan
-- Truk
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'TRK', 'Truk', id, 3 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- Bus
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'BUS', 'Bus', id, 4 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- Forklift
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'FLT', 'Forklift', id, 5 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- Kendaraan Berat
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'KDB', 'Kendaraan Berat', id, 6 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- 7. Cek hasil
SELECT 
  c1.category_code as parent_code,
  c1.category_name as parent_name,
  c2.category_code as child_code,
  c2.category_name as child_name
FROM asset_categories c1
LEFT JOIN asset_categories c2 ON c2.parent_category_id = c1.id
WHERE c1.category_code = 'KEND'
ORDER BY c2.display_order;