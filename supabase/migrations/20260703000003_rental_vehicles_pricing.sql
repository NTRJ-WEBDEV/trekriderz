-- Granular km-based pricing for rental vehicles
ALTER TABLE public.rental_vehicles
  ADD COLUMN IF NOT EXISTS local_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS local_base_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS local_included_km integer DEFAULT 80,
  ADD COLUMN IF NOT EXISTS local_extra_km_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstation_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outstation_base_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstation_included_km integer DEFAULT 250,
  ADD COLUMN IF NOT EXISTS outstation_extra_km_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstation_min_days integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS driver_option text DEFAULT 'self'
    CHECK (driver_option IN ('self', 'driver', 'both')),
  ADD COLUMN IF NOT EXISTS driver_price_per_day numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS local_unlimited_km boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS outstation_unlimited_km boolean DEFAULT false;
