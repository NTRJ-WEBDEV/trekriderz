--- Add new trip types, public flag, and description for the Discover feature

-- Expand trip_type constraint to include car_ride and spiritual
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_trip_type_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_trip_type_check
  CHECK (trip_type IN ('trek', 'bike', 'temple', 'backpacking', 'weekend', 'car_ride', 'spiritual'));

-- Add is_public flag (allows trips to appear in Discover for others to join)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Add description for trip creators to describe the trip to potential joiners
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Index for fast Discover queries (public upcoming trips)
CREATE INDEX IF NOT EXISTS trips_discover_idx
  ON public.trips (is_public, status, start_date)
  WHERE is_public = true;
