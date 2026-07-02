-- User follow system

-- Create table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS public.user_follows (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

-- Add status column if it's missing (handles the case where table was created without it)
ALTER TABLE public.user_follows
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_user_follows_follower  ON public.user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows (following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_read"   ON public.user_follows;
DROP POLICY IF EXISTS "follows_insert" ON public.user_follows;
DROP POLICY IF EXISTS "follows_delete" ON public.user_follows;
DROP POLICY IF EXISTS "follows_update" ON public.user_follows;

-- Anyone can read accepted follows; parties can see their own pending ones
CREATE POLICY "follows_read" ON public.user_follows
  FOR SELECT TO authenticated
  USING (status = 'accepted' OR follower_id = auth.uid() OR following_id = auth.uid());

-- You can follow others
CREATE POLICY "follows_insert" ON public.user_follows
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());

-- You can unfollow (delete your own follow row)
CREATE POLICY "follows_delete" ON public.user_follows
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- The followed user can accept/reject pending follow requests
CREATE POLICY "follows_update" ON public.user_follows
  FOR UPDATE TO authenticated
  USING (following_id = auth.uid())
  WITH CHECK (following_id = auth.uid());

-- Notification trigger: fire when someone follows you
CREATE OR REPLACE FUNCTION notify_new_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT full_name INTO follower_name FROM public.users WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.following_id,
    'follow',
    COALESCE(follower_name, 'Someone') || ' started following you',
    'Tap to view their profile.',
    NEW.follower_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.user_follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION notify_new_follow();
