-- Setup Kategori Aset dengan struktur hierarki
-- Jalankan di Supabase SQL Editor

-- 1. Buat kategori parent (Kendaraan Operasional)
INSERT INTO asset_categories (category_code, category_name, display_order) VALUES
  ('KEND', 'Kendaraan Operasional', 1)
ON CONFLICT (category_code) DO NOTHING;

-- 2. Buat kategori parent (Mesin Produksi)
INSERT INTO asset_categories (category_code, category_name, display_order) VALUES
  ('MESIN', 'Mesin Produksi', 2)
ON CONFLICT (category_code) DO NOTHING;

-- 3. Buat kategori parent (Peralatan Kantor & IT)
INSERT INTO asset_categories (category_code, category_name, display_order) VALUES
  ('IT', 'Peralatan Kantor & IT', 3)
ON CONFLICT (category_code) DO NOTHING;

-- 4. Buat sub-kategori Kendaraan (child dari KEND)
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MBL', 'Mobil', id, 1 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MTR', 'Motor', id, 2 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- 5. Buat sub-kategori Mesin (child dari MESIN)
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MJ', 'Mesin Jahit', id, 1 FROM asset_categories WHERE category_code = 'MESIN'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MO', 'Mesin Obras', id, 2 FROM asset_categories WHERE category_code = 'MESIN'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MB', 'Mesin Bordir', id, 3 FROM asset_categories WHERE category_code = 'MESIN'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MC', 'Mesin Cutting', id, 4 FROM asset_categories WHERE category_code = 'MESIN'
ON CONFLICT (category_code) DO NOTHING;

-- 6. Buat sub-kategori IT (child dari IT)
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'LTP', 'Laptop', id, 1 FROM asset_categories WHERE category_code = 'IT'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'PRN', 'Printer', id, 2 FROM asset_categories WHERE category_code = 'IT'
ON CONFLICT (category_code) DO NOTHING;

-- 7. Cek hasil
SELECT 
  c1.category_code as parent_code,
  c1.category_name as parent_name,
  c2.category_code as child_code,
  c2.category_name as child_name
FROM asset_categories c1
LEFT JOIN asset_categories c2 ON c2.parent_category_id = c1.id
ORDER BY c1.display_order, c2.display_order;

SELECT 'Setup kategori selesai!' as message;