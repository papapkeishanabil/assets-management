-- ============================================
-- EMPLOYEE MANAGEMENT SCHEMA
-- Data karyawan (terpisah dari user_profiles)
-- ============================================

-- 1. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  -- Identitas
  nik VARCHAR(50), -- Nomor Induk Karyawan
  id_card_number VARCHAR(50), -- Nomor KTP
  place_of_birth VARCHAR(100),
  date_of_birth DATE,
  gender VARCHAR(20) CHECK (gender IN ('Laki-laki', 'Perempuan')),
  religion VARCHAR(50),
  marital_status VARCHAR(50),
  
  -- Kontak
  phone_number VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  
  -- Informasi Pekerjaan
  employee_type VARCHAR(50) CHECK (employee_type IN ('Karyawan Tetap', 'Karyawan Kontrak', 'Outsourcing', 'Magang', 'Harian Lepas', 'Direksi')),
  division_id UUID REFERENCES divisions(id),
  department_id UUID REFERENCES departments(id),
  sub_department_id UUID REFERENCES sub_departments(id),
  position VARCHAR(255),
  position_level VARCHAR(100),
  
  -- Tanggal penting
  join_date DATE,
  contract_start_date DATE,
  contract_end_date DATE,
  permanent_date DATE, -- Tanggal jadi karyawan tetap
  
  -- Dokumen
  id_card_url TEXT,
  photo_url TEXT,
  cv_url TEXT,
  documents_url TEXT,
  
  -- Status
  employment_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (employment_status IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED', 'RETIRED')),
  is_active BOOLEAN DEFAULT true,
  
  -- Sistem
  linked_user_id UUID REFERENCES user_profiles(id), -- Link ke user_profiles jika punya akun
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(full_name);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_type ON employees(employee_type);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_contract_end ON employees(contract_end_date);

-- 3. FUNCTION: Auto generate employee code
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_num INTEGER;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM '\d{4}$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM employees;
  
  new_code := 'KRY-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN new_code;
END;
$$;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read employees" ON employees;
DROP POLICY IF EXISTS "Insert employees" ON employees;
DROP POLICY IF EXISTS "Update employees" ON employees;
DROP POLICY IF EXISTS "Delete employees" ON employees;

CREATE POLICY "Read employees" 
  ON employees FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Insert employees" 
  ON employees FOR INSERT 
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
  );

CREATE POLICY "Update employees" 
  ON employees FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
  );

-- super_admin & hrd can delete
CREATE POLICY "Delete employees" 
  ON employees FOR DELETE 
  USING (
    EXISTS (SELECT 1 FROM user_profiles up JOIN roles r ON up.role_id = r.id WHERE up.auth_user_id = auth.uid() AND r.role_name IN ('super_admin','hrd') AND up.account_status = 'ACTIVE')
  );

-- ============================================
-- UPDATE CONTRACTS TABLE - Tambah employee_id
-- ============================================
-- employees table is now the main source for contract parties
-- contracts.employee_id already exists referencing user_profiles
-- We'll add contracts.employee_ref_id referencing employees
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS employee_ref_id UUID REFERENCES employees(id);

-- ============================================
-- SEED DATA SAMPLE (opsional)
-- ============================================
-- Insert sample employees if table is empty
INSERT INTO employees (employee_code, full_name, employee_type, position, employment_status)
SELECT 'KRY-2026-0001', 'Ahmad Fauzi', 'Karyawan Tetap', 'Staff IT', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM employees LIMIT 1);

INSERT INTO employees (employee_code, full_name, employee_type, position, employment_status)
SELECT 'KRY-2026-0002', 'Siti Rahmawati', 'Karyawan Kontrak', 'Staff HRD', 'ACTIVE'
WHERE EXISTS (SELECT 1 FROM employees WHERE employee_code = 'KRY-2026-0001')
  AND NOT EXISTS (SELECT 1 FROM employees WHERE employee_code = 'KRY-2026-0002');

INSERT INTO employees (employee_code, full_name, employee_type, position, employment_status)
SELECT 'KRY-2026-0003', 'Budi Santoso', 'Outsourcing', 'Security', 'ACTIVE'
WHERE EXISTS (SELECT 1 FROM employees WHERE employee_code = 'KRY-2026-0002')
  AND NOT EXISTS (SELECT 1 FROM employees WHERE employee_code = 'KRY-2026-0003');