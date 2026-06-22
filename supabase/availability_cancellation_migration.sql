-- Guide Availability
CREATE TABLE IF NOT EXISTS guide_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id UUID REFERENCES guides(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guide_id, date)
);

ALTER TABLE guide_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guides manage own availability"
  ON guide_availability FOR ALL
  USING (
    guide_id IN (SELECT id FROM guides WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can read guide availability"
  ON guide_availability FOR SELECT
  USING (true);

-- Homestay Availability
CREATE TABLE IF NOT EXISTS homestay_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homestay_id UUID REFERENCES homestays(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(homestay_id, date)
);

ALTER TABLE homestay_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own homestay availability"
  ON homestay_availability FOR ALL
  USING (
    homestay_id IN (SELECT id FROM homestays WHERE owner_id = auth.uid())
  );

CREATE POLICY "Anyone can read homestay availability"
  ON homestay_availability FOR SELECT
  USING (true);

-- Cancellation policy on guides
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'moderate'
    CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict'));

-- Cancellation policy on homestays
ALTER TABLE homestays
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT DEFAULT 'moderate'
    CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict'));

-- Cancellation tracking on bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT
    CHECK (cancelled_by IN ('user', 'owner', 'guide', 'admin')),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellable_until TIMESTAMPTZ;

-- Function: get blocked dates for a guide (booked + owner-blocked)
CREATE OR REPLACE FUNCTION get_guide_blocked_dates(p_guide_id UUID)
RETURNS TABLE(date DATE, reason TEXT) AS $$
  -- Confirmed bookings
  SELECT generate_series(b.start_date::DATE, b.end_date::DATE - 1, '1 day'::INTERVAL)::DATE AS date,
         'booked' AS reason
  FROM bookings b
  WHERE b.resource_id = p_guide_id
    AND b.resource_type = 'guide'
    AND b.status IN ('pending', 'confirmed')
  UNION
  -- Owner-blocked dates
  SELECT ga.date, 'unavailable' AS reason
  FROM guide_availability ga
  WHERE ga.guide_id = p_guide_id
    AND ga.is_available = false;
$$ LANGUAGE SQL STABLE;

-- Function: get blocked dates for a homestay
CREATE OR REPLACE FUNCTION get_homestay_blocked_dates(p_homestay_id UUID)
RETURNS TABLE(date DATE, reason TEXT) AS $$
  SELECT generate_series(b.start_date::DATE, b.end_date::DATE - 1, '1 day'::INTERVAL)::DATE AS date,
         'booked' AS reason
  FROM bookings b
  WHERE b.resource_id = p_homestay_id
    AND b.resource_type = 'homestay'
    AND b.status IN ('pending', 'confirmed')
  UNION
  SELECT ha.date, 'unavailable' AS reason
  FROM homestay_availability ha
  WHERE ha.homestay_id = p_homestay_id
    AND ha.is_available = false;
$$ LANGUAGE SQL STABLE;
