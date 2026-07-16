-- trips.budget was read as four incompatible things across the app: creation
-- prompted "per person" and stored the raw number; trip/[id].tsx re-divided
-- it by group_size (double-dividing); budget/[tripId].tsx labeled it "Total
-- Budget" and compared it directly to aggregate trip_expenses; the
-- generate-itinerary edge function divided it by group_size for its own
-- "per person" framing. None of these agreed with each other.
--
-- Rather than force everyone into one interpretation, creation now offers an
-- explicit toggle (mobile/app/(tabs)/create.tsx) and every consumer reads
-- budget_type to decide whether to divide/multiply. Default 'total' matches
-- the majority of money-critical existing code (trip/[id].tsx's per-person
-- display and budget/[tripId].tsx's spend-tracking both already assumed
-- total), so every pre-existing row keeps meaning what that code already
-- assumed — no behavior change for historical trips until this migration's
-- consumer-side fixes land alongside it.
ALTER TABLE public.trips
  ADD COLUMN budget_type TEXT NOT NULL DEFAULT 'total' CHECK (budget_type IN ('total', 'per_person'));
