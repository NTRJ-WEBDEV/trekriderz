-- ============================================================
-- Security & Permission Hardening
-- ============================================================
-- docs/architecture/LAUNCH_READINESS_AUDIT.md B1/B2, re-verified directly
-- against the live migration files rather than taken on faith (one
-- finding, trip_itinerary, was already fixed by 20260717000001 and is
-- correctly excluded below).
--
-- Part A: 20260629000001_cms_admin.sql / 20260629000002_cms_patch.sql
-- created a batch of tables with `FOR ALL TO authenticated USING (true)`
-- write policies — any signed-in user, including an ordinary traveller
-- account, can insert/update/delete rows on tables that should be
-- owner- or staff-only. Replaced with real ownership/staff scoping,
-- following the exact DROP+CREATE pattern 20260717000001 already used
-- for trip_itinerary.
--
-- Part B: 20260709000005_fix_properties_admin_policy.sql and
-- 20260705000003_fix_guide_documents_admin_policy.sql fixed the
-- auth.users-in-RLS-policy landmine (see project memory) but left the
-- replacement policies hardcoded to one email address. Every staff
-- member granted a role via the Team screen has a working RBAC role_id
-- but these six policies never check it — rewired to has_permission(),
-- the same primitive already used by partner_audit_system.sql and
-- review_workspace.sql for the identical entity types.
-- ============================================================

-- ── Part A: wide-open FOR ALL policies ──────────────────────────

-- trip_photos: writable by the parent trip's creator, or CMS staff.
DROP POLICY IF EXISTS "Trip photos auth write" ON public.trip_photos;
CREATE POLICY "Trip photos write scoped to owner or staff" ON public.trip_photos
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_photos.trip_id AND t.created_by = auth.uid())
  OR public.has_permission('trips.manage')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_photos.trip_id AND t.created_by = auth.uid())
  OR public.has_permission('trips.manage')
);

-- rental_vehicles: writable by the listing's owner, or rental staff.
DROP POLICY IF EXISTS "Vehicles auth write" ON public.rental_vehicles;
CREATE POLICY "Vehicles write scoped to owner or staff" ON public.rental_vehicles
FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.has_permission('rentals.approve') OR public.has_permission('rentals.edit'))
WITH CHECK (owner_id = auth.uid() OR public.has_permission('rentals.approve') OR public.has_permission('rentals.edit'));

-- Note: public.vehicle_photos (the plain, non-"cms_" child table declared
-- in 20260629000001_cms_admin.sql) was never actually created live —
-- confirmed both by a direct apply error and by zero application code
-- anywhere referencing it. Vehicle images live on rental_vehicles.images
-- (text[], added by 20260703000002_rental_vehicles_images.sql) instead,
-- already covered by the rental_vehicles policy above. Only cms_vehicle_photos
-- (the separate admin-authored catalog's child table, handled below) is real.

-- places_guide: writable by its author, or content staff.
DROP POLICY IF EXISTS "Places auth write" ON public.places_guide;
CREATE POLICY "Places write scoped to author or staff" ON public.places_guide
FOR ALL TO authenticated
USING (author_id = auth.uid() OR public.has_permission('cms.edit'))
WITH CHECK (author_id = auth.uid() OR public.has_permission('cms.edit'));

-- site_settings, cms_vehicles, cms_vehicle_photos, youtube_videos: no
-- owner concept (admin-authored catalog/config) — staff-only.
DROP POLICY IF EXISTS "Settings auth write" ON public.site_settings;
CREATE POLICY "Settings write staff only" ON public.site_settings
FOR ALL TO authenticated
USING (public.has_permission('cms.edit')) WITH CHECK (public.has_permission('cms.edit'));

DROP POLICY IF EXISTS "CMS vehicles auth write" ON public.cms_vehicles;
CREATE POLICY "CMS vehicles write staff only" ON public.cms_vehicles
FOR ALL TO authenticated
USING (public.has_permission('cms.edit')) WITH CHECK (public.has_permission('cms.edit'));

DROP POLICY IF EXISTS "CMS vehicle photos auth write" ON public.cms_vehicle_photos;
CREATE POLICY "CMS vehicle photos write staff only" ON public.cms_vehicle_photos
FOR ALL TO authenticated
USING (public.has_permission('cms.edit')) WITH CHECK (public.has_permission('cms.edit'));

DROP POLICY IF EXISTS "Auth write videos" ON public.youtube_videos;
CREATE POLICY "Videos write staff only" ON public.youtube_videos
FOR ALL TO authenticated
USING (public.has_permission('cms.edit')) WITH CHECK (public.has_permission('cms.edit'));

-- ── Part B: hardcoded-email admin policies → has_permission() ──────

DROP POLICY IF EXISTS "Admin full access properties" ON public.properties;
CREATE POLICY "Admin full access properties" ON public.properties
  FOR ALL USING (public.has_permission('homestays.approve'));

DROP POLICY IF EXISTS "Admin full access room types" ON public.room_types;
CREATE POLICY "Admin full access room types" ON public.room_types
  FOR ALL USING (public.has_permission('homestays.approve'));

DROP POLICY IF EXISTS "Admin full access property inquiries" ON public.property_inquiries;
CREATE POLICY "Admin full access property inquiries" ON public.property_inquiries
  FOR ALL USING (public.has_permission('homestays.approve'));

DROP POLICY IF EXISTS "Admin full access to guide_inquiries" ON public.guide_inquiries;
CREATE POLICY "Admin full access to guide_inquiries" ON public.guide_inquiries
  FOR ALL USING (public.has_permission('guides.approve'));

DROP POLICY IF EXISTS "Admin full access to rental_inquiries" ON public.rental_inquiries;
CREATE POLICY "Admin full access to rental_inquiries" ON public.rental_inquiries
  FOR ALL USING (public.has_permission('rentals.approve'));

DROP POLICY IF EXISTS "Admin can read all guide documents" ON storage.objects;
CREATE POLICY "Admin can read all guide documents" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'guide-documents' AND public.has_permission('guides.approve'));
