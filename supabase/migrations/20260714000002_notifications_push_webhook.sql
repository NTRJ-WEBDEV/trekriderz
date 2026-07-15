-- Mirrors every new notifications row to a push notification, via the
-- deployed send-notification Edge Function. This requires zero changes to
-- the 5 existing trigger functions that already INSERT INTO notifications
-- (notify_new_follow, notify_booking_status_change, notify_guide_new_joiner,
-- notify_traveler_booking_confirmed, notify_owner_new_booking) — they keep
-- writing plain notification rows exactly as before; this trigger just also
-- fires on the same INSERT.
--
-- The function is deployed with verify_jwt=false (Postgres/pg_net can't
-- present a user JWT), so it's guarded by a shared secret instead — stored
-- once in Vault as 'edge_function_secret', never as a literal in this file.
--
-- pg_net was not actually installed on this project (a leftover
-- grant_pg_net_access helper function had been mistaken for evidence it
-- was) — confirmed live when the first trigger attempt failed with
-- "schema net does not exist". Installing it is a prerequisite here.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'edge_function_secret';

  PERFORM net.http_post(
    url := 'https://shbgdegfudoemwlkesxd.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-function-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_notification ON public.notifications;
CREATE TRIGGER trg_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_push_notification();
