-- Points of Interest: waterfalls, viewpoints, peaks, campsites, etc. — the
-- "local guide" layer that no commercial geocoder (Mapbox) has data for in
-- the Western Ghats. Any authenticated user can submit; admin approves
-- before a POI is publicly visible. Seeded separately via a one-time
-- OpenStreetMap Overpass import (source='osm', pre-approved as bulk-trusted).

CREATE TABLE public.pois (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN
    ('waterfall','viewpoint','peak','campsite','temple','other')),
  lat numeric(10,8) NOT NULL,
  lng numeric(11,8) NOT NULL,
  description text,
  region text,
  images jsonb DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user','osm','admin')),
  osm_type text,
  osm_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_by uuid REFERENCES auth.users(id),
  rejection_reason text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- OSM element ids are only unique within their element type (node/way/relation),
-- so the dedup key must include osm_type, not just osm_id.
CREATE UNIQUE INDEX pois_osm_dedup ON public.pois (source, osm_type, osm_id)
  WHERE osm_id IS NOT NULL;
CREATE INDEX idx_pois_location ON public.pois (lat, lng);
CREATE INDEX idx_pois_status ON public.pois (status);

ALTER TABLE public.pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view approved pois"
  ON public.pois FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users view own submitted pois"
  ON public.pois FOR SELECT
  USING (auth.uid() = submitted_by);

CREATE POLICY "Users can submit pois"
  ON public.pois FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Users can edit own pending pois"
  ON public.pois FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending');

CREATE POLICY "Admin full access pois"
  ON public.pois FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE email = 'ntrjwebdev@gmail.com'
  ));

-- =====================
-- POI-PHOTOS bucket
-- =====================
INSERT INTO storage.buckets (id, name, public) VALUES ('poi-photos', 'poi-photos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "poi_photos_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'poi-photos');

CREATE POLICY "poi_photos_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'poi-photos');

CREATE POLICY "poi_photos_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'poi-photos');

CREATE POLICY "poi_photos_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'poi-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
