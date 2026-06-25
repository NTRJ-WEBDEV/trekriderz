-- Rental Vehicles Feature
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.rental_vehicles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID REFERENCES public.users(id) NOT NULL,
  vehicle_type    TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'car', 'jeep', 'tempo', 'auto', 'bus')),
  make            TEXT NOT NULL,       -- e.g. "Royal Enfield"
  model           TEXT NOT NULL,       -- e.g. "Himalayan 411"
  year            INTEGER,
  description     TEXT,
  price_per_day   INTEGER NOT NULL,    -- in INR
  location        TEXT NOT NULL,
  lat             DECIMAL(10,8),
  lng             DECIMAL(11,8),
  photos          JSONB DEFAULT '[]'::jsonb,
  contact_phone   TEXT NOT NULL,
  contact_whatsapp TEXT,
  features        JSONB DEFAULT '[]'::jsonb,  -- ["Helmet", "Insurance", "GPS", ...]
  fuel_included   BOOLEAN DEFAULT false,
  seats           INTEGER,             -- for cars/jeep/tempo/bus
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_available    BOOLEAN DEFAULT true,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rentals_type     ON public.rental_vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_rentals_status   ON public.rental_vehicles(status, is_available);

-- RLS
ALTER TABLE public.rental_vehicles ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved available rentals
DROP POLICY IF EXISTS "Anyone can view approved rentals" ON public.rental_vehicles;
CREATE POLICY "Anyone can view approved rentals" ON public.rental_vehicles
  FOR SELECT USING (status = 'approved' AND is_available = true);

-- Owners can always view their own listings
DROP POLICY IF EXISTS "Owners can view own rentals" ON public.rental_vehicles;
CREATE POLICY "Owners can view own rentals" ON public.rental_vehicles
  FOR SELECT USING (auth.uid() = owner_id);

-- Any authenticated user can list a vehicle (pending admin approval)
DROP POLICY IF EXISTS "Authenticated users can list vehicles" ON public.rental_vehicles;
CREATE POLICY "Authenticated users can list vehicles" ON public.rental_vehicles
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own listings
DROP POLICY IF EXISTS "Owners can update own rentals" ON public.rental_vehicles;
CREATE POLICY "Owners can update own rentals" ON public.rental_vehicles
  FOR UPDATE USING (auth.uid() = owner_id);
