-- Add images column to rental_vehicles for photo public URLs
ALTER TABLE public.rental_vehicles
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
