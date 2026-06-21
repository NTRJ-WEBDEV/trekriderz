-- Add push_token column to users for mobile notifications
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Create a helper to record notifications from app triggers
-- (Wait, the edge function will handle the sending)
