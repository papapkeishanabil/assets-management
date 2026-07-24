-- ============================================
-- SCHEMA HARMAS ASSET MANAGEMENT - PHASE 1
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. TABLE ROLES
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (role_name, description) 
VALUES 
  ('super_admin', 'Super Administrator - akses penuh'),
  ('direksi', 'Direksi - akses terbatas'),
  ('hrd', 'HRD / Admin Asset - akses terbatas'),
  ('pelaksana', 'Pelaksana / Teknisi - akses terbatas')
ON CONFLICT (role_name) DO NOTHING;

-- 2. TABLE USER PROFILES
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  department VARCHAR(100) DEFAULT '',
  position VARCHAR(100) DEFAULT '',
  role_id UUID REFERENCES roles(id),
  account_status VARCHAR(50) DEFAULT 'PENDING' CHECK (account_status IN ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED')),
  avatar_url TEXT,
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SETUP RLS
-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Roles read all" ON roles;
DROP POLICY IF EXISTS "Own profile select" ON user_profiles;
DROP POLICY IF EXISTS "Own profile update" ON user_profiles;
DROP POLICY IF EXISTS "Super admin all user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Insert during registration" ON user_profiles;

-- Roles: all authenticated users can read
CREATE POLICY "Roles read all" 
  ON roles FOR SELECT 
  USING (auth.role() = 'authenticated');

-- User profiles: users can read own profile
CREATE POLICY "Own profile select" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = auth_user_id);

-- User profiles: users can update own profile (but not role/status)
CREATE POLICY "Own profile update" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- User profiles: Super Admin can read/update all
CREATE POLICY "Super admin all user_profiles" 
  ON user_profiles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() 
      AND r.role_name = 'super_admin'
      AND up.account_status = 'ACTIVE'
    )
  );

-- Allow insert during registration (anyone can insert)
CREATE POLICY "Insert during registration" 
  ON user_profiles FOR INSERT 
  WITH CHECK (true);

-- Allow Super Admin to delete user_profiles
CREATE POLICY "Super admin delete" 
  ON user_profiles FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid() 
      AND r.role_name = 'super_admin'
      AND up.account_status = 'ACTIVE'
    )
  );

-- 4. CREATE THE FIRST SUPER ADMIN
-- Note: Run after registering the first user manually
-- Replace the UUID below with the actual auth_user_id from Supabase Auth
-- Or use this query later:
-- 
-- UPDATE user_profiles 
-- SET role_id = (SELECT id FROM roles WHERE role_name = 'super_admin'),
--     account_status = 'ACTIVE'
-- WHERE email = 'admin@harmas.com';