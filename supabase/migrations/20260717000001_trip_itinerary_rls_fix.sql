-- trip_itinerary was created with USING (true) FOR ALL TO authenticated —
-- any signed-in user could read or write any trip's itinerary rows,
-- regardless of ownership. Scope it the same way trips itself is scoped
-- (see 20260716000002_trip_member_visibility.sql): readable if the parent
-- trip is public, owned, or the requester is an accepted member; writable
-- only by the trip's creator or a CMS admin/moderator. This is independent
-- of the separate trip_itinerary vs trips.itinerary JSONB consolidation
-- decision — whichever store ends up canonical, this was a live gap either way.

DROP POLICY IF EXISTS "Itinerary public read" ON public.trip_itinerary;
DROP POLICY IF EXISTS "Itinerary auth write" ON public.trip_itinerary;

CREATE POLICY "Itinerary read scoped to trip visibility" ON public.trip_itinerary
FOR SELECT TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_itinerary.trip_id
      AND (
        t.is_public = true
        OR t.created_by = auth.uid()
        OR public.is_accepted_trip_member(t.id, auth.uid())
      )
  )
);

CREATE POLICY "Itinerary write scoped to owner or admin" ON public.trip_itinerary
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_itinerary.trip_id AND t.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = trip_itinerary.trip_id AND t.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'moderator')
  )
);
