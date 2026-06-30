-- ============================================================
-- CMS Full Setup — standalone, safe to run fresh or after
-- partial migration 1. All CREATE TABLE IF NOT EXISTS +
-- DO blocks for policies so nothing errors on duplicates.
-- ============================================================

-- ─── STORAGE BUCKETS ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-photos',     'trip-photos',     true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('story-photos',    'story-photos',    true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('place-photos',    'place-photos',    true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos',  'vehicle-photos',  true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS (drop-then-create to avoid duplicates)
DROP POLICY IF EXISTS "Public read trip-photos"    ON storage.objects;
DROP POLICY IF EXISTS "Auth upload trip-photos"    ON storage.objects;
DROP POLICY IF EXISTS "Auth update trip-photos"    ON storage.objects;
DROP POLICY IF EXISTS "Auth delete trip-photos"    ON storage.objects;
DROP POLICY IF EXISTS "Public read story-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload story-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Auth delete story-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Public read place-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Auth upload place-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Auth delete place-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Public read vehicle-photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload vehicle-photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete vehicle-photos" ON storage.objects;

CREATE POLICY "Public read trip-photos"    ON storage.objects FOR SELECT USING (bucket_id = 'trip-photos');
CREATE POLICY "Auth upload trip-photos"    ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trip-photos');
CREATE POLICY "Auth update trip-photos"    ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trip-photos');
CREATE POLICY "Auth delete trip-photos"    ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trip-photos');
CREATE POLICY "Public read story-photos"   ON storage.objects FOR SELECT USING (bucket_id = 'story-photos');
CREATE POLICY "Auth upload story-photos"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'story-photos');
CREATE POLICY "Auth delete story-photos"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'story-photos');
CREATE POLICY "Public read place-photos"   ON storage.objects FOR SELECT USING (bucket_id = 'place-photos');
CREATE POLICY "Auth upload place-photos"   ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'place-photos');
CREATE POLICY "Auth delete place-photos"   ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'place-photos');
CREATE POLICY "Public read vehicle-photos" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-photos');
CREATE POLICY "Auth upload vehicle-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicle-photos');
CREATE POLICY "Auth delete vehicle-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'vehicle-photos');

-- ─── PROFILES (must exist before admin_invites policy) ───────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT  UNIQUE NOT NULL,
  name       TEXT,
  role       TEXT  NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'moderator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles self read') THEN
    CREATE POLICY "Profiles self read" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles admin read all') THEN
    CREATE POLICY "Profiles admin read all" ON public.profiles FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Profiles admin update') THEN
    CREATE POLICY "Profiles admin update" ON public.profiles FOR UPDATE
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
  END IF;
END $$;

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_cms_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'ntrjwebdev@gmail.com' THEN 'super_admin' ELSE 'moderator' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_cms ON auth.users;
CREATE TRIGGER on_auth_user_created_cms
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_cms_user();

-- Seed existing super admin account if it exists in auth.users
INSERT INTO public.profiles (id, email, name, role)
SELECT id, email, 'Natraj', 'super_admin'
FROM auth.users WHERE email = 'ntrjwebdev@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- ─── TRIPS: CMS extension columns ────────────────────────────
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_date      DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS end_date        DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS price_usd       INTEGER;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS max_group_size  INTEGER DEFAULT 20;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS inclusions      TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS exclusions      TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS highlights      TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS available_slots INTEGER DEFAULT 20;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_featured     BOOLEAN DEFAULT false;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();

-- ─── TRIP PHOTOS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_photos (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID    NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  url         TEXT    NOT NULL,
  is_cover    BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_photos' AND policyname = 'Trip photos public read') THEN
    CREATE POLICY "Trip photos public read" ON public.trip_photos FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_photos' AND policyname = 'Trip photos auth write') THEN
    CREATE POLICY "Trip photos auth write" ON public.trip_photos FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- ─── TRIP ITINERARY ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trip_itinerary (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID    NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number  INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trip_itinerary ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_itinerary' AND policyname = 'Itinerary public read') THEN
    CREATE POLICY "Itinerary public read" ON public.trip_itinerary FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_itinerary' AND policyname = 'Itinerary auth write') THEN
    CREATE POLICY "Itinerary auth write" ON public.trip_itinerary FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- ─── STORIES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stories (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  title           TEXT    NOT NULL,
  destination     TEXT,
  body            TEXT,
  cover_image_url TEXT,
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  is_featured     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Stories public read approved') THEN
    CREATE POLICY "Stories public read approved" ON public.stories FOR SELECT TO anon USING (status = 'approved');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories' AND policyname = 'Stories auth write') THEN
    CREATE POLICY "Stories auth write" ON public.stories FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- ─── PLACES GUIDE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.places_guide (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT    NOT NULL,
  state           TEXT,
  region          TEXT,
  country         TEXT    DEFAULT 'India',
  description     TEXT,
  best_season     TEXT,
  difficulty      TEXT    DEFAULT 'moderate',
  altitude_m      INTEGER,
  cover_image_url TEXT,
  is_featured     BOOLEAN DEFAULT false,
  tags            TEXT[]  DEFAULT '{}',
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.places_guide ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'places_guide' AND policyname = 'Places public read') THEN
    CREATE POLICY "Places public read" ON public.places_guide FOR SELECT TO anon USING (status = 'published');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'places_guide' AND policyname = 'Places auth write') THEN
    CREATE POLICY "Places auth write" ON public.places_guide FOR ALL TO authenticated USING (true);
  END IF;
END $$;
-- Backfill columns if table already existed with fewer columns
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS region       TEXT;
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS best_season  TEXT;
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS difficulty   TEXT DEFAULT 'moderate';
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS altitude_m   INTEGER;
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS is_featured  BOOLEAN DEFAULT false;
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS tags         TEXT[] DEFAULT '{}';

-- ─── SITE SETTINGS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Settings public read') THEN
    CREATE POLICY "Settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Settings auth write') THEN
    CREATE POLICY "Settings auth write" ON public.site_settings FOR ALL TO authenticated USING (true);
  END IF;
END $$;
INSERT INTO public.site_settings (key, value) VALUES
  ('whatsapp_number', '917339231537'),
  ('email', 'ntrjwebdev@gmail.com'),
  ('instagram_url', 'https://instagram.com/trekriderz'),
  ('youtube_url', 'https://youtube.com/@trekriderz'),
  ('stat_trips', '10'),
  ('stat_countries', '6'),
  ('stat_trekkers', '50'),
  ('stat_trails', '15')
ON CONFLICT (key) DO NOTHING;

-- ─── ADMIN INVITES (profiles must exist first) ────────────────
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'moderator')),
  name        TEXT,
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_invites' AND policyname = 'Invites super admin only') THEN
    CREATE POLICY "Invites super admin only" ON public.admin_invites FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
  END IF;
END $$;

-- ─── CMS VEHICLES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cms_vehicles (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL DEFAULT 'bike',
  capacity      INTEGER DEFAULT 1,
  price_per_day INTEGER NOT NULL DEFAULT 0,
  location      TEXT,
  description   TEXT,
  is_available  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.cms_vehicles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cms_vehicles' AND policyname = 'CMS vehicles public read') THEN
    CREATE POLICY "CMS vehicles public read" ON public.cms_vehicles FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cms_vehicles' AND policyname = 'CMS vehicles auth write') THEN
    CREATE POLICY "CMS vehicles auth write" ON public.cms_vehicles FOR ALL TO authenticated USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cms_vehicle_photos (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID    NOT NULL REFERENCES public.cms_vehicles(id) ON DELETE CASCADE,
  url         TEXT    NOT NULL,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.cms_vehicle_photos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cms_vehicle_photos' AND policyname = 'CMS vehicle photos public read') THEN
    CREATE POLICY "CMS vehicle photos public read" ON public.cms_vehicle_photos FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cms_vehicle_photos' AND policyname = 'CMS vehicle photos auth write') THEN
    CREATE POLICY "CMS vehicle photos auth write" ON public.cms_vehicle_photos FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- ─── YOUTUBE VIDEOS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.youtube_videos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  youtube_url TEXT        NOT NULL,
  embed_url   TEXT,
  category    TEXT        DEFAULT 'shorts',
  description TEXT,
  order_index INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'youtube_videos' AND policyname = 'Anyone can read videos') THEN
    CREATE POLICY "Anyone can read videos" ON public.youtube_videos FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'youtube_videos' AND policyname = 'Auth write videos') THEN
    CREATE POLICY "Auth write videos" ON public.youtube_videos FOR ALL TO authenticated USING (true);
  END IF;
END $$;
ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS description TEXT;

-- ─── ENQUIRIES: add 'responded' status (only if table exists) ─
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enquiries') THEN
    ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_status_check;
    ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_check
      CHECK (status IN ('new', 'contacted', 'booked', 'closed', 'responded'));
  END IF;
END $$;
