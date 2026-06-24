-- Partner matching columns on trips table
-- Run in Supabase SQL Editor

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS looking_for_partner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_gender      text    DEFAULT 'any',     -- 'male' | 'female' | 'any'
  ADD COLUMN IF NOT EXISTS partner_role        text    DEFAULT null,      -- 'rider' | 'pillion' | 'trekker' | 'any'
  ADD COLUMN IF NOT EXISTS experience_level    text    DEFAULT null,      -- 'beginner' | 'intermediate' | 'expert'
  ADD COLUMN IF NOT EXISTS meeting_point       text    DEFAULT null,
  ADD COLUMN IF NOT EXISTS slots_available     integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contact_whatsapp    text    DEFAULT null;

-- Index for partner discovery queries
CREATE INDEX IF NOT EXISTS idx_trips_partner ON trips (looking_for_partner, start_date)
  WHERE is_public = true AND looking_for_partner = true;
