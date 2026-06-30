-- ============================================================
-- TrekRiderz CMS Admin Tables
-- ============================================================

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-photos', 'trip-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('story-photos', 'story-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('place-photos', 'place-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read, authenticated write
CREATE POLICY "Public read trip-photos" ON storage.objects FOR SELECT USING (bucket_id = 'trip-photos');
CREATE POLICY "Auth upload trip-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trip-photos');
CREATE POLICY "Auth update trip-photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'trip-photos');
CREATE POLICY "Auth delete trip-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trip-photos');

CREATE POLICY "Public read story-photos" ON storage.objects FOR SELECT USING (bucket_id = 'story-photos');
CREATE POLICY "Auth upload story-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'story-photos');
CREATE POLICY "Auth delete story-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'story-photos');

CREATE POLICY "Public read place-photos" ON storage.objects FOR SELECT USING (bucket_id = 'place-photos');
CREATE POLICY "Auth upload place-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'place-photos');
CREATE POLICY "Auth delete place-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'place-photos');

CREATE POLICY "Public read vehicle-photos" ON storage.objects FOR SELECT USING (bucket_id = 'vehicle-photos');
CREATE POLICY "Auth upload vehicle-photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicle-photos');
CREATE POLICY "Auth delete vehicle-photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'vehicle-photos');

-- ============================================================
-- PROFILES (CMS admin users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'moderator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: self read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: admin read all" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
CREATE POLICY "Profiles: admin update" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Auto-create profile on signup
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

-- Ensure existing super admin has profile
INSERT INTO public.profiles (id, email, name, role)
SELECT id, email, 'Natraj', 'super_admin'
FROM auth.users WHERE email = 'ntrjwebdev@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- ============================================================
-- TRIPS (extend existing table)
-- ============================================================
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS price_usd INTEGER;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS max_group_size INTEGER DEFAULT 20;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS inclusions TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS exclusions TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS highlights TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS available_slots INTEGER DEFAULT 20;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- TRIP PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_cover BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip photos public read" ON public.trip_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Trip photos auth write" ON public.trip_photos FOR ALL TO authenticated USING (true);

-- ============================================================
-- TRIP ITINERARY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_itinerary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trip_itinerary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itinerary public read" ON public.trip_itinerary FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Itinerary auth write" ON public.trip_itinerary FOR ALL TO authenticated USING (true);

-- ============================================================
-- STORIES / BLOG
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  destination TEXT,
  body TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stories public read approved" ON public.stories FOR SELECT TO anon USING (status = 'approved');
CREATE POLICY "Stories auth read own" ON public.stories FOR SELECT TO authenticated USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Stories auth write" ON public.stories FOR ALL TO authenticated USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- RENTAL VEHICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rental_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'motorcycle' CHECK (type IN ('motorcycle', 'car', 'suv', 'van', 'cycle')),
  description TEXT,
  price_per_day INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  capacity INTEGER DEFAULT 1,
  features TEXT[],
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'inactive')),
  cover_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.rental_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicles public read" ON public.rental_vehicles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vehicles auth write" ON public.rental_vehicles FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.rental_vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_cover BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vehicle photos public read" ON public.vehicle_photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Vehicle photos auth write" ON public.vehicle_photos FOR ALL TO authenticated USING (true);

-- ============================================================
-- PLACES GUIDE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.places_guide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'India',
  description TEXT,
  best_time TEXT,
  how_to_reach TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.places_guide ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Places public read" ON public.places_guide FOR SELECT TO anon USING (status = 'published');
CREATE POLICY "Places auth read all" ON public.places_guide FOR SELECT TO authenticated USING (true);
CREATE POLICY "Places auth write" ON public.places_guide FOR ALL TO authenticated USING (true);

-- ============================================================
-- SITE SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Settings auth write" ON public.site_settings FOR ALL TO authenticated USING (true);

INSERT INTO public.site_settings (key, value) VALUES
  ('whatsapp_number', '917339231537'),
  ('email', 'ntrjwebdev@gmail.com'),
  ('instagram_url', 'https://instagram.com/trekriderz'),
  ('youtube_url', 'https://youtube.com/@trekriderz'),
  ('stat_trips', '10'),
  ('stat_countries', '6'),
  ('stat_trekkers', '50'),
  ('stat_trails', '15'),
  ('site_name', 'TrekRiderz'),
  ('tagline', 'Trek. Travel. Connect.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ADMIN INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'moderator')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Invites: super admin only" ON public.admin_invites FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Update youtube_videos to add order_index if missing
ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Update enquiries status options
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_status_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_check
  CHECK (status IN ('new', 'contacted', 'booked', 'closed', 'responded'));
