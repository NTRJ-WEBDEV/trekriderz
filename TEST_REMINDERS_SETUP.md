# Test Reminder Setup Instructions

## Quick Start - Send Notification NOW

Go to your Supabase project → SQL Editor and run this to send reminders immediately:

```sql
-- STEP 1: Send test reminders NOW to all testers
INSERT INTO public.notifications (user_id, type, title, message, data, read)
SELECT 
  u.id,
  'test_reminder' as type,
  '🏔️ Test TrekRiderz Now!' as title,
  '🏔️ Help us test TrekRiderz! Your feedback is crucial for our Play Store launch. Test the app now and share what you think!' as message,
  jsonb_build_object(
    'reminder_type', 'test_reminder',
    'sent_at', NOW()::text,
    'priority', 'high'
  ) as data,
  false as read
FROM public.users u
WHERE u.push_token IS NOT NULL;
```

---

## Automatic Daily Reminders (Next 30 Days)

Run these in order:

### Step 1: Enable pg_cron
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Create the reminder function
```sql
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
    AND u.role != 'admin';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count, v_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.send_scheduled_test_reminders() TO authenticated, service_role;
```

### Step 3: Schedule daily reminders (12:30 PM & 7:30 PM IST)
```sql
-- Lunch reminder: 12:30 PM every day
SELECT cron.schedule(
  'test-reminder-lunch',
  '30 12 * * *',
  'SELECT public.send_scheduled_test_reminders();'
);

-- Dinner reminder: 7:30 PM every day
SELECT cron.schedule(
  'test-reminder-dinner',
  '30 19 * * *',
  'SELECT public.send_scheduled_test_reminders();'
);
```

### Step 4: Verify scheduling
```sql
-- Check active cron jobs
SELECT * FROM cron.job WHERE jobname LIKE 'test-reminder%';
```

---

## Auto-Stop After 30 Days

Add these scheduled removals to automatically stop reminders after 30 days:

```sql
-- Stop lunch reminder after 30 days (August 18, 2026)
SELECT cron.schedule(
  'stop-lunch-reminder',
  '0 0 18 8 *',  -- August 18 at 12:00 AM
  'SELECT cron.unschedule(''test-reminder-lunch'');'
);

-- Stop dinner reminder after 30 days
SELECT cron.schedule(
  'stop-dinner-reminder',
  '0 0 18 8 *',
  'SELECT cron.unschedule(''test-reminder-dinner'');'
);
```

---

## Monitor Notifications Sent

Check recent reminders:
```sql
SELECT 
  created_at,
  type,
  title,
  message,
  COUNT(*) as count
FROM public.notifications
WHERE type LIKE '%reminder%'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY created_at, type, title, message
ORDER BY created_at DESC;
```

---

## How Push Notifications Work

1. **Database Record**: Notification inserted into `notifications` table
2. **Realtime Trigger**: Supabase Realtime sends to connected clients (in-app)
3. **Push Token**: If user has `push_token`, mobile app receives remote notification via Expo
4. **Deep Linking**: Tap notification → opens app to Notifications screen

---

## Expected Behavior

✅ Lunch (12:00 PM - 2:00 PM IST): "Lunch Break" message  
✅ Dinner (7:00 PM - 9:00 PM IST): "Dinner Time" message  
✅ Other times: "Adventure Awaits" message  
✅ Only sent to users with active `push_token`  
✅ Automatic stop after 30 days  

---

## Troubleshooting

**Notifications not appearing?**
- Check: `SELECT push_token FROM users WHERE id = '<user_id>';`
- Verify: Supabase Realtime is connected in app
- Rebuild: Run `npm run android` to refresh push token registration

**Cron job not running?**
- Check: `SELECT * FROM cron.job;` (verify job exists)
- Logs: `SELECT * FROM cron.job_run_details;` (last 10 runs)
- Restart: `SELECT cron.unschedule('test-reminder-lunch'); -- then reschedule`
