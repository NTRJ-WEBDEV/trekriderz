-- "Users can view trip members of their trips" only allowed the trip's
-- creator, or anyone if the trip is public, to see trip_members rows. A
-- regular accepted member of a *private* trip couldn't see their own
-- membership row. Since trip_messages' SELECT policy checks membership via
-- an EXISTS subquery against trip_members — itself subject to
-- trip_members' RLS — that subquery silently returned false for such
-- members, meaning they saw zero trip chat messages at all (not a realtime
-- issue: the same plain fetch on mount was equally broken).
--
-- Minimal fix: let a user always see their own trip_members row. This
-- unblocks the trip_messages membership check. It does not yet restore
-- seeing *other* members' rows in a private trip (needed for the member
-- list / "seen by" display) — that's a separate, broader visibility
-- decision left alone here.
DROP POLICY IF EXISTS "Users can view trip members of their trips" ON public.trip_members;
CREATE POLICY "Users can view trip members of their trips" ON public.trip_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_members.trip_id
        AND (trips.created_by = auth.uid() OR trips.is_public = true)
    )
  );
