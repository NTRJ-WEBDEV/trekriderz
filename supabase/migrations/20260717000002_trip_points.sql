-- Trip-scoped points/stops for the trip map — either a pin dropped by long-
-- press (custom lat/lng + label) or an existing catalog POI added to the
-- trip. Denormalized (lat/lng/label/category always present on the row,
-- copied from the POI at insert time when poi_id is set) rather than
-- requiring a join: the map only ever needs one query, and a pin survives
-- unchanged even if its source POI is later edited, rejected, or deleted.
CREATE TABLE public.trip_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  poi_id uuid REFERENCES public.pois(id) ON DELETE SET NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'custom'
    CHECK (category IN ('waterfall', 'viewpoint', 'peak', 'campsite', 'temple', 'other', 'custom')),
  lat numeric(10,8) NOT NULL,
  lng numeric(11,8) NOT NULL,
  notes text,
  added_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_points_trip_id ON public.trip_points(trip_id);

ALTER TABLE public.trip_points ENABLE ROW LEVEL SECURITY;

-- Mirrors the trip_messages / trail_routes RLS pattern already established
-- for this app: accepted trip members can read/add. Delete is narrower than
-- either precedent (neither has a DELETE policy at all — chat and trail
-- pings are append-only) since pins are expected to be removable: scoped to
-- the point's own adder or the trip organizer, so one member can't wipe
-- another's contributions.
CREATE POLICY "Trip members can view points" ON public.trip_points
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_points.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.status = 'accepted'
    )
  );

CREATE POLICY "Trip members can add points" ON public.trip_points
  FOR INSERT
  WITH CHECK (
    added_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_points.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.status = 'accepted'
    )
  );

CREATE POLICY "Adder or organizer can remove points" ON public.trip_points
  FOR DELETE
  USING (
    added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_points.trip_id AND trips.created_by = auth.uid()
    )
  );
