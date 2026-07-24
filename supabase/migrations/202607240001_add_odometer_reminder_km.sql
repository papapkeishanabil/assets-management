-- Add the kilometer threshold used to trigger odometer-based reminders.
-- IF NOT EXISTS keeps this migration safe when applied more than once.
ALTER TABLE public.maintenance_schedules
  ADD COLUMN IF NOT EXISTS odometer_reminder_km INTEGER NOT NULL DEFAULT 500;

ALTER TABLE public.maintenance_schedules
  DROP CONSTRAINT IF EXISTS maintenance_schedules_odometer_reminder_km_check;

ALTER TABLE public.maintenance_schedules
  ADD CONSTRAINT maintenance_schedules_odometer_reminder_km_check
  CHECK (odometer_reminder_km >= 0);

COMMENT ON COLUMN public.maintenance_schedules.odometer_reminder_km IS
  'Distance in kilometers before next_odometer_due when a reminder should be sent.';
