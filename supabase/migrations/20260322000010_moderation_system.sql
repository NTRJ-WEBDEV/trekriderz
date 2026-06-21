-- WandR AI Moderation and Safety System
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected'));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Create Moderation Logs for Admins
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  resource_type TEXT NOT NULL, -- 'post', 'comment', 'chat'
  resource_id UUID NOT NULL,
  violation_type TEXT NOT NULL, -- 'nudity', 'vulgarity', 'harassment', 'off_topic'
  severity TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: Only admins can view moderation logs
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view moderation logs" ON public.moderation_logs TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Automated Trigger to Block Banned Users from Posting
CREATE OR REPLACE FUNCTION block_banned_users()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_banned = true) THEN
    RAISE EXCEPTION 'Your account is temporarily suspended pending admin review.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_post_check_ban
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION block_banned_users();

CREATE TRIGGER on_comment_check_ban
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION block_banned_users();
