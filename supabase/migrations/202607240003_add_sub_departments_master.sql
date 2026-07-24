-- Add structured sub-departments and import the Harmas department master list.

CREATE TABLE IF NOT EXISTS public.sub_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  sub_department_code VARCHAR(50) NOT NULL UNIQUE,
  sub_department_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS sub_department_id UUID REFERENCES public.sub_departments(id);

WITH source_departments(department_code, department_name, description, is_active) AS (
  VALUES
    ('BOD', 'Board of Directors', 'Direksi & eksekutif puncak', true),
    ('BIZ-DEV', 'Business Development', 'Pengembangan bisnis, kemitraan, & strategi pertumbuhan', true),
    ('PRJ-PROD', 'Project Production', 'Produksi untuk order/project garment', true),
    ('STK-PROD', 'Stock Production', 'Produksi untuk stok/ready-made', true),
    ('PPIC', 'Production Planning & Inventory Control', 'Perencanaan & kontrol produksi', true),
    ('QC', 'Quality Control', 'Pengendalian mutu', true),
    ('RND', 'Research & Development', 'Riset, inovasi, & pengembangan produk', true),
    ('PUR', 'Purchasing / Procurement', 'Pembelian & pengadaan', true),
    ('STORE', 'Store / Retail', 'Toko/retail & inventory toko', true),
    ('MKT', 'Marketing & Creative', 'Marketing, sales, kreatif, & customer service', true),
    ('CS', 'Customer Service', 'Layanan pelanggan non-toko', true),
    ('FIN', 'Finance & Accounting', 'Keuangan, akuntansi, & perpajakan', true),
    ('HRGA', 'Human Resources & General Affairs', 'SDM & urusan umum', true),
    ('OPS-SUP', 'Operational Support', 'Dukungan operasional & logistik', true),
    ('IT', 'IT & Creative', 'Teknologi informasi, website, & desain kreatif', true)
)
INSERT INTO public.departments (department_code, department_name, description, is_active)
SELECT department_code, department_name, description, is_active
FROM source_departments
ON CONFLICT (department_code)
DO UPDATE SET
  department_name = EXCLUDED.department_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE public.departments
SET is_active = false,
    updated_at = NOW()
WHERE department_code NOT IN (
  'BOD', 'BIZ-DEV', 'PRJ-PROD', 'STK-PROD', 'PPIC', 'QC', 'RND',
  'PUR', 'STORE', 'MKT', 'CS', 'FIN', 'HRGA', 'OPS-SUP', 'IT'
);

WITH source_sub_departments(sub_department_code, sub_department_name, department_code, is_active) AS (
  VALUES
    ('BOD-EXEC', 'Executive Office', 'BOD', true),
    ('BOD-IAUD', 'Internal Audit', 'BOD', true),
    ('CUT-TECH', 'Cutting & Technical', 'PRJ-PROD', true),
    ('EMBRO', 'Embroidery', 'PRJ-PROD', true),
    ('PRINT', 'Printing', 'PRJ-PROD', true),
    ('SEW', 'Sewing', 'PRJ-PROD', true),
    ('PRJ-FINS', 'Project Finishing & Packing', 'PRJ-PROD', true),
    ('PRJ-HNC-ACS', 'Project Hanca & Accessories', 'PRJ-PROD', true),
    ('PRJ-MATPROC', 'Project Material Procurement & Inventory', 'PRJ-PROD', true),
    ('PRJ-PROD-ADM', 'Project Production Administration', 'PRJ-PROD', true),
    ('STK-PROD-ADM', 'Stock Production Administration', 'STK-PROD', true),
    ('STK-MATPROC', 'Stock Material Procurement & Inventory', 'STK-PROD', true),
    ('PPIC-PLAN', 'Production Planning', 'PPIC', true),
    ('PPIC-MRP', 'Material Requirement Planning', 'PPIC', true),
    ('PPIC-IC', 'Inventory Control', 'PPIC', true),
    ('QC-PROJ', 'Project Production QC', 'PRJ-PROD', true),
    ('QC-STK', 'Stock Production QC', 'STK-PROD', true),
    ('MQC', 'Mobile Checker QC', 'QC', true),
    ('QC-FAB', 'Fabric & Material Inspection', 'QC', true),
    ('RND-PROD', 'Product Development', 'RND', true),
    ('RND-SMP', 'Sample Room / Sampling', 'RND', true),
    ('RND-TECH', 'Technical & Pattern Engineering', 'RND', true),
    ('PUR-FAB', 'Fabric & Material Purchasing', 'PUR', true),
    ('PUR-GEN', 'General Purchasing', 'PUR', true),
    ('PUR-VND', 'Vendor Management', 'PUR', true),
    ('STORE-INV', 'Store Inventory', 'STORE', true),
    ('STORE-CS', 'Store Customer Service', 'STORE', true),
    ('MKT-AE', 'Harmas Account Executive (Sales)', 'MKT', true),
    ('MKT-ADM', 'Marketing Administration', 'MKT', true),
    ('MKT-CNT', 'Content Coordinator', 'MKT', true),
    ('MKT-DRFT', 'Drafter & Layout', 'MKT', true),
    ('MKT-LIVE', 'Live Host', 'MKT', true),
    ('FIN-ACC', 'Accounting (Akunting)', 'FIN', true),
    ('FIN-TAX', 'Taxation', 'FIN', true),
    ('FIN-TRSY', 'Treasury / Cashier', 'FIN', true),
    ('FIN-COST', 'Costing', 'FIN', true),
    ('HRGA-REC', 'Recruitment', 'HRGA', true),
    ('HRGA-TND', 'Training & Development', 'HRGA', true),
    ('HRGA-ER', 'Employee Relation', 'HRGA', true),
    ('HRGA-PAY', 'Payroll & Compensation', 'HRGA', true),
    ('HRGA-GA', 'General Affairs', 'HRGA', true),
    ('OPS-LOG', 'Logistics & Dispatch', 'OPS-SUP', true),
    ('OPS-MAINT', 'Maintenance', 'OPS-SUP', true),
    ('OPS-SEC', 'Security', 'OPS-SUP', true),
    ('IT-INFRA', 'IT Support & Infrastructure', 'IT', true),
    ('IT-WEB', 'Website & Application Development', 'IT', true),
    ('IT-DSGN', 'Editor & Design / Multimedia', 'IT', true)
)
INSERT INTO public.sub_departments (department_id, sub_department_code, sub_department_name, is_active)
SELECT d.id, s.sub_department_code, s.sub_department_name, s.is_active
FROM source_sub_departments s
JOIN public.departments d ON d.department_code = s.department_code
ON CONFLICT (sub_department_code)
DO UPDATE SET
  department_id = EXCLUDED.department_id,
  sub_department_name = EXCLUDED.sub_department_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

UPDATE public.sub_departments
SET is_active = false,
    updated_at = NOW()
WHERE sub_department_code NOT IN (
  'BOD-EXEC', 'BOD-IAUD', 'CUT-TECH', 'EMBRO', 'PRINT', 'SEW',
  'PRJ-FINS', 'PRJ-HNC-ACS', 'PRJ-MATPROC', 'PRJ-PROD-ADM',
  'STK-PROD-ADM', 'STK-MATPROC', 'PPIC-PLAN', 'PPIC-MRP', 'PPIC-IC',
  'QC-PROJ', 'QC-STK', 'MQC', 'QC-FAB', 'RND-PROD', 'RND-SMP',
  'RND-TECH', 'PUR-FAB', 'PUR-GEN', 'PUR-VND', 'STORE-INV',
  'STORE-CS', 'MKT-AE', 'MKT-ADM', 'MKT-CNT', 'MKT-DRFT', 'MKT-LIVE',
  'FIN-ACC', 'FIN-TAX', 'FIN-TRSY', 'FIN-COST', 'HRGA-REC',
  'HRGA-TND', 'HRGA-ER', 'HRGA-PAY', 'HRGA-GA', 'OPS-LOG',
  'OPS-MAINT', 'OPS-SEC', 'IT-INFRA', 'IT-WEB', 'IT-DSGN'
);

UPDATE public.user_profiles up
SET department_id = d.id
FROM public.departments d
WHERE up.department_id IS NULL
  AND up.department IS NOT NULL
  AND lower(trim(up.department)) = lower(trim(d.department_name));

ALTER TABLE public.sub_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read sub departments" ON public.sub_departments;
CREATE POLICY "Read sub departments"
  ON public.sub_departments
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write sub departments" ON public.sub_departments;
CREATE POLICY "Write sub departments"
  ON public.sub_departments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.roles r ON up.role_id = r.id
      WHERE up.auth_user_id = auth.uid()
        AND r.role_name IN ('super_admin', 'hrd')
        AND up.account_status = 'ACTIVE'
    )
  );
