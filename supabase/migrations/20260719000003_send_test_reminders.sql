-- Send test reminders to all testers NOW
-- This creates notification records for all users with push tokens

-- Insert reminders
INSERT INTO public.notifications (user_id, type, title, message, data, read)
SELECT 
  u.id,
  'test_reminder' as type,
  '🏔️ Test TrekRiderz' as title,
  '🏔️ Help us test TrekRiderz and provide feedback. Your testing is crucial for our launch!' as message,
  jsonb_build_object(
    'reminder_type', 'test_reminder',
    'sent_at', NOW()::text,
    'priority', 'high'
  ) as data,
  false as read
FROM public.users u
WHERE u.push_token IS NOT NULL
ON CONFLICT DO NOTHING;

-- Check how many were sent
SELECT COUNT(*) as notifications_created FROM public.notifications 
WHERE type = 'test_reminder' 
AND created_at > NOW() - INTERVAL '1 minute';
