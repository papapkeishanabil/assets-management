-- ============================================
-- Migration: Vehicle Oil Change Scheduling
-- Adds odometer tracking to maintenance schedules
-- ============================================

-- 1. Add last_odometer column to maintenance_schedules
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS last_odometer DECIMAL(12,2);

-- 2. Add odometer_interval_value and odometer_interval_unit columns
--    These allow odometer-based scheduling (e.g., every 5000 km)
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS odometer_interval_value INTEGER;

-- 3. Add next_odometer_due column to track next odometer threshold
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS next_odometer_due DECIMAL(12,2);

-- 4. Add reminder threshold for odometer-based scheduling
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS odometer_reminder_km INTEGER NOT NULL DEFAULT 500
  CHECK (odometer_reminder_km >= 0);

-- 5. Add index for odometer-based scheduling
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_last_odometer ON maintenance_schedules(last_odometer);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_odometer ON maintenance_schedules(next_odometer_due);

-- 6. Add interval_type column to distinguish between TIME-based and ODOMETER-based scheduling
--    'TIME' = based on date interval (e.g., every 5 months)
--    'ODOMETER' = based on kilometer interval (e.g., every 5000 km)
--    'BOTH' = based on both time and odometer (whichever comes first)
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS interval_type TEXT DEFAULT 'TIME' CHECK (interval_type IN ('TIME', 'ODOMETER', 'BOTH'));

-- 7. Add next_odometer_threshold for BOTH mode
--    (already covered by next_odometer_due above)
