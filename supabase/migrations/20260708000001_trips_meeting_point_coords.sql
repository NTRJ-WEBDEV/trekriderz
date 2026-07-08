-- Add lat/lng columns for the trip's meeting point, separate from the
-- destination lat/lng that trips.lat/lng already store.
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS meeting_lat DECIMAL(10, 8);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS meeting_lng DECIMAL(11, 8);
