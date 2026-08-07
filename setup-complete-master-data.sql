-- ============================================
-- COMPLETE MASTER DATA SETUP
-- Setup semua master data untuk Asset Management
-- Jalankan di Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. ASSET CATEGORIES (sudah ada di script lain)
-- ============================================
SELECT 'Checking asset_categories...' as step;
SELECT COUNT(*) as total_categories FROM asset_categories;

-- ============================================
-- 2. ASSET LOCATIONS
-- ============================================
SELECT 'Setting up asset_locations...' as step;

INSERT INTO asset_locations (location_code, location_name, location_type, description, is_active) VALUES
  ('KANTOR', 'Kantor Pusat', 'Kantor', 'Lokasi kantor pusat perusahaan', true),
  ('PABRIK', 'Pabrik Utama', 'Pabrik', 'Lokasi pabrik produksi utama', true),
  ('GUDANG', 'Gudang Pusat', 'Gudang', 'Gudang penyimpanan aset dan barang', true)
ON CONFLICT (location_code) DO UPDATE SET is_active = true;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, is_active)
SELECT 'KANTOR_R1', 'Ruang Meeting', 'Ruangan', id, true FROM asset_locations WHERE location_code = 'KANTOR'
ON CONFLICT (location_code) DO NOTHING;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, is_active)
SELECT 'KANTOR_R2', 'Ruang IT', 'Ruangan', id, true FROM asset_locations WHERE location_code = 'KANTOR'
ON CONFLICT (location_code) DO NOTHING;

INSERT INTO asset_locations (location_code, location_name, location_type, parent_location_id, is_active)
SELECT 'PABRIK_AREA1', 'Area Produksi 1', 'Area Produksi', id, true FROM asset_locations WHERE location_code = 'PABRIK'
ON CONFLICT (location_code) DO NOTHING;

INSERT INTO asset_locations (location_code, location_name, location_type, is_active) VALUES
  ('VENDOR', 'Lokasi Vendor', 'Lokasi Vendor', true)
ON CONFLICT (location_code) DO NOTHING;

SELECT COUNT(*) as total_locations FROM asset_locations;

-- ============================================
-- 3. DEPARTMENTS
-- ============================================
SELECT 'Setting up departments...' as step;

INSERT INTO departments (department_code, department_name, description, is_active) VALUES
  ('HRD', 'Human Resource Development', 'Departemen SDM dan administrasi', true),
  ('IT', 'Information Technology', 'Departemen IT dan sistem informasi', true),
  ('PROD', 'Produksi', 'Departemen produksi garment', true),
  ('QC', 'Quality Control', 'Departemen kontrol kualitas', true),
  ('GUDANG', 'Gudang', 'Departemen gudang dan logistik', true),
  ('KEUANGAN', 'Keuangan', 'Departemen keuangan dan akuntansi', true)
ON CONFLICT (department_code) DO UPDATE SET is_active = true;

SELECT COUNT(*) as total_departments FROM departments;

-- ============================================
-- 4. VENDORS
-- ============================================
SELECT 'Setting up vendors...' as step;

INSERT INTO vendors (vendor_code, vendor_name, vendor_type, contact_person, phone_number, is_active) VALUES
  ('VND001', 'PT Servis Mesin Indonesia', 'Teknisi Mesin', 'Budi Santoso', '081234567890', true),
  ('VND002', 'CV Bengkel Motor Jaya', 'Bengkel Motor', 'Ahmad Ridwan', '081234567891', true),
  ('VND003', 'PT Teknologi Komputer', 'Teknisi Komputer', 'Siti Aminah', '081234567892', true),
  ('VND004', 'Bengkel Mobil Sejahtera', 'Bengkel Mobil', 'Agus Supriyanto', '081234567893', true)
ON CONFLICT (vendor_code) DO UPDATE SET is_active = true;

SELECT COUNT(*) as total_vendors FROM vendors;

-- ============================================
-- 5. ASSET RESPONSIBLES
-- ============================================
SELECT 'Setting up asset_responsibles...' as step;

INSERT INTO asset_responsibles (responsible_code, responsible_name, role_title, is_active) VALUES
  ('RESP001', 'Supervisor Produksi', 'Supervisor', true),
  ('RESP002', 'Manager Operasional', 'Manager', true),
  ('RESP003', 'Kepala Gudang', 'Kepala Gudang', true),
  ('RESP004', 'IT Support', 'Staff IT', true)
ON CONFLICT (responsible_code) DO UPDATE SET is_active = true;

SELECT COUNT(*) as total_responsibles FROM asset_responsibles;

-- ============================================
-- 6. DIVISIONS (jika ada tabel divisions)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'divisions') THEN
    INSERT INTO divisions (division_code, division_name, is_active) VALUES
      ('OPERASIONAL', 'Divisi Operasional', true),
      ('FINANCE', 'Divisi Finance', true),
      ('PRODUKSI', 'Divisi Produksi', true)
    ON CONFLICT (division_code) DO UPDATE SET is_active = true;
    
    RAISE NOTICE 'Divisions setup complete';
  END IF;
END $$;

-- ============================================
-- 7. VERIFIKASI SEMUA DATA
-- ============================================
SELECT 'Verification Results:' as summary;
SELECT 'Categories:' as type, COUNT(*) as count FROM asset_categories WHERE is_active = true
UNION ALL
SELECT 'Locations:' as type, COUNT(*) as count FROM asset_locations WHERE is_active = true
UNION ALL
SELECT 'Departments:' as type, COUNT(*) as count FROM departments WHERE is_active = true
UNION ALL
SELECT 'Vendors:' as type, COUNT(*) as count FROM vendors WHERE is_active = true
UNION ALL
SELECT 'Conditions:' as type, COUNT(*) as count FROM asset_conditions WHERE is_active = true
UNION ALL
SELECT 'Statuses:' as type, COUNT(*) as count FROM asset_statuses WHERE is_active = true
UNION ALL
SELECT 'Responsibles:' as type, COUNT(*) as count FROM asset_responsibles WHERE is_active = true;

SELECT '✅ Complete master data setup finished!' as message;