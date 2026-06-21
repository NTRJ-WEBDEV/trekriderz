-- Add metadata JSONB to notifications for more flexible data storage
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for related_id
CREATE INDEX IF NOT EXISTS idx_notifications_related_id ON public.notifications(related_id);
