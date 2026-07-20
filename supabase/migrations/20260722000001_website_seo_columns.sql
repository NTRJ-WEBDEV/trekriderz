-- ============================================================
-- Phase 4 Foundation: Website SEO columns
-- ============================================================
-- Additive only.
--
-- trips.difficulty: TripCard/trips/[id] have always assumed a
-- `difficulty` field (matching guided_expeditions' shape) but the
-- real `trips` table never had one — every difficulty badge on the
-- website was rendering a value that couldn't exist. Same enum as
-- guided_expeditions.difficulty for consistency.
--
-- slug columns: clean SEO URLs (/stories/bike-trip-to-ladakh,
-- /destinations/goa) need a human-readable identifier. Only added
-- to stories and places_guide — guides/homestays/rentals keep using
-- their id in the URL, matching the existing /trips/[id] and
-- /expeditions/[id] precedent, since there was no clear naming
-- convention to slug them by (a person's name isn't a stable slug
-- the way a place or article title is).
-- ============================================================

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy', 'moderate', 'challenging', 'expert'));

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE public.places_guide ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Backfill slugs for any existing rows from title/name.
UPDATE public.stories SET slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

UPDATE public.places_guide SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

CREATE INDEX IF NOT EXISTS idx_stories_slug ON public.stories(slug);
CREATE INDEX IF NOT EXISTS idx_places_guide_slug ON public.places_guide(slug);

-- ============================================================
-- Missing table: public.enquiries
-- ============================================================
-- Not a new feature — TripEnquiryForm.tsx, SpecialEnquiryForm.tsx, and
-- web/app/admin/enquiries/page.tsx have all referenced `public.enquiries`
-- since they were written, but the table itself was never migrated
-- (confirmed live: PGRST205 "table not found", closest match
-- `guide_inquiries`). Every trip enquiry submitted through the website has
-- been silently failing, and the admin Enquiries inbox has always been
-- empty for the "Trip Enquiries" tab. This creates the table the existing
-- code already assumes exists, matching its exact expected shape —
-- filling a gap, not introducing a new one.
CREATE TABLE IF NOT EXISTS public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID,
  trip_name TEXT,
  name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  group_size INTEGER,
  preferred_date TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
-- Public form submissions — anyone can create an enquiry (no login on the
-- website), matching custom_enquiries' existing policy shape.
CREATE POLICY "Enquiries: public insert" ON public.enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enquiries: staff read" ON public.enquiries FOR SELECT TO authenticated USING (public.has_permission('trips.view'));
CREATE POLICY "Enquiries: staff update" ON public.enquiries FOR UPDATE TO authenticated USING (public.has_permission('trips.view'));
