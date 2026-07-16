-- Automatic background location tracking (mobile/app/_layout.tsx) had no real
-- consent gate: it auto-started for every logged-in user on OS permission
-- grant, while the Safety screen's toggle was purely local state with zero
-- effect on the real tracker. This adds a persisted flag that actually gates
-- writes to the trip-member-visible location columns (last_latitude/
-- last_longitude/last_location_update). NOT NULL DEFAULT false means every
-- existing user is defaulted to sharing OFF, since consent was never
-- actually collected from them.
ALTER TABLE public.users
  ADD COLUMN location_sharing_enabled boolean NOT NULL DEFAULT false;
