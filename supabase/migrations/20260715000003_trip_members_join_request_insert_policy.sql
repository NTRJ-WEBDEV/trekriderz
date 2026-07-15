-- trip_members has RLS enabled but zero INSERT policy — Postgres default-denies
-- every insert. Found while verifying the notification fixes: discover.tsx's
-- join-request insert ({trip_id, user_id: self, role: 'member', status:
-- 'invited'}) silently fails with "new row violates row-level security policy",
-- so the notification-side fix landed on top of a flow that never actually
-- created the trip_members row.
--
-- The existing "Trip creators can manage members" FOR ALL policy already
-- covers invite/[tripId].tsx's organizer-invite path: it has no explicit
-- WITH CHECK, so Postgres reuses its USING expression (trip creator = auth.uid())
-- for the INSERT check too — that expression never references the row's
-- user_id, so a creator can already insert a member row for someone else.
-- Confirmed empirically. That path needed no change.
--
-- No DB-level constraint prevented duplicate (trip_id, user_id) rows. A
-- self-referential NOT EXISTS check inside the new policy's WITH CHECK was
-- tried first but causes "infinite recursion detected in policy for relation
-- trip_members" — Postgres cannot apply a table's own RLS while evaluating
-- that table's policy. A UNIQUE constraint is the correct guard instead: it's
-- enforced at the DB level for every insert path (self-join and organizer-
-- invite alike), not just this one policy, and neither existing insert call
-- site relies on multiple rows per (trip_id, user_id) — accept/decline update
-- status in place (notifications.tsx), removal deletes (trip-members/[tripId].tsx),
-- and invite/[tripId].tsx already blocks re-inviting an existing member
-- client-side before it would ever hit this constraint.
ALTER TABLE public.trip_members
  ADD CONSTRAINT trip_members_trip_user_unique UNIQUE (trip_id, user_id);

-- Self-service join-request policy: a user may insert a row for themselves,
-- as a pending join request ('invited'/'member', matching discover.tsx's
-- exact insert shape), only on a trip that is public.
CREATE POLICY "Users can request to join public trips"
ON public.trip_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND status = 'invited'
  AND role = 'member'
  AND EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = trip_members.trip_id
      AND trips.is_public = true
  )
);
