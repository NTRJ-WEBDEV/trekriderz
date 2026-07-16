-- Two independent fixes needed to ship the trip status flow and a working
-- delete-trip screen.

-- 1) trips.status had no value for "date passed, awaiting organizer
-- confirmation" — every trip stayed 'planning'/'confirmed' forever, which is
-- why past-dated trips kept leaking into "upcoming" lists app-wide (the
-- separate date-filter fix in the client handles the display side; this is
-- the status-side counterpart the audit's design called for).
ALTER TABLE public.trips DROP CONSTRAINT trips_status_check;
ALTER TABLE public.trips ADD CONSTRAINT trips_status_check
  CHECK (status = ANY (ARRAY['planning', 'confirmed', 'pending_confirmation', 'completed', 'cancelled']));

-- Daily housekeeping: once a trip's end_date has passed, move it out of
-- planning/confirmed into pending_confirmation so the organizer gets
-- prompted (client-side banner) to mark it Completed or Cancelled. Scheduled
-- for 20:00 UTC (01:30 IST) specifically so the full IST calendar day of
-- end_date has definitely elapsed before flipping — Postgres's CURRENT_DATE
-- is UTC-based on Supabase, and IST is 5.5 hours ahead, so anything earlier
-- risks flipping a trip late on its own last evening (IST).
SELECT cron.schedule(
  'trip-expiry-check',
  '0 20 * * *',
  $$
  UPDATE public.trips
  SET status = 'pending_confirmation'
  WHERE status IN ('planning', 'confirmed')
    AND end_date < CURRENT_DATE;
  $$
);

-- 2) Delete-trip needs these FKs to not hard-block deletion. trip_expenses
-- and shared_lists both have NOT NULL trip_id and are entirely owned by
-- their trip (shared_lists has zero references anywhere in the mobile or
-- web app — confirmed dead-but-present table), so CASCADE is correct: there
-- is no meaningful "orphaned" row to keep. posts.trip_id is nullable and a
-- post is a standalone piece of content that merely references a trip for
-- context, so SET NULL keeps the post alive rather than destroying it or
-- blocking the trip's deletion.
ALTER TABLE public.trip_expenses DROP CONSTRAINT trip_expenses_trip_id_fkey;
ALTER TABLE public.trip_expenses ADD CONSTRAINT trip_expenses_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;

ALTER TABLE public.shared_lists DROP CONSTRAINT shared_lists_trip_id_fkey;
ALTER TABLE public.shared_lists ADD CONSTRAINT shared_lists_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;

ALTER TABLE public.posts DROP CONSTRAINT posts_trip_id_fkey;
ALTER TABLE public.posts ADD CONSTRAINT posts_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;
