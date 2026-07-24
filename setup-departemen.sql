-- Setup Departemen berdasarkan Struktur Organisasi CV HARMAS INDUSTRI SANDANG
-- Jalankan di Supabase SQL Editor

-- Tambah kolom parent_department_id untuk hierarki
ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_department_id UUID REFERENCES departments(id);

-- 1. Level 1 - Direksi / Pimpinan
INSERT INTO departments (department_code, department_name, description) VALUES
  ('DIR', 'Direksi', 'Direksi dan Pimpinan Perusahaan')
ON CONFLICT (department_code) DO NOTHING;

-- 2. Level 1 - Divisi-divisi Utama
INSERT INTO departments (department_code, department_name, description) VALUES
  ('PROD', 'Produksi', 'Divisi Produksi - proses pembuatan produk'),
  ('KEU', 'Keuangan', 'Divisi Keuangan & Accounting'),
  ('HRD', 'HRD & Umum', 'Divisi Sumber Daya Manusia dan Umum'),
  ('MKT', 'Pemasaran', 'Divisi Pemasaran dan Penjualan'),
  ('LOG', 'Logistik', 'Divisi Logistik & Pengadaan'),
  ('TECH', 'Teknik', 'Divisi Teknis & Maintenance')
ON CONFLICT (department_code) DO NOTHING;

-- 3. Level 2 - Sub-Bagian Produksi (child dari PROD)
INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'CUT', 'Bagian Cutting', id, 'Bagian Pemotongan Kain' FROM departments WHERE department_code = 'PROD'
ON CONFLICT (department_code) DO NOTHING;

INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'SEW', 'Bagian Sewing', id, 'Bagian Jahit' FROM departments WHERE department_code = 'PROD'
ON CONFLICT (department_code) DO NOTHING;

INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'BRD', 'Bagian Bordir', id, 'Bagian Bordir & Sulam' FROM departments WHERE department_code = 'PROD'
ON CONFLICT (department_code) DO NOTHING;

INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'FNS', 'Bagian Finishing', id, 'Bagian Finishing & Packing' FROM departments WHERE department_code = 'PROD'
ON CONFLICT (department_code) DO NOTHING;

INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'QC', 'Quality Control', id, 'Bagian Kontrol Kualitas' FROM departments WHERE department_code = 'PROD'
ON CONFLICT (department_code) DO NOTHING;

-- 4. Level 2 - Sub-Bagian Keuangan (child dari KEU)
INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'ACC', 'Accounting', id, 'Bagian Pembukuan & Akuntansi' FROM departments WHERE department_code = 'KEU'
ON CONFLICT (department_code) DO NOTHING;

-- 5. Level 2 - Sub-Bagian Logistik (child dari LOG)
INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'GDG', 'Gudang', id, 'Bagian Pergudangan & Penyimpanan' FROM departments WHERE department_code = 'LOG'
ON CONFLICT (department_code) DO NOTHING;

-- 6. Level 2 - Sub-Bagian Pemasaran (child dari MKT)
INSERT INTO departments (department_code, department_name, parent_department_id, description)
SELECT 'SLS', 'Penjualan', id, 'Bagian Penjualan & Marketing' FROM departments WHERE department_code = 'MKT'
ON CONFLICT (department_code) DO NOTHING;

-- 7. Cek hasil
SELECT 
  d1.department_code as kode_divisi,
  d1.department_name as nama_divisi,
  d2.department_code as kode_bagian,
  d2.department_name as nama_bagian
FROM departments d1
LEFT JOIN departments d2 ON d2.parent_department_id = d1.id
WHERE d1.parent_department_id IS NULL
ORDER BY d1.department_name, d2.department_name;

SELECT 'Setup departemen berhasil!' as message;