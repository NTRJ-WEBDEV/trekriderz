-- Lightweight daily-activity tracking, used to identify the most active
-- testers for a giveaway. One row per user per calendar day (upserted on
-- app open), not a full event log.

CREATE TABLE IF NOT EXISTS public.user_daily_activity (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_activity_user ON public.user_daily_activity (user_id);
CREATE INDEX IF NOT EXISTS idx_user_daily_activity_date ON public.user_daily_activity (activity_date);

ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own rows (upsert from authStore.init() on app open).
CREATE POLICY "Users can insert own activity"
  ON public.user_daily_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Same auth.users-in-policy landmine noted elsewhere in this project
-- (20260706000002_fix_pois_admin_policy.sql, 20260709000005_fix_properties_admin_policy.sql):
-- query public.users, not auth.users, for the admin check.
CREATE POLICY "Admin can read all activity"
  ON public.user_daily_activity FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));
