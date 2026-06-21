-- Database Functions for Booking System

-- 1. Check Availability Function
-- Checks if a resource is available for the given dates
CREATE OR REPLACE FUNCTION check_resource_availability(
  p_resource_id UUID,
  p_resource_type TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  -- Check for any confirmed or pending bookings that overlap with the requested dates
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM public.bookings
  WHERE resource_id = p_resource_id
    AND resource_type = p_resource_type
    AND status IN ('pending', 'confirmed')
    AND (
      (start_date <= p_end_date AND end_date >= p_start_date)
    );

  -- If count is 0, it's available
  RETURN v_conflict_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Booking Transaction
-- Atomically checks availability and creates booking
CREATE OR REPLACE FUNCTION create_booking_request(
  p_resource_id UUID,
  p_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_guests INTEGER,
  p_total_price INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_is_available BOOLEAN;
  v_booking_id UUID;
  v_resource_name TEXT;
  v_owner_id UUID;
  v_user_name TEXT;
BEGIN
  -- 1. STRICT Availability Check
  SELECT check_resource_availability(p_resource_id, p_type, p_start_date, p_end_date) INTO v_is_available;

  IF NOT v_is_available THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dates are already booked!');
  END IF;

  -- 2. Validate dates
  IF p_start_date >= p_end_date THEN
     RETURN jsonb_build_object('success', false, 'message', 'End date must be after start date');
  END IF;

  IF p_start_date < CURRENT_DATE THEN
     RETURN jsonb_build_object('success', false, 'message', 'Cannot book dates in the past');
  END IF;

  -- 3. Get Resource Details (Generic lookup)
  IF p_type = 'homestay' THEN
      SELECT name, owner_id INTO v_resource_name, v_owner_id
      FROM public.homestays WHERE id = p_resource_id;
  ELSIF p_type = 'guide' THEN
      SELECT name, user_id INTO v_resource_name, v_owner_id
      FROM public.guides WHERE id = p_resource_id;
  ELSE
      RETURN jsonb_build_object('success', false, 'message', 'Invalid resource type');
  END IF;
  
  -- 4. Get User Name
  SELECT raw_user_meta_data->>'full_name' INTO v_user_name
  FROM auth.users
  WHERE id = auth.uid();

  -- 5. Create Booking
  INSERT INTO public.bookings (
    user_id,
    resource_type,
    resource_id,
    start_date,
    end_date,
    guests_count,
    total_price,
    status,
    payment_status
  ) VALUES (
    auth.uid(),
    p_type,
    p_resource_id,
    p_start_date,
    p_end_date,
    p_guests,
    p_total_price,
    'pending',
    'unpaid'
  ) RETURNING id INTO v_booking_id;

  -- 6. Create Notification for Host
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    related_id
  ) VALUES (
    v_owner_id,
    'booking',
    'New Booking Request',
    COALESCE(v_user_name, 'Someone') || ' requested to book ' || v_resource_name || ' for ' || p_guests || ' guests.',
    v_booking_id
  );

  RETURN jsonb_build_object(
    'success', true, 
    'booking_id', v_booking_id,
    'message', 'Booking request sent successfully!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
