-- Root cause behind three separate "broken" symptoms found in the trip
-- feature audit: trip creators were never inserted into trip_members, so
-- every screen that gates on membership (rather than trips.created_by)
-- silently excluded the person who made the trip — chat (RLS requires an
-- accepted trip_members row to send/read), the member list (isOrganizer
-- derives from a membership row that never existed), and the live map
-- (member pins come from trip_members).
--
-- An AFTER INSERT trigger is atomic with trip creation and can't be
-- forgotten by a future call site (an admin panel, a bulk import, another
-- creation flow) the way a second app-level insert() call could be. The
-- existing "Trip creators can manage members" FOR ALL policy already
-- permits a creator to insert their own membership row, so this needs no
-- new RLS — SECURITY DEFINER is used only so it also works uniformly
-- regardless of caller context, not to bypass a check that would otherwise
-- fail.
--
-- Also backfills every trip that already exists — this bug affects real,
-- already-created trips today, not just future ones. ON CONFLICT DO NOTHING
-- relies on the trip_members_trip_user_unique constraint (added in
-- 20260715000003_trip_members_join_request_insert_policy.sql).
CREATE OR REPLACE FUNCTION public.add_trip_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.trip_members (trip_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'organizer', 'accepted')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_trip_creator_as_member ON public.trips;
CREATE TRIGGER trg_add_trip_creator_as_member
  AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.add_trip_creator_as_member();

INSERT INTO public.trip_members (trip_id, user_id, role, status)
SELECT id, created_by, 'organizer', 'accepted'
FROM public.trips
ON CONFLICT (trip_id, user_id) DO NOTHING;
