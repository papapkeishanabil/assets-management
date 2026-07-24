-- ============================================
-- PHASE 2 SETUP - JALANKAN DI SUPABASE SQL EDITOR
-- ============================================

-- 1. BUAT TABEL KATEGORI
CREATE TABLE IF NOT EXISTS asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code VARCHAR(20) UNIQUE NOT NULL,
  category_name VARCHAR(255) NOT NULL,
  parent_category_id UUID REFERENCES asset_categories(id),
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BUAT TABEL LOKASI
CREATE TABLE IF NOT EXISTS asset_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_code VARCHAR(20) UNIQUE NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  location_type VARCHAR(100),
  parent_location_id UUID REFERENCES asset_locations(id),
  address TEXT,
  responsible_user_id UUID REFERENCES user_profiles(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BUAT TABEL DEPARTEMEN
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_code VARCHAR(20) UNIQUE NOT NULL,
  department_name VARCHAR(255) NOT NULL,
  description TEXT,
  department_head_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BUAT TABEL VENDOR
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code VARCHAR(20) UNIQUE NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  vendor_type VARCHAR(100),
  contact_person TEXT,
  whatsapp_number VARCHAR(50),
  phone_number VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  tax_number VARCHAR(50),
  service_type TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BUAT TABEL KONDISI ASET
CREATE TABLE IF NOT EXISTS asset_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  icon_name VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BUAT TABEL STATUS ASET
CREATE TABLE IF NOT EXISTS asset_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_operational BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  icon_name VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TAMBAH KOLOM KE TABEL ASSETS YANG SUDAH ADA
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacture_year INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(18,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_start_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_end_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS department_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS responsible_user_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS condition_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS status_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS vehicle_registration_number VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS engine_number VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS current_odometer DECIMAL(12,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS current_operating_hours DECIMAL(12,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS technical_specification TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS primary_photo_url TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deactivated_by UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- 8. BUAT TABEL DOKUMEN
CREATE TABLE IF NOT EXISTS asset_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  document_name VARCHAR(255),
  document_type VARCHAR(100),
  document_number VARCHAR(100),
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT NOT NULL,
  notes TEXT,
  uploaded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. BUAT TABEL FOTO
CREATE TABLE IF NOT EXISTS asset_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'foto',
  caption TEXT,
  is_primary BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. BUAT TABEL ACTIVITY LOG
CREATE TABLE IF NOT EXISTS asset_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. INSERT DATA AWAL
INSERT INTO asset_conditions (condition_name, description, display_order, icon_name) VALUES
  ('Sangat Baik', 'Aset dalam kondisi sangat baik', 1, 'thumbs-up'),
  ('Baik', 'Aset dalam kondisi baik', 2, 'check'),
  ('Perlu Perhatian', 'Aset perlu perhatian', 3, 'alert-triangle'),
  ('Rusak Ringan', 'Kerusakan ringan', 4, 'tool'),
  ('Rusak Berat', 'Kerusakan berat', 5, 'x-circle')
ON CONFLICT (condition_name) DO NOTHING;

INSERT INTO asset_statuses (status_name, description, is_operational, display_order, icon_name) VALUES
  ('Aktif', 'Aset aktif', true, 1, 'check-circle'),
  ('Dalam Pemeliharaan', 'Sedang diperbaiki', true, 2, 'wrench'),
  ('Rusak', 'Aset rusak', false, 3, 'alert-circle'),
  ('Tidak Digunakan', 'Tidak digunakan', false, 4, 'pause-circle'),
  ('Dipinjamkan', 'Sedang dipinjam', true, 5, 'users'),
  ('Berada di Vendor', 'Di vendor', false, 6, 'truck'),
  ('Dijual', 'Dijual', false, 7, 'tag'),
  ('Dihapuskan', 'Dihapus', false, 8, 'trash-2'),
  ('Hilang', 'Hilang', false, 9, 'frown')
ON CONFLICT (status_name) DO NOTHING;

-- 12. BUAT FUNCTION UNTUK GENERATE KODE ASET
CREATE OR REPLACE FUNCTION generate_asset_code(cat_code TEXT, year_val INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_num INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(asset_code FROM '\d{4}$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM assets
  WHERE asset_code LIKE cat_code || '-' || year_val || '-%';
  
  new_code := cat_code || '-' || year_val || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_code;
END;
$$;

-- 13. BUAT TRIGGER UNTUK UPDATE TIMESTAMP
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. BUAT INDEX UNTUK PERFORMA
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON assets(condition_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status_id);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_asset_categories_parent ON asset_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_asset_locations_parent ON asset_locations(parent_location_id);

-- 15. CEK HASIL
SELECT 'Setup Phase 2 berhasil!' as message;