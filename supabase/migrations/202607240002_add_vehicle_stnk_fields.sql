-- Vehicle identity fields commonly recorded on an Indonesian STNK.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS vehicle_owner_name TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
  ADD COLUMN IF NOT EXISTS fuel_type TEXT;

COMMENT ON COLUMN public.assets.vehicle_owner_name IS 'Owner name as written on the vehicle registration document (STNK).';
COMMENT ON COLUMN public.assets.vehicle_color IS 'Vehicle color as written on the STNK.';
COMMENT ON COLUMN public.assets.fuel_type IS 'Fuel or energy source as written on the STNK.';
