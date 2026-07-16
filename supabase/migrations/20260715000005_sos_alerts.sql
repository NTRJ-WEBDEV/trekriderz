-- SOS button had zero backend: it just opened the phone dialer to tel:112,
-- with no record, no notification to the trip, and no location attached.
-- This adds a minimal alert pipeline: a row per SOS press, and a trigger
-- that pages the trip creator + every accepted member (excluding the
-- sender) through the same notifications table + push pipeline already
-- used for likes/comments/follows (see 20260714000002_notifications_push_webhook.sql
-- and 20260715000001_notify_post_likes_comments.sql — inserting into
-- notifications is enough, trg_push_notification fires on any insert).
--
-- RLS deliberately checks trip ownership OR accepted membership directly,
-- rather than assuming the (separately tracked, not-yet-fixed) creator-
-- membership gap has been resolved — a safety feature must not silently
-- depend on an unrelated bug being fixed elsewhere.
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip creator or accepted member can raise SOS"
ON public.sos_alerts
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = sos_alerts.trip_id AND trips.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = sos_alerts.trip_id AND trip_members.user_id = auth.uid() AND trip_members.status = 'accepted')
  )
);

CREATE POLICY "Trip creator or accepted member can view SOS alerts"
ON public.sos_alerts
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.trips WHERE trips.id = sos_alerts.trip_id AND trips.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = sos_alerts.trip_id AND trip_members.user_id = auth.uid() AND trip_members.status = 'accepted')
);

ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'trip_invite','homestay_approved','guide_approved','booking','booking_cancelled',
    'community_join_request','community_approved','community_rejected',
    'like','comment','follow','sos_alert','other'
  ]));

CREATE OR REPLACE FUNCTION public.notify_sos_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_name TEXT;
  v_trip_title TEXT;
  v_recipient RECORD;
BEGIN
  SELECT full_name INTO v_sender_name FROM public.users WHERE id = NEW.user_id;
  SELECT title INTO v_trip_title FROM public.trips WHERE id = NEW.trip_id;

  FOR v_recipient IN
    SELECT created_by AS recipient_id FROM public.trips WHERE id = NEW.trip_id
    UNION
    SELECT user_id AS recipient_id FROM public.trip_members WHERE trip_id = NEW.trip_id AND status = 'accepted'
  LOOP
    IF v_recipient.recipient_id IS NULL OR v_recipient.recipient_id = NEW.user_id THEN
      CONTINUE; -- skip the sender and any null (defensive, shouldn't occur)
    END IF;

    INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id, metadata)
    VALUES (
      v_recipient.recipient_id,
      NEW.user_id,
      'sos_alert',
      '🆘 SOS from ' || COALESCE(v_sender_name, 'a trip member'),
      COALESCE(v_sender_name, 'Someone') || ' triggered an SOS alert on "' || COALESCE(v_trip_title, 'your trip') || '". Tap to view their location.',
      NEW.trip_id,
      jsonb_build_object('trip_id', NEW.trip_id, 'sos_alert_id', NEW.id, 'lat', NEW.latitude, 'lng', NEW.longitude)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sos_alert ON public.sos_alerts;
CREATE TRIGGER trg_notify_sos_alert
  AFTER INSERT ON public.sos_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_sos_alert();
