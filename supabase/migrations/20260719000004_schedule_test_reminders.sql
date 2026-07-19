-- Schedule daily test reminders at lunch and dinner time
-- This creates a function and cron jobs to send reminders automatically

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to send test reminders
CREATE OR REPLACE FUNCTION public.send_scheduled_test_reminders()
RETURNS TABLE(sent_count bigint, reminder_type text) AS $$
DECLARE
  v_type text;
  v_title text;
  v_message text;
  v_hours int;
  v_count bigint;
BEGIN
  -- Determine message based on current time (IST timezone)
  v_hours := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Kolkata');
  
  IF v_hours >= 12 AND v_hours < 14 THEN
    v_type := 'lunch_reminder';
    v_title := '🍽️ Lunch Break - Test TrekRiderz!';
    v_message := 'Hey explorer! 🍽️ It''s lunch time! Take a few minutes to test TrekRiderz and help us crush our launch goals!';
  ELSIF v_hours >= 19 AND v_hours < 21 THEN
    v_type := 'dinner_reminder';
    v_title := '🍽️ Dinner Time - Test TrekRiderz!';
    v_message := 'Hey trekker! 🍽️ Dinner time is here. Test a new feature in TrekRiderz and share your feedback with us!';
  ELSE
    v_type := 'general_reminder';
    v_title := '🏔️ Adventure Awaits - Test TrekRiderz!';
    v_message := '🏔️ Time to explore! Test TrekRiderz and help us create India''s best trekking platform!';
  END IF;

  -- Insert notifications for all users with push tokens
  INSERT INTO public.notifications (user_id, type, title, message, data, read)
  SELECT 
    u.id,
    v_type,
    v_title,
    v_message,
    jsonb_build_object(
      'reminder_type', v_type,
      'sent_at', NOW()::text,
      'batch_id', gen_random_uuid()::text
    ),
    false
  FROM public.users u
  WHERE u.push_token IS NOT NULL
    AND u.role != 'admin'  -- Exclude admins
    AND u.created_at < NOW() - INTERVAL '1 day';  -- Only confirmed users
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count, v_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_scheduled_test_reminders() TO authenticated, service_role;

-- Schedule cron jobs for lunch and dinner reminders
-- Lunch time: 12:30 PM IST (every day)
SELECT cron.schedule(
  'test-reminder-lunch',
  '30 12 * * *',  -- 12:30 PM IST (cron is UTC, IST is UTC+5:30, but cron runs on server time)
  'SELECT public.send_scheduled_test_reminders();'
);

-- Dinner time: 7:30 PM IST (every day)
SELECT cron.schedule(
  'test-reminder-dinner',
  '30 19 * * *',  -- 7:30 PM IST
  'SELECT public.send_scheduled_test_reminders();'
);

-- List scheduled jobs to verify
SELECT * FROM cron.job WHERE jobname LIKE 'test-reminder%';
