-- ============================================
-- DIAGNOSTIC & FIX FOR VEHICLE CATEGORY DISAPPEARING
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. CEK STRUKTUR KATEGORI KENDARAAN (menggunakan query yg sama seperti yg user tunjukkan)
SELECT 
  c1.category_code as parent_code,
  c1.category_name as parent_name,
  c1.parent_category_id as parent_parent_id,
  c2.category_code as child_code,
  c2.category_name as child_name,
  c2.parent_category_id as child_parent_id,
  c2.is_active as child_active
FROM asset_categories c1
LEFT JOIN asset_categories c2 ON c2.parent_category_id = c1.id
WHERE c1.category_code = 'KEND'
ORDER BY c2.display_order;

-- 2. CEK APAKAH ADA ASSET YANG CATEGORY_ID-NYA MENGACU KE KATEGORI YANG SUDAH DIHAPUS/DIHAPUSKAN
SELECT 
  a.id,
  a.asset_code,
  a.asset_name,
  a.category_id,
  ac.category_name,
  ac.category_code,
  ac.parent_category_id
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id
WHERE a.category_id IS NOT NULL
  AND ac.id IS NULL;

-- 3. CEK SEMUA ASSET DENGAN KATEGORI KENDARAAN
SELECT 
  a.id,
  a.asset_code,
  a.asset_name,
  a.category_id,
  ac.category_name as category_name,
  ac.category_code,
  ac.parent_category_id,
  parent.category_name as parent_category_name
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN asset_categories parent ON ac.parent_category_id = parent.id
WHERE ac.category_code IN ('MBL', 'MTR', 'TRK', 'BUS', 'FLT', 'KDB') 
   OR ac.category_code = 'KEND'
ORDER BY a.created_at DESC;

-- 4. FIX: Pastikan KEND parent_category_id = NULL (bukan self-reference)
UPDATE asset_categories 
SET parent_category_id = NULL 
WHERE category_code = 'KEND' 
  AND parent_category_id IS NOT NULL;

-- 5. FIX: Pastikan semua anak KEND punya parent_category_id yang benar
UPDATE asset_categories 
SET parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND')
WHERE parent_category_id IS NOT NULL
  AND category_code IN ('MBL', 'MTR', 'TRK', 'BUS', 'FLT', 'KDB');

-- 6. FIX: Pastikan semua kategori aktif
UPDATE asset_categories 
SET is_active = true 
WHERE category_code IN ('KEND', 'MBL', 'MTR', 'TRK', 'BUS', 'FLT', 'KDB');

-- 7. TAMBAHKAN KATEGORI YANG HILANG (jika ada)
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'KEND', 'Kendaraan Operasional', NULL, 1, true
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_code = 'KEND')
ON CONFLICT (category_code) DO UPDATE SET parent_category_id = NULL, is_active = true;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'MBL', 'Mobil', id, 1, true FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO UPDATE SET parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND'), is_active = true;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'MTR', 'Motor', id, 2, true FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO UPDATE SET parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND'), is_active = true;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'TRK', 'Truk', id, 3, true FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'BUS', 'Bus', id, 4, true FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'FLT', 'Forklift', id, 5, true FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order, is_active)
SELECT 'KDB', 'Kendaraan Berat', id, 6, true FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- 8. VERIFIKASI HASIL
SELECT 
  c1.category_code as parent_code,
  c1.category_name as parent_name,
  c1.id as parent_id,
  c2.category_code as child_code,
  c2.category_name as child_name,
  c2.parent_category_id as child_parent_id,
  c2.is_active as child_active
FROM asset_categories c1
LEFT JOIN asset_categories c2 ON c2.parent_category_id = c1.id
WHERE c1.category_code = 'KEND'
ORDER BY c2.display_order;

SELECT 'Diagnostic & Fix Complete' as message;