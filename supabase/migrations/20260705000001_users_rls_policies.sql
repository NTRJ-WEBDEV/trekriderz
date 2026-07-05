-- public.users has RLS enabled (via dashboard) but was never given any policies,
-- which silently blocks ALL reads — including the embedded `users(full_name, avatar_url)`
-- joins that posts/stories/comments rely on to show author names, and the
-- `(SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'` subqueries used
-- by admin-gated RLS policies on other tables. This is why every author name in the
-- app renders as "Anonymous"/"Traveler"/"Rider" instead of the real full_name.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
