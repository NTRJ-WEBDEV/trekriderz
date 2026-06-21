-- Safer moderation: flag accounts for admin review instead of auto-banning

-- Add flag columns to users (softer than is_banned)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Ensure moderation_logs table exists with the right columns
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,  -- 'post', 'comment', 'chat'
  resource_id UUID,
  violation_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low', 'medium', 'high'
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for admin panel to quickly pull flagged users
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user
  ON public.moderation_logs (user_id, created_at DESC);

-- RLS: users can't read moderation logs; admins can
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderation logs"
  ON public.moderation_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow the app (service context) to insert logs
CREATE POLICY "App can insert moderation logs"
  ON public.moderation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to read their own violation count (so the strike system works)
CREATE POLICY "Users can read own logs"
  ON public.moderation_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
