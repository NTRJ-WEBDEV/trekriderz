-- The push webhook trigger used `PERFORM net.http_post(...)`, discarding
-- the call's return value entirely. net.http_post is async by design —
-- pg_net queues the request and returns a request id immediately; the
-- actual response (status/body) lands later in net._http_response, keyed
-- by that same id. There was no way to trace a given notification row to
-- its eventual response at all.
--
-- This captures the request id and logs it alongside the notification's
-- context, so a failure can be looked up directly:
--   SELECT status_code, content FROM net._http_response WHERE id = <request_id>;
-- (content is the send-notification function's own JSON body, which as of
-- the accompanying edge-function fix now reports the real per-ticket
-- success/failure instead of a blanket {success: true}.)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'edge_function_secret';

  SELECT net.http_post(
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
  ) INTO v_request_id;

  RAISE LOG 'push notification webhook queued: request_id=%, notification_id=%, user_id=%, type=%',
    v_request_id, NEW.id, NEW.user_id, NEW.type;

  RETURN NEW;
END;
$$;
