-- ============================================
-- CONTRACT MANAGEMENT SCHEMA
-- Kontrak Karyawan & Vendor dengan notifikasi
-- ============================================

-- 1. CONTRACT TYPES
CREATE TABLE IF NOT EXISTS contract_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code VARCHAR(20) UNIQUE NOT NULL,
  type_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('EMPLOYEE', 'VENDOR', 'OTHER')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default contract types
INSERT INTO contract_types (type_code, type_name, category, description) VALUES
  ('EMP_PKWT', 'PKWT (Kontrak Waktu Tertentu)', 'EMPLOYEE', 'Kontrak kerja karyawan waktu tertentu'),
  ('EMP_PKWTT', 'PKWTT (Kontrak Waktu Tidak Tertentu)', 'EMPLOYEE', 'Kontrak kerja karyawan tetap'),
  ('EMP_PROBATION', 'Masa Percobaan', 'EMPLOYEE', 'Masa percobaan karyawan baru'),
  ('EMP_OUTSOURCING', 'Kontrak Outsourcing', 'EMPLOYEE', 'Karyawan outsourcing'),
  ('VND_MAINTENANCE', 'Kontrak Maintenance', 'VENDOR', 'Kontrak pemeliharaan dengan vendor'),
  ('VND_SUPPLY', 'Kontrak Pengadaan', 'VENDOR', 'Kontrak pengadaan barang/jasa'),
  ('VND_SERVICE', 'Kontrak Jasa', 'VENDOR', 'Kontrak jasa vendor'),
  ('VND_RENTAL', 'Kontrak Sewa', 'VENDOR', 'Kontrak sewa alat/kendaraan'),
  ('OTHER_LEASE', 'Kontrak Sewa Lainnya', 'OTHER', 'Kontrak sewa gedung/tanah'),
  ('OTHER_AGREEMENT', 'Perjanjian Lainnya', 'OTHER', 'Perjanjian kerjasama lainnya')
ON CONFLICT (type_code) DO NOTHING;

-- 2. CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  contract_type_id UUID NOT NULL REFERENCES contract_types(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pihak terkait
  employee_id UUID REFERENCES user_profiles(id),
  vendor_id UUID REFERENCES vendors(id),
  department_id UUID REFERENCES departments(id),
  
  -- Tanggal kontrak
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  signed_date DATE,
  renewal_date DATE,
  
  -- Nilai kontrak
  contract_value DECIMAL(18,2),
  currency VARCHAR(10) DEFAULT 'IDR',
  
  -- Dokumen
  document_url TEXT,
  document_name VARCHAR(255),
  
  -- Pengaturan notifikasi
  reminder_days_before INTEGER DEFAULT 7,
  
  -- Status
  contract_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (contract_status IN ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED', 'CANCELLED')),
  is_active BOOLEAN DEFAULT true,
  
  -- Pihak yang bertanggung jawab
  responsible_user_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id),
  
  -- Notes
  notes TEXT,
  termination_reason TEXT,
  terminated_at TIMESTAMPTZ,
  terminated_by UUID REFERENCES user_profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CONTRACT REMINDERS (untuk tracking notifikasi)
CREATE TABLE IF NOT EXISTS contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  notification_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reminder_date DATE NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_department ON contracts(department_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(contract_status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_active ON contracts(is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract ON contract_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_user ON contract_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_sent ON contract_reminders(is_sent);

-- ============================================
-- FUNCTION: Generate contract number
-- ============================================
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
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM '\d{4}$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM contracts
  WHERE contract_number LIKE prefix || '-' || year_val || '-%';
  
  new_code := prefix || '-' || year_val || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_code;
END;
$$;

-- ============================================
-- FUNCTION: Check contract expiry and create reminders
-- ============================================
CREATE OR REPLACE FUNCTION check_contract_expiry()
RETURNS TABLE (
  contract_id UUID,
  contract_number TEXT,
  title TEXT,
  end_date DATE,
  days_remaining INTEGER,
  employee_name TEXT,
  vendor_name TEXT,
  contract_type_name TEXT,
  category TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.contract_number,
    c.title,
    c.end_date,
    (c.end_date - CURRENT_DATE)::INTEGER AS days_remaining,
    up.full_name AS employee_name,
    v.vendor_name,
    ct.type_name,
    ct.category
  FROM contracts c
  JOIN contract_types ct ON c.contract_type_id = ct.id
  LEFT JOIN user_profiles up ON c.employee_id = up.id
  LEFT JOIN vendors v ON c.vendor_id = v.id
  WHERE c.is_active = true
    AND c.contract_status = 'ACTIVE'
    AND c.end_date >= CURRENT_DATE - INTERVAL '30 days'
    AND c.end_date <= CURRENT_DATE + INTERVAL '30 days'
  ORDER BY c.end_date ASC;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Read contract types" ON contract_types;
DROP POLICY IF EXISTS "Write contract types" ON contract_types;
DROP POLICY IF EXISTS "Read contracts" ON contracts;
DROP POLICY IF EXISTS "Insert contracts" ON contracts;
DROP POLICY IF EXISTS "Update contracts" ON contracts;
DROP POLICY IF EXISTS "Delete contracts" ON contracts;
DROP POLICY IF EXISTS "Read contract reminders" ON contract_reminders;
DROP POLICY IF EXISTS "Insert contract reminders" ON contract_reminders;

-- Contract types: all authenticated can read
CREATE POLICY "Read contract types" 
  ON contract_types FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Contract types: super_admin & hrd can write
CREATE POLICY "Write contract types" 
  ON contract_types FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
  );

-- Contracts: all authenticated can read
CREATE POLICY "Read contracts" 
  ON contracts FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Contracts: super_admin & hrd can insert
CREATE POLICY "Insert contracts" 
  ON contracts FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
  );

-- Contracts: super_admin & hrd can update
CREATE POLICY "Update contracts" 
  ON contracts FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
  );

-- Contracts: only super_admin can delete
CREATE POLICY "Delete contracts" 
  ON contracts FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name = 'super_admin' AND up.account_status = 'ACTIVE')
  );

-- Contract reminders: users can read their own
CREATE POLICY "Read contract reminders" 
  ON contract_reminders FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Contract reminders: system can insert
CREATE POLICY "Insert contract reminders" 
  ON contract_reminders FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');