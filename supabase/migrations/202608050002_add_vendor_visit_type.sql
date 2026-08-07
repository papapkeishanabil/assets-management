-- ============================================================
-- Migration: Vendor Visit Maintenance Type & Site Visit Fields
-- Untuk aset mesin jahit yang dipinjamkan ke vendor,
-- sistem otomatis membuat jadwal kunjungan vendor (1 bulan)
-- ============================================================

-- 1. Buat maintenance type "Kunjungan Vendor"
INSERT INTO maintenance_types (id, maintenance_code, maintenance_name, description, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'VISIT',
  'Kunjungan Vendor / Site Visit',
  'Pemeriksaan kondisi aset yang sedang dipinjamkan ke lokasi vendor',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (maintenance_code) DO UPDATE
  SET maintenance_name = EXCLUDED.maintenance_name,
      description = EXCLUDED.description,
      is_active = true,
      updated_at = NOW();

-- 2. Tambah kolom khusus site visit di maintenance_executions
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS visit_condition TEXT,
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS vendor_contact_name TEXT;

-- 3. Trigger: otomatis buat jadwal kunjungan vendor ketika
--    status aset berubah menjadi "Dipinjamkan"
CREATE OR REPLACE FUNCTION create_vendor_visit_schedule()
RETURNS TRIGGER AS $$
DECLARE
  visit_type_id UUID;
  existing_count INT;
BEGIN
  -- Hanya trigger ketika status_id berubah
  IF NEW.status_id IS NOT NULL AND OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    -- Cek apakah status baru adalah "Dipinjamkan"
    IF (SELECT status_name FROM asset_statuses WHERE id = NEW.status_id) = 'Dipinjamkan' THEN
      -- Cari maintenance type "Kunjungan Vendor"
      SELECT id INTO visit_type_id
      FROM maintenance_types
      WHERE maintenance_code = 'VISIT' AND is_active = true;

      IF visit_type_id IS NOT NULL THEN
        -- Cek apakah sudah ada jadwal kunjungan aktif untuk aset ini
        SELECT COUNT(*) INTO existing_count
        FROM maintenance_schedules
        WHERE asset_id = NEW.id
          AND maintenance_type_id = visit_type_id
          AND is_active = true;

        -- Jika belum ada, buat jadwal kunjungan vendor (interval 1 bulan)
        IF existing_count = 0 THEN
          INSERT INTO maintenance_schedules (
            asset_id,
            maintenance_type_id,
            interval_type,
            interval_value,
            interval_unit,
            last_maintenance_date,
            next_maintenance_date,
            is_active,
            created_at,
            updated_at
          ) VALUES (
            NEW.id,
            visit_type_id,
            'TIME',
            1,
            'MONTH',
            NOW()::date,
            (NOW() + INTERVAL '1 month')::date,
            true,
            NOW(),
            NOW()
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_vendor_visit_schedule ON assets;
CREATE TRIGGER trigger_create_vendor_visit_schedule
  AFTER UPDATE OF status_id ON assets
  FOR EACH ROW EXECUTE FUNCTION create_vendor_visit_schedule();

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';
