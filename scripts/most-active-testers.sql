-- Top testers by distinct days active, for the t-shirt/cap giveaway.
-- Run directly via the Supabase SQL editor or Management API.
SELECT
  uda.user_id,
  u.full_name,
  u.email,
  COUNT(DISTINCT uda.activity_date) AS days_active,
  MIN(uda.activity_date) AS first_seen,
  MAX(uda.activity_date) AS last_seen
FROM public.user_daily_activity uda
JOIN public.users u ON u.id = uda.user_id
GROUP BY uda.user_id, u.full_name, u.email
ORDER BY days_active DESC
LIMIT 12;
