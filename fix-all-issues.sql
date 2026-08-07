-- ============================================
-- DIAGNOSIS & FIX ALL ISSUES
-- Jalankan di Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Cek & Perbaiki Kategori Kendaraan
-- ============================================

-- Cek struktur kategori kendaraan
SELECT 
  c1.id as parent_id,
  c1.category_code as parent_code,
  c1.category_name as parent_name,
  c1.parent_category_id,
  c2.id as child_id,
  c2.category_code as child_code,
  c2.category_name as child_name
FROM asset_categories c1
LEFT JOIN asset_categories c2 ON c2.parent_category_id = c1.id
WHERE c1.category_code = 'KEND' OR c2.category_code IN ('MBL', 'MTR', 'TRK', 'BUS', 'FLT', 'KDB')
ORDER BY c2.display_order;

-- Hapus self-reference jika ada
UPDATE asset_categories 
SET parent_category_id = NULL 
WHERE category_code = 'KEND' 
  AND parent_category_id IS NOT NULL 
  AND parent_category_id IN (SELECT id FROM asset_categories WHERE category_code = 'KEND');

-- Tambah sub-kategori jika belum ada
INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MBL', 'Mobil', id, 1 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO UPDATE SET parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND');

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'MTR', 'Motor', id, 2 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO UPDATE SET parent_category_id = (SELECT id FROM asset_categories WHERE category_code = 'KEND');

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'TRK', 'Truk', id, 3 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'BUS', 'Bus', id, 4 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'FLT', 'Forklift', id, 5 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

INSERT INTO asset_categories (category_code, category_name, parent_category_id, display_order)
SELECT 'KDB', 'Kendaraan Berat', id, 6 FROM asset_categories WHERE category_code = 'KEND'
ON CONFLICT (category_code) DO NOTHING;

-- ============================================
-- 2. Cek Tabel Employees dan Contract Ref
-- ============================================

-- Cek apakah kolom employee_ref_id ada
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'contracts' AND column_name = 'employee_ref_id';

-- Cek data employees
SELECT COUNT(*) as total_employees FROM employees;
SELECT id, employee_code, full_name, linked_user_id, employment_status FROM employees LIMIT 5;

-- Cek apakah ada employees yang belum punya linked_user_id
SELECT id, employee_code, full_name, linked_user_id 
FROM employees 
WHERE linked_user_id IS NULL AND employment_status = 'ACTIVE' 
LIMIT 10;

-- ============================================
-- 3. Fix Contract Number Race Condition
-- ============================================

DROP FUNCTION IF EXISTS generate_contract_number;

CREATE OR REPLACE FUNCTION generate_contract_number(category TEXT, year_val INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  new_code TEXT;
BEGIN
  prefix := CASE category
    WHEN 'EMPLOYEE' THEN 'EMP'
    WHEN 'VENDOR' THEN 'VND'
    ELSE 'CTR'
  END;
  
  PERFORM pg_advisory_xact_lock(hashtext('contract_seq_' || prefix || '_' || year_val::TEXT));
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM '\d{4}$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM contracts
  WHERE contract_number LIKE prefix || '-' || year_val || '-%';
  
  FOR i IN 1..10 LOOP
    new_code := prefix || '-' || year_val || '-' || LPAD(seq_num::TEXT, 4, '0');
    
    IF NOT EXISTS (SELECT 1 FROM contracts WHERE contract_number = new_code) THEN
      RETURN new_code;
    END IF;
    
    seq_num := seq_num + 1;
  END LOOP;
  
  RETURN prefix || '-' || year_val || '-' || LPAD(seq_num::TEXT, 4, '0') || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
END;
$$;

-- ============================================
-- 4. Cek Foreign Key Constraints
-- ============================================

-- Cek constraint pada contracts table
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'contracts' AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================
-- 5. Cek Contract Data
-- ============================================

-- Cek apakah ada contract dengan employee_id yang tidak ada di user_profiles
SELECT c.id, c.contract_number, c.employee_id, up.full_name
FROM contracts c
LEFT JOIN user_profiles up ON c.employee_id = up.id
WHERE c.employee_id IS NOT NULL AND up.id IS NULL;

-- Cek data kontrak yang ada
SELECT 
  c.id,
  c.contract_number,
  c.title,
  ct.type_name,
  c.contract_status,
  c.end_date
FROM contracts c
JOIN contract_types ct ON c.contract_type_id = ct.id
ORDER BY c.created_at DESC
LIMIT 20;

SELECT 'Fix script ejecutado. Silakan cek hasil di atas.' as message;