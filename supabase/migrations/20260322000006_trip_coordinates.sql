-- Add latitude and longitude to trips for precise map centering
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);

-- Add index for trip locations
CREATE INDEX IF NOT EXISTS idx_trips_location ON public.trips(lat, lng);
