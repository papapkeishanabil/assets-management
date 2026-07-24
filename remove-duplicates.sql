-- Hapus duplikasi kategori dan pastikan setiap kategori utama hanya ada 1

-- 1. Cek duplikasi
SELECT category_code, COUNT(*), array_agg(id) as ids
FROM asset_categories 
GROUP BY category_code 
HAVING COUNT(*) > 1;

-- 2. Hapus duplikasi, pertahankan yang paling lama (id terkecil)
-- Gunakan ROW_NUMBER untuk UUID
DELETE FROM asset_categories 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY category_code ORDER BY created_at ASC) as rn
    FROM asset_categories
  ) t WHERE rn > 1
);

-- 3. Cek hasil setelah hapus duplikasi
SELECT category_code, category_name, parent_category_id 
FROM asset_categories 
ORDER BY display_order;

-- 4. Set parent yang benar
UPDATE asset_categories 
SET parent_category_id = (
  SELECT id FROM asset_categories WHERE category_code = 'MESIN'
)
WHERE category_code IN ('MJ', 'MO', 'MC', 'MB')
  AND parent_category_id IS NULL;

UPDATE asset_categories 
SET parent_category_id = (
  SELECT id FROM asset_categories WHERE category_code = 'KEND'
)
WHERE category_code IN ('MBL', 'MTR')
  AND parent_category_id IS NULL;

UPDATE asset_categories 
SET parent_category_id = (
  SELECT id FROM asset_categories WHERE category_code = 'IT'
)
WHERE category_code IN ('LTP', 'PRN')
  AND parent_category_id IS NULL;

-- 5. Cek struktur akhir
SELECT 
  c1.category_code as parent_code,
  c1.category_name as parent_name,
  c2.category_code as child_code,
  c2.category_name as child_name
FROM asset_categories c1
LEFT JOIN asset_categories c2 ON c2.parent_category_id = c1.id
ORDER BY c1.display_order, c2.display_order;

SELECT 'Duplikasi dihapus dan struktur diperbaiki!' as message;