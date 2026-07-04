-- Properties table (one per owner listing)
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info
  name text NOT NULL,
  description text,
  property_type text[] DEFAULT '{}',
  -- types: private_room, entire_home, villa, dormitory,
  -- tent_camping, treehouse, farmstay, heritage_home

  -- Location (mandatory precise pin)
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  country text DEFAULT 'India',
  pincode text,
  lat numeric,
  lng numeric,
  location_name text,

  -- Check-in/out
  checkin_time text DEFAULT '14:00',
  checkout_time text DEFAULT '11:00',

  -- Property amenities
  amenities text[] DEFAULT '{}',
  -- WiFi, Parking, Pool, Kitchen, Restaurant,
  -- Hot Water, AC, Heater, Laundry, Garden,
  -- Bonfire, Trekking Access, Pet Friendly,
  -- Airport Pickup, EV Charging

  -- House rules
  smoking_allowed boolean DEFAULT false,
  pets_allowed boolean DEFAULT false,
  parties_allowed boolean DEFAULT false,
  children_allowed boolean DEFAULT true,

  -- Cancellation policy
  cancellation_policy text DEFAULT 'moderate'
    CHECK (cancellation_policy IN
      ('flexible','moderate','strict','non_refundable')),

  -- Contact (internal only)
  contact_phone text,
  contact_whatsapp text,
  contact_email text,

  -- Identity verification (internal only)
  identity_doc_type text,
  identity_doc_front_url text,
  identity_doc_back_url text,
  ownership_proof_type text,
  ownership_proof_url text,

  -- Photos
  cover_photo_url text,
  photos text[] DEFAULT '{}',

  -- Terms acceptance
  terms_accepted boolean DEFAULT false,
  terms_accepted_at timestamptz,
  commission_rate numeric DEFAULT 15,

  -- Status
  status text DEFAULT 'pending'
    CHECK (status IN
      ('pending','under_review','approved',
       'rejected','suspended')),
  rejection_reason text,
  approved_by uuid,
  approved_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Room types table (multiple per property)
CREATE TABLE IF NOT EXISTS public.room_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id)
    ON DELETE CASCADE,

  -- Room info
  name text NOT NULL,
  -- e.g. "Deluxe Double Room", "6-Bed Dormitory"
  room_category text NOT NULL,
  -- private_room, shared_room, entire_unit,
  -- dormitory, tent, villa_suite, treehouse
  description text,

  -- Capacity
  max_occupancy integer DEFAULT 2,
  base_occupancy integer DEFAULT 2,
  -- Extra guest charge applies above base_occupancy
  extra_guest_charge numeric DEFAULT 0,
  total_units integer DEFAULT 1,
  -- How many rooms of this type exist

  -- Bed configuration
  beds jsonb DEFAULT '[]',
  -- [{type: "double", count: 1}, {type: "single", count: 2}]
  -- bed types: single, double, queen, king, bunk, sofa_bed

  -- Bathroom
  bathroom_type text DEFAULT 'attached',
  -- attached, shared, ensuite

  -- Room amenities
  amenities text[] DEFAULT '{}',
  -- AC, TV, WiFi, Mini Fridge, Wardrobe,
  -- Balcony, Mountain View, Forest View,
  -- Hot Water, Hair Dryer, Safe, Desk

  -- Photos
  photos text[] DEFAULT '{}',

  -- PRICING
  -- Base price (default weekday)
  base_price numeric NOT NULL,

  -- Weekend pricing (Fri, Sat)
  weekend_price_enabled boolean DEFAULT false,
  weekend_price numeric DEFAULT 0,

  -- Peak season pricing
  peak_season_enabled boolean DEFAULT false,
  peak_price numeric DEFAULT 0,
  peak_seasons jsonb DEFAULT '[]',
  -- [{name: "Diwali", start: "2026-10-20",
  --   end: "2026-10-25"},
  --  {name: "New Year", start: "2026-12-28",
  --   end: "2027-01-02"}]

  -- Off season pricing
  off_season_enabled boolean DEFAULT false,
  off_season_price numeric DEFAULT 0,
  off_season_periods jsonb DEFAULT '[]',
  -- [{start: "2026-07-01", end: "2026-08-31"}]

  -- Minimum stay
  min_nights integer DEFAULT 1,
  min_nights_weekend integer DEFAULT 1,
  min_nights_peak integer DEFAULT 2,

  -- Status
  is_available boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Property inquiries
CREATE TABLE IF NOT EXISTS public.property_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id),
  room_type_id uuid REFERENCES public.room_types(id),
  user_id uuid REFERENCES auth.users(id),
  checkin_date date,
  checkout_date date,
  guests integer DEFAULT 1,
  message text,
  contact_phone text,
  total_estimate numeric,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inquiries
  ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved properties
DROP POLICY IF EXISTS "Public view approved properties" ON public.properties;
CREATE POLICY "Public view approved properties"
  ON public.properties FOR SELECT
  USING (status = 'approved');

-- Owners can view own properties
DROP POLICY IF EXISTS "Owners view own properties" ON public.properties;
CREATE POLICY "Owners view own properties"
  ON public.properties FOR SELECT
  USING (auth.uid() = owner_id);

-- Owners can insert
DROP POLICY IF EXISTS "Owners can list property" ON public.properties;
CREATE POLICY "Owners can list property"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owners can update own pending/approved properties
DROP POLICY IF EXISTS "Owners can update own properties" ON public.properties;
CREATE POLICY "Owners can update own properties"
  ON public.properties FOR UPDATE
  USING (auth.uid() = owner_id);

-- Admin full access
DROP POLICY IF EXISTS "Admin full access properties" ON public.properties;
CREATE POLICY "Admin full access properties"
  ON public.properties FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM auth.users
    WHERE email = 'ntrjwebdev@gmail.com'
  ));

-- Room types follow property access
DROP POLICY IF EXISTS "Public view room types of approved properties" ON public.room_types;
CREATE POLICY "Public view room types of approved properties"
  ON public.room_types FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties
      WHERE status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Owners manage own room types" ON public.room_types;
CREATE POLICY "Owners manage own room types"
  ON public.room_types FOR ALL
  USING (
    property_id IN (
      SELECT id FROM public.properties
      WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin full access room types" ON public.room_types;
CREATE POLICY "Admin full access room types"
  ON public.room_types FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM auth.users
    WHERE email = 'ntrjwebdev@gmail.com'
  ));

-- Property inquiries policies
DROP POLICY IF EXISTS "Users create own inquiries" ON public.property_inquiries;
CREATE POLICY "Users create own inquiries"
  ON public.property_inquiries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own inquiries" ON public.property_inquiries;
CREATE POLICY "Users view own inquiries"
  ON public.property_inquiries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners view inquiries on own properties" ON public.property_inquiries;
CREATE POLICY "Owners view inquiries on own properties"
  ON public.property_inquiries FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties
      WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners update inquiries on own properties" ON public.property_inquiries;
CREATE POLICY "Owners update inquiries on own properties"
  ON public.property_inquiries FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM public.properties
      WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin full access property inquiries" ON public.property_inquiries;
CREATE POLICY "Admin full access property inquiries"
  ON public.property_inquiries FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM auth.users
    WHERE email = 'ntrjwebdev@gmail.com'
  ));

-- Storage policies for homestays bucket (property + room photos)
-- Guarded with DROP IF EXISTS since these may already exist from an earlier migration.
DROP POLICY IF EXISTS "Auth users upload homestay photos" ON storage.objects;
CREATE POLICY "Auth users upload homestay photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'homestays'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Anyone view homestay photos" ON storage.objects;
CREATE POLICY "Anyone view homestay photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'homestays');
