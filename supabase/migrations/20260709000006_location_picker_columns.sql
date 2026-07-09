-- Adds structured State/District columns backing the new two-step
-- LocationPicker component (mobile/components/LocationPicker.tsx), which
-- sits ahead of the existing free-text search/pin-drop on 5 screens.
-- All columns are nullable — the picker is additive, not a replacement for
-- the existing free-text destination/location/address fields.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS district text;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS destination_state text,
  ADD COLUMN IF NOT EXISTS destination_district text;

ALTER TABLE public.rental_vehicles
  ADD COLUMN IF NOT EXISTS pickup_state text,
  ADD COLUMN IF NOT EXISTS pickup_district text;

ALTER TABLE public.guided_expeditions
  ADD COLUMN IF NOT EXISTS destination_state text,
  ADD COLUMN IF NOT EXISTS destination_district text;

-- guides.locations is JSONB (array of {name, lat, lng, radius_km,
-- rate_per_day}); state/district are added as new keys per entry in app
-- code only (mobile/app/guide/register.tsx) — no column needed here.
