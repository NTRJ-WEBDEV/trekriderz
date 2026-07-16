-- Found while verifying the new Profile trips union (Tier 2): an accepted
-- trip_members row does NOT grant visibility into the trip itself. The
-- trips SELECT policy only checked (created_by = auth.uid()) OR
-- (is_public = true) — an invited, accepted member of a PRIVATE trip could
-- not view that trip's own row at all (confirmed directly: SELECT * FROM
-- trips as that member returned null, no error, just RLS-filtered).
--
-- This silently blocks every screen that loads a trip by id for anyone who
-- isn't its creator or the trip isn't public — trip/[id].tsx, chat, budget,
-- itinerary, map, safety, packing — for any private trip's invited members.
-- Almost certainly pre-existing and unrelated to today's other fixes; it
-- surfaced now because this was the first time a query joined trip_members
-- membership through to the actual trips row for a non-public trip.
--
-- A direct EXISTS-on-trip_members clause here causes "infinite recursion
-- detected in policy for relation trips": this new clause reads
-- trip_members, whose own SELECT policy ("Users can view trip members of
-- their trips") reads trips, forming a two-table cycle. A SECURITY DEFINER
-- helper function breaks the cycle — it queries trip_members without
-- re-triggering trip_members' own RLS, mirroring the fix already used
-- elsewhere in this project for the equivalent self-referencing case.
CREATE OR REPLACE FUNCTION public.is_accepted_trip_member(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND user_id = p_user_id AND status = 'accepted'
  );
$$;

ALTER POLICY "Users can view their own trips or public trips"
ON public.trips
USING (
  (created_by = auth.uid())
  OR (is_public = true)
  OR public.is_accepted_trip_member(id, auth.uid())
);
