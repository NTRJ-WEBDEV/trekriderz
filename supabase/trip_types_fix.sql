-- Expand trip_type CHECK constraint to include wildlife and photography
-- Run in Supabase SQL Editor

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_trip_type_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_trip_type_check
  CHECK (trip_type IN (
    'trek', 'bike', 'car_ride', 'temple',
    'backpacking', 'weekend', 'spiritual',
    'wildlife', 'photography'
  ));
