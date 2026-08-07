-- ============================================
-- SCHEMA PHASE 2 - MASTER DATA & ASSETS
-- Jalankan di Supabase SQL Editor
-- ============================================

-- ============================================
-- BAGIAN 1: BUAT TABEL BARU (jika belum ada)
-- ============================================

-- 1. ASSET CATEGORIES
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

-- 2. ASSET LOCATIONS (drop old table first, recreate)
DROP TABLE IF EXISTS asset_locations CASCADE;
CREATE TABLE asset_locations (
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

-- 3. DEPARTMENTS
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

-- 4. VENDORS
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

-- 5. ASSET CONDITIONS
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

-- 6. ASSET STATUSES
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

-- 7. ALTER EXISTING ASSETS TABLE
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES asset_categories(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS model VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS manufacture_year INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(18,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_start_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS warranty_end_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES asset_locations(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES user_profiles(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS condition_id UUID REFERENCES asset_conditions(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS status_id UUID REFERENCES asset_statuses(id);
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
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES user_profiles(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- 8. ASSET DOCUMENTS
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

-- 9. ASSET PHOTOS
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

-- 10. ASSET ACTIVITY LOGS
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

-- ============================================
-- BAGIAN 2: INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON assets(condition_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status_id);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(asset_name);
CREATE INDEX IF NOT EXISTS idx_assets_responsible ON assets(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(is_active);
CREATE INDEX IF NOT EXISTS idx_asset_categories_parent ON asset_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_asset_locations_parent ON asset_locations(parent_location_id);
CREATE INDEX IF NOT EXISTS idx_asset_documents_asset ON asset_documents(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_photos_asset ON asset_photos(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_activity_asset ON asset_activity_logs(asset_id);

-- ============================================
-- BAGIAN 3: FUNCTION & TRIGGER
-- ============================================
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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BAGIAN 4: RLS POLICIES
-- ============================================
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop all policies
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies 
    WHERE tablename IN ('asset_categories','asset_locations','departments','vendors','asset_conditions','asset_statuses','assets','asset_documents','asset_photos','asset_activity_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Read master data
CREATE POLICY "Read master data" ON asset_categories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read master data" ON asset_locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read master data" ON departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read master data" ON vendors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read master data" ON asset_conditions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Read master data" ON asset_statuses FOR SELECT USING (auth.role() = 'authenticated');

-- Write master data
CREATE POLICY "Write categories" ON asset_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Write locations" ON asset_locations FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Write departments" ON departments FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Write vendors" ON vendors FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);

-- Assets RLS
CREATE POLICY "Read assets" ON assets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert assets" ON assets FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Update assets" ON assets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Delete assets" ON assets FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);

-- Documents, Photos, Logs
CREATE POLICY "Read documents" ON asset_documents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Write documents" ON asset_documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Delete documents" ON asset_documents FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Read photos" ON asset_photos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Write photos" ON asset_photos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Delete photos" ON asset_photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
);
CREATE POLICY "Read activity logs" ON asset_activity_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Insert activity logs" ON asset_activity_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- BAGIAN 5: SEED DATA
-- ============================================
INSERT INTO asset_conditions (condition_name, description, display_order, icon_name) VALUES
  ('Sangat Baik', 'Aset dalam kondisi sangat baik, seperti baru', 1, 'thumbs-up'),
  ('Baik', 'Aset dalam kondisi baik dan berfungsi normal', 2, 'check'),
  ('Perlu Perhatian', 'Aset perlu perhatian atau perbaikan ringan', 3, 'alert-triangle'),
  ('Rusak Ringan', 'Aset mengalami kerusakan ringan', 4, 'tool'),
  ('Rusak Berat', 'Aset mengalami kerusakan berat', 5, 'x-circle')
ON CONFLICT (condition_name) DO NOTHING;

INSERT INTO asset_statuses (status_name, description, is_operational, display_order, icon_name) VALUES
  ('Aktif', 'Aset aktif dan digunakan', true, 1, 'check-circle'),
  ('Dalam Pemeliharaan', 'Aset sedang dalam pemeliharaan', true, 2, 'wrench'),
  ('Rusak', 'Aset dalam kondisi rusak', false, 3, 'alert-circle'),
  ('Tidak Digunakan', 'Aset tidak digunakan', false, 4, 'pause-circle'),
  ('Dipinjamkan', 'Aset sedang dipinjamkan', true, 5, 'users'),
  ('Berada di Vendor', 'Aset berada di vendor', false, 6, 'truck'),
  ('Dijual', 'Aset dalam proses dijual', false, 7, 'tag'),
  ('Dihapuskan', 'Aset telah dihapuskan', false, 8, 'trash-2'),
  ('Hilang', 'Aset dilaporkan hilang', false, 9, 'frown')
ON CONFLICT (status_name) DO NOTHING;