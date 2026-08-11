-- PKWTT (perjanjian kerja waktu tidak tertentu) tidak memiliki tanggal berakhir.
-- Perubahan additive: data lama tetap utuh, hanya constraint NOT NULL yang dilonggarkan.
ALTER TABLE contracts
  ALTER COLUMN end_date DROP NOT NULL;

COMMENT ON COLUMN contracts.end_date IS
  'Tanggal berakhir kontrak; NULL untuk kontrak tanpa batas waktu seperti PKWTT.';
