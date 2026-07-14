-- Minimal trail/route geometry storage for the offline safety view.
-- A trail is just an ordered array of {lat,lng} points — no PostGIS, no
-- GeoJSON — that's enough for v1 (a schematic offline plot, not a real map).
-- Scoped to either a trip (user-recorded, live during a trek) or a POI
-- (future: admin-curated known trails to a peak/waterfall) — never both.
CREATE TABLE IF NOT EXISTS public.trail_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  poi_id uuid REFERENCES public.pois(id) ON DELETE CASCADE,
  coordinates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trail_routes_one_owner CHECK (
    (trip_id IS NOT NULL AND poi_id IS NULL) OR (trip_id IS NULL AND poi_id IS NOT NULL)
  )
);

-- One growing row per trip — points get appended to it, not one row per ping.
CREATE UNIQUE INDEX IF NOT EXISTS trail_routes_trip_id_unique
  ON public.trail_routes (trip_id) WHERE trip_id IS NOT NULL;

ALTER TABLE public.trail_routes ENABLE ROW LEVEL SECURITY;

-- Mirrors the trip_messages / trip_members RLS pattern already established
-- for this app: accepted trip members can read/write their trip's trail.
-- POI-scoped rows (once anything writes them) are public read, same as pois.
CREATE POLICY "Trip members can view trail" ON public.trail_routes
  FOR SELECT
  USING (
    (trip_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trail_routes.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.status = 'accepted'
    ))
    OR poi_id IS NOT NULL
  );

CREATE POLICY "Trip members can insert trail" ON public.trail_routes
  FOR INSERT
  WITH CHECK (
    trip_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trail_routes.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.status = 'accepted'
    )
  );

CREATE POLICY "Trip members can update trail" ON public.trail_routes
  FOR UPDATE
  USING (
    trip_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trail_routes.trip_id
        AND trip_members.user_id = auth.uid()
        AND trip_members.status = 'accepted'
    )
  );

-- Atomic append (INSERT ... ON CONFLICT DO UPDATE with jsonb ||) instead of a
-- client-side read-modify-write, so concurrent location pings from a member's
-- own retry logic can't clobber each other. SECURITY INVOKER (the default) —
-- runs as the calling user, so the RLS policies above still apply normally.
CREATE OR REPLACE FUNCTION public.append_trail_points(p_trip_id uuid, p_points jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.trail_routes (trip_id, coordinates)
  VALUES (p_trip_id, p_points)
  ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL
  DO UPDATE SET
    coordinates = public.trail_routes.coordinates || excluded.coordinates,
    updated_at = now();
END;
$$;
