-- Trigger for booking status changes (NOTIFY CUSTOMER)
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_title := 'Booking Update: ' || initcap(NEW.status);
    v_message := 'Your ' || NEW.resource_type || ' reservation status has changed from ' || OLD.status || ' to ' || NEW.status || '.';

    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (NEW.user_id, 'booking', v_title, v_message, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_booking_status_notify
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_status_change();

-- Trigger for NEW bookings (NOTIFY OWNER)
CREATE OR REPLACE FUNCTION notify_owner_new_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Find owner based on resource_type
  IF NEW.resource_type = 'homestay' THEN
    SELECT owner_id INTO v_owner_id FROM public.homestays WHERE id = NEW.resource_id;
  ELSIF NEW.resource_type = 'guide' THEN
    SELECT user_id INTO v_owner_id FROM public.guides WHERE id = NEW.resource_id;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    v_title := 'New Booking Request 🏠';
    v_message := 'You have a new reservation request for dates: ' || NEW.start_date || ' to ' || NEW.end_date || '.';

    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (v_owner_id, 'booking', v_title, v_message, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_booking_notify
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_owner_new_booking();
