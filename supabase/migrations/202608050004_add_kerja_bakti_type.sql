-- ============================================================
-- Migration: Maintenance Type "Kerja Bakti"
-- Untuk jadwal pekerjaan umum: kebersihan, perawatan, dll
-- ============================================================

-- 1. Buat maintenance type "Kerja Bakti"
INSERT INTO maintenance_types (maintenance_code, maintenance_name, description, is_active, created_at, updated_at)
VALUES (
  'KERJA-BAKTI',
  'Kerja Bakti',
  'Pembersihan, perawatan, dan pekerjaan umum area pabrik/kantor/gudang',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (maintenance_code) DO UPDATE
  SET maintenance_name = EXCLUDED.maintenance_name,
      description = EXCLUDED.description,
      is_active = true,
      updated_at = NOW();

-- 2. Refresh schema cache
NOTIFY pgrst, 'reload schema';