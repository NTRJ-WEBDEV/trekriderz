-- Overlap/capacity-check functions backing Stage 2 of the booking-integrity fixes.
--
-- These are SECURITY DEFINER because none of property_inquiries/guide_inquiries/
-- rental_inquiries/trip_members grant a plain authenticated user SELECT access to
-- other users' rows (confirmed via pg_policies audit) — widening those SELECT
-- policies would leak other guests' contact info/messages to any stranger checking
-- availability. Each function returns only a boolean/jsonb verdict, nothing else.

-- 1. Homestay (properties/room_types model) overlap check.
CREATE OR REPLACE FUNCTION public.check_property_inquiry_overlap(
  p_room_type_id uuid, p_checkin date, p_checkout date
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.property_inquiries
    WHERE room_type_id = p_room_type_id
      AND status IN ('new', 'confirmed')
      AND checkin_date <= p_checkout
      AND checkout_date >= p_checkin
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_property_inquiry_overlap(uuid, date, date) TO authenticated;

-- 2. Guide overlap check — considers both guide_inquiries (structured start_date/end_date
--    added in 20260709000003) and any real bookings rows (resource_type='guide').
CREATE OR REPLACE FUNCTION public.check_guide_inquiry_overlap(
  p_guide_id uuid, p_start date, p_end date
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guide_inquiries
    WHERE guide_id = p_guide_id
      AND status <> 'cancelled'
      AND start_date IS NOT NULL AND end_date IS NOT NULL
      AND start_date <= p_end AND end_date >= p_start
  ) OR EXISTS (
    SELECT 1 FROM public.bookings
    WHERE resource_id = p_guide_id
      AND resource_type = 'guide'
      AND status IN ('pending', 'confirmed')
      AND start_date <= p_end AND end_date >= p_start
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_guide_inquiry_overlap(uuid, date, date) TO authenticated;

-- 3. Rental vehicle overlap check — soft warning only, caller does not block on this.
CREATE OR REPLACE FUNCTION public.check_rental_inquiry_overlap(
  p_vehicle_id uuid, p_start date, p_end date
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rental_inquiries
    WHERE vehicle_id = p_vehicle_id
      AND status <> 'cancelled'
      AND start_date <= p_end AND end_date >= p_start
  );
$$;
GRANT EXECUTE ON FUNCTION public.check_rental_inquiry_overlap(uuid, date, date) TO authenticated;

-- 4. Trip capacity — atomic check-then-accept, not just a check, because:
--    a) "Users can view trip members of their trips" only allows SELECT when
--       trips.created_by = auth.uid() OR trips.is_public = true, so an invitee on a
--       PRIVATE trip they didn't create cannot even read trip_members client-side to
--       count current members, and
--    b) a plain client-side check-then-update has a race window where two invitees
--       accepting at the same instant could both squeeze past a stale count.
--    FOR UPDATE locks the trip's existing member rows for the duration of the
--    transaction so concurrent accepts serialize instead of double-booking the last slot.
CREATE OR REPLACE FUNCTION public.accept_trip_invite(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_size integer;
  v_accepted_count integer;
  v_member_status text;
BEGIN
  SELECT status INTO v_member_status
  FROM public.trip_members
  WHERE trip_id = p_trip_id AND user_id = auth.uid();

  IF v_member_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No invitation found for this trip.');
  END IF;

  IF v_member_status = 'accepted' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already accepted.');
  END IF;

  SELECT group_size INTO v_group_size FROM public.trips WHERE id = p_trip_id;
  IF v_group_size IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Trip not found.');
  END IF;

  PERFORM 1 FROM public.trip_members WHERE trip_id = p_trip_id FOR UPDATE;

  SELECT count(*) INTO v_accepted_count
  FROM public.trip_members
  WHERE trip_id = p_trip_id AND status = 'accepted';

  IF v_accepted_count >= v_group_size THEN
    RETURN jsonb_build_object('success', false, 'message', 'This trip is already full.');
  END IF;

  UPDATE public.trip_members SET status = 'accepted'
  WHERE trip_id = p_trip_id AND user_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'message', 'Joined the trip!');
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(uuid) TO authenticated;
