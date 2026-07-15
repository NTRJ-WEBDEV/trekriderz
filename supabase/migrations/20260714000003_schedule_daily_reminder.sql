-- Daily re-engagement push, 6:00 PM IST (Postgres cron runs in UTC on
-- Supabase; 18:00 IST = 12:30 UTC). All the querying/sending logic lives in
-- the send-daily-reminder Edge Function — this job is just the trigger.
-- Same shared-secret pattern as the notifications webhook trigger.
SELECT cron.schedule(
  'daily-reminder-push',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://shbgdegfudoemwlkesxd.supabase.co/functions/v1/send-daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-function-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
