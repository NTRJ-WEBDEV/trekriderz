-- ============================================================
-- TrekRiderz Website Tables Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ─── TRIPS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id         TEXT          UNIQUE,
  name            TEXT          NOT NULL,
  type            TEXT          CHECK (type IN ('trek','tour','stay','special')),
  country         TEXT          DEFAULT 'India',
  destination     TEXT          NOT NULL,
  duration_days   INTEGER,
  start_date      DATE,
  end_date        DATE,
  price_inr       INTEGER,
  price_usd       INTEGER,
  max_group_size  INTEGER       DEFAULT 15,
  difficulty      TEXT          CHECK (difficulty IN ('easy','moderate','challenging','extreme')),
  inclusions      TEXT[],
  exclusions      TEXT[],
  highlights      TEXT[],
  itinerary       JSONB,
  special_tag     TEXT,
  available_slots INTEGER,
  status          TEXT          DEFAULT 'active' CHECK (status IN ('active','inactive','sold_out','draft')),
  cover_image     TEXT,
  images          TEXT[],
  whatsapp_link   TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active trips" ON trips;
CREATE POLICY "Anyone can read active trips"
  ON trips FOR SELECT
  USING (status != 'draft');

-- Admin mutations via service role (bypass RLS)

-- ─── ENQUIRIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id        UUID        REFERENCES trips(id) ON DELETE SET NULL,
  trip_name      TEXT,
  name           TEXT        NOT NULL,
  email          TEXT,
  whatsapp       TEXT        NOT NULL,
  group_size     INTEGER     DEFAULT 1,
  preferred_date TEXT,
  message        TEXT,
  status         TEXT        DEFAULT 'new' CHECK (status IN ('new','responded','closed')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert enquiries" ON enquiries;
CREATE POLICY "Anyone can insert enquiries"
  ON enquiries FOR INSERT
  WITH CHECK (true);

-- Admin reads via service role

-- ─── CUSTOM ENQUIRIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_enquiries (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_range     TEXT,
  destination_type TEXT,
  countries        TEXT[],
  fitness_level    TEXT,
  group_size       INTEGER,
  duration         TEXT,
  preferred_month  TEXT,
  name             TEXT        NOT NULL,
  whatsapp         TEXT        NOT NULL,
  email            TEXT,
  status           TEXT        DEFAULT 'new' CHECK (status IN ('new','responded','closed')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert custom enquiries" ON custom_enquiries;
CREATE POLICY "Anyone can insert custom enquiries"
  ON custom_enquiries FOR INSERT
  WITH CHECK (true);

-- ─── YOUTUBE VIDEOS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS youtube_videos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  youtube_url TEXT        NOT NULL,
  embed_url   TEXT        NOT NULL,
  category    TEXT        DEFAULT 'shorts',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read videos" ON youtube_videos;
CREATE POLICY "Anyone can read videos"
  ON youtube_videos FOR SELECT
  USING (true);

-- ─── SEED — 7 sample trips ───────────────────────────────────
INSERT INTO trips
  (trip_id, name, type, country, destination, duration_days, price_inr, price_usd,
   max_group_size, difficulty, inclusions, exclusions, highlights, special_tag, available_slots, status,
   itinerary, whatsapp_link)
VALUES

-- 1. Coorg Coffee Trail
(
  'coorg-coffee-trail',
  'Coorg Coffee Trail Trek',
  'trek', 'India', 'Coorg, Karnataka', 3, 4999, 60, 15, 'easy',
  ARRAY['Trek guide','2 nights accommodation','All meals','Forest permits','First aid'],
  ARRAY['Travel to Coorg','Personal expenses','Travel insurance'],
  ARRAY['Coffee estate walk','Abbé Falls','Raja''s Seat sunset','Campfire night'],
  'Popular', 12, 'active',
  '[
    {"day":1,"title":"Arrival & Coffee Estate Walk","description":"Arrive in Coorg, check-in, guided evening walk through aromatic coffee plantations."},
    {"day":2,"title":"Forest Trek & Waterfall","description":"Full day trek through Pushpagiri Wildlife Sanctuary. Visit Abbé Falls."},
    {"day":3,"title":"Raja''s Seat Sunrise & Departure","description":"Early sunrise at Raja''s Seat, local market tour, departure after breakfast."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20interested%20in%20Coorg%20Coffee%20Trail!'
),

-- 2. Hampi Heritage Walk
(
  'hampi-heritage',
  'Hampi Heritage Walk',
  'tour', 'India', 'Hampi, Karnataka', 2, 3499, 42, 20, 'easy',
  ARRAY['Local expert guide','1 night accommodation','Breakfast','Entry permits'],
  ARRAY['Travel to Hampi','Lunch/dinner','Personal expenses'],
  ARRAY['Virupaksha Temple','Vittala Stone Chariot','Coracle ride','Sunset at Hemakuta Hill'],
  NULL, 18, 'active',
  '[
    {"day":1,"title":"Ruins of Hampi","description":"Arrive Hampi, explore Virupaksha Temple, Vittala complex, stone chariot. Evening coracle ride."},
    {"day":2,"title":"Royal Enclosure & Departure","description":"Early morning Hemakuta Hill sunrise, Lotus Mahal, Elephant Stables, departure."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20interested%20in%20Hampi%20Heritage%20Walk!'
),

-- 3. Nepal Annapurna Base Camp
(
  'nepal-abc',
  'Nepal Annapurna Base Camp Trek',
  'trek', 'Nepal', 'Annapurna, Nepal', 12, 28999, 350, 12, 'challenging',
  ARRAY['International guide','Tea house stays','Breakfast & dinner','ACAP + TIMS permits','Airport transfers Kathmandu'],
  ARRAY['Nepal flights','Visa fees','Lunches','Travel insurance','Tips'],
  ARRAY['Annapurna Base Camp at 4130m','Machhapuchhre Base Camp','Jhinu hot springs','Rhododendron forests'],
  'International', 8, 'active',
  '[
    {"day":1,"title":"Arrive Kathmandu","description":"Airport pickup, hotel, trek briefing."},
    {"day":2,"title":"Fly Pokhara + acclimatise","description":"Morning flight to Pokhara. Lakeside acclimatisation walk."},
    {"day":3,"title":"Nayapul → Tikhedhunga","description":"Drive Nayapul, trek begins. 5–6 hrs through villages."},
    {"day":4,"title":"Tikhedhunga → Ghorepani","description":"Steep climb, rhododendron forest, 3210m."},
    {"day":5,"title":"Poon Hill sunrise → Tadapani","description":"Pre-dawn Poon Hill for Annapurna panorama, continue to Tadapani."},
    {"day":6,"title":"Tadapani → Chhomrong","description":"Descend to Chhomrong, views of Annapurna South."},
    {"day":7,"title":"Chhomrong → Himalaya Hotel","description":"Enter Modi Khola valley, bamboo forests."},
    {"day":8,"title":"Himalaya Hotel → MBC","description":"Climb to Machhapuchhre Base Camp (3700m)."},
    {"day":9,"title":"MBC → ABC → MBC","description":"Summit day to Annapurna Base Camp (4130m), return."},
    {"day":10,"title":"Descend to Bamboo","description":"Long descent, hot springs at Jhinu."},
    {"day":11,"title":"Bamboo → Nayapul → Pokhara","description":"Complete descent, drive to Pokhara."},
    {"day":12,"title":"Pokhara → Kathmandu","description":"Fly back, farewell dinner."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20interested%20in%20Nepal%20ABC%20Trek!'
),

-- 4. Bhutan Kingdom Tour
(
  'bhutan-kingdom',
  'Bhutan Kingdom Tour',
  'tour', 'Bhutan', 'Thimphu & Paro, Bhutan', 7, 45999, 555, 10, 'easy',
  ARRAY['Licensed Bhutan guide','6 nights hotel','All meals','Bhutan SDF ($200/day included in price)','Transport within Bhutan'],
  ARRAY['Flights to Paro','Bhutan visa','Travel insurance','Personal expenses'],
  ARRAY['Tiger''s Nest Monastery (Paro Taktsang)','Buddha Dordenma Thimphu','Punakha Dzong','Local archery experience'],
  'International', 6, 'active',
  '[
    {"day":1,"title":"Arrive Paro","description":"Fly into Paro (one of the world''s most challenging airports). Hotel, orientation."},
    {"day":2,"title":"Thimphu","description":"Capital city tour — Buddha Dordenma, Memorial Chorten, Takin Reserve."},
    {"day":3,"title":"Punakha Valley","description":"Cross Dochula Pass, Punakha Dzong, Chimi Lhakhang fertility temple."},
    {"day":4,"title":"Phobjikha Valley","description":"Gangtey Monastery, black-necked crane habitat."},
    {"day":5,"title":"Back to Paro","description":"Local market, traditional farmhouse visit."},
    {"day":6,"title":"Tiger''s Nest Trek","description":"5km hike up to Paro Taktsang (3120m), most iconic landmark in Bhutan."},
    {"day":7,"title":"Departure","description":"Souvenir shopping, departure flight."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20interested%20in%20Bhutan%20Kingdom%20Tour!'
),

-- 5. Philippines Palawan
(
  'philippines-palawan',
  'Philippines Palawan Adventure',
  'tour', 'Philippines', 'Palawan, Philippines', 6, 39999, 480, 12, 'moderate',
  ARRAY['Local island guide','5 nights accommodation','Island hopping boat','All meals','Snorkeling gear'],
  ARRAY['International flights','Philippines e-visa','Travel insurance','Alcoholic drinks'],
  ARRAY['El Nido island hopping','Underground River UNESCO site','Coron wreck diving','Secret beaches'],
  'International', 8, 'active',
  '[
    {"day":1,"title":"Arrive Puerto Princesa","description":"Airport transfer, orientation, city tour."},
    {"day":2,"title":"Underground River","description":"UNESCO World Heritage underground river tour, 8km navigable cave."},
    {"day":3,"title":"Fly to El Nido","description":"Scenic flight, check-in, sunset at Las Cabanas beach."},
    {"day":4,"title":"Island Hopping Tour A","description":"Big Lagoon, Small Lagoon, Secret Beach, Shimizu Island."},
    {"day":5,"title":"Island Hopping Tour C","description":"Helicopter Island, Matinloc Shrine, Hidden Beach."},
    {"day":6,"title":"Depart","description":"Morning free, transfer to airport."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20interested%20in%20Philippines%20Palawan%20trip!'
),

-- 6. Birthday Goa
(
  'birthday-goa',
  'Birthday Goa Escape',
  'special', 'India', 'North Goa', 3, 7999, 96, 20, 'easy',
  ARRAY['2 nights beach hotel','Beach bonfire & decoration','Cake & personalised welcome','WhatsApp group coordination','All breakfasts'],
  ARRAY['Flights/train to Goa','Lunches & dinners','Water sports','Personal expenses'],
  ARRAY['Private beach bonfire','Custom birthday setup','Sunrise beach walk','Goa pub crawl (optional)'],
  '🎉 Birthday', 15, 'active',
  '[
    {"day":1,"title":"Arrive & Check-in","description":"Arrive Goa, hotel check-in, sunset at Anjuna beach, welcome dinner."},
    {"day":2,"title":"Birthday Celebration","description":"Morning beach walk, water sports, afternoon free, evening birthday bonfire with cake."},
    {"day":3,"title":"Departure","description":"Morning swim, breakfast, check-out."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20want%20to%20plan%20a%20Birthday%20Goa%20Escape!'
),

-- 7. Anniversary Coorg
(
  'anniversary-coorg',
  'Anniversary Coorg Retreat',
  'special', 'India', 'Coorg, Karnataka', 2, 9999, 121, 2, 'easy',
  ARRAY['1 night plantation stay','Romantic room decoration','Candlelit dinner','Coffee estate walk','Couple photography session','Breakfast'],
  ARRAY['Travel to Coorg','Lunch','Personal spa treatments','Travel insurance'],
  ARRAY['Private plantation stay','Candlelit dinner under the stars','Couples'' sunrise trek','Professional photography'],
  '❤️ Anniversary', 3, 'active',
  '[
    {"day":1,"title":"Arrive & Romance Begins","description":"Arrive Coorg, room decorated with flowers, evening candlelit dinner at estate."},
    {"day":2,"title":"Sunrise Trek & Photography","description":"Early sunrise trek to viewpoint, photography session, breakfast, checkout."}
  ]'::JSONB,
  'https://wa.me/919999999999?text=Hi%2C%20want%20to%20plan%20an%20Anniversary%20Coorg%20Retreat!'
)

ON CONFLICT (trip_id) DO NOTHING;

-- ─── SEED — placeholder YouTube videos ───────────────────────
INSERT INTO youtube_videos (title, youtube_url, embed_url, category)
VALUES
  ('Western Ghats Trek Highlights', 'https://youtube.com/shorts/PLACEHOLDER1', 'https://www.youtube.com/embed/PLACEHOLDER1', 'shorts'),
  ('Nepal Base Camp Journey 2025',  'https://youtube.com/shorts/PLACEHOLDER2', 'https://www.youtube.com/embed/PLACEHOLDER2', 'shorts'),
  ('Bhutan Kingdom Tour Reel',      'https://youtube.com/shorts/PLACEHOLDER3', 'https://www.youtube.com/embed/PLACEHOLDER3', 'shorts'),
  ('Monsoon Trek Time-lapse',       'https://youtube.com/PLACEHOLDER4',        'https://www.youtube.com/embed/PLACEHOLDER4', 'timelapse')
ON CONFLICT DO NOTHING;

-- ─── GRANT admin panel anon read on enquiries ─────────────────
-- The admin page uses anon key + password gate (not real auth).
-- For a dev/MVP setup, grant anon read on enquiries & custom_enquiries.
-- Remove these policies before going to production and use a service role instead.

CREATE POLICY IF NOT EXISTS "Admin anon can read enquiries"
  ON enquiries FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Admin anon can update enquiries"
  ON enquiries FOR UPDATE
  USING (true);

CREATE POLICY IF NOT EXISTS "Admin anon can read custom enquiries"
  ON custom_enquiries FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Admin anon can update custom enquiries"
  ON custom_enquiries FOR UPDATE
  USING (true);

CREATE POLICY IF NOT EXISTS "Admin anon can manage trips"
  ON trips FOR ALL
  USING (true);

CREATE POLICY IF NOT EXISTS "Admin anon can manage videos"
  ON youtube_videos FOR ALL
  USING (true);
