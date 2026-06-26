-- Fix: keep posts.likes_count in sync with post_likes inserts/deletes
-- Without this, likes_count is only updated optimistically on the local device
-- and resets to the stale DB value on refresh for all other users.
-- Run in Supabase SQL Editor

-- Make sure posts.likes_count column exists and defaults to 0
ALTER TABLE public.posts
  ALTER COLUMN likes_count SET DEFAULT 0;

UPDATE public.posts SET likes_count = 0 WHERE likes_count IS NULL;

ALTER TABLE public.posts
  ALTER COLUMN likes_count SET NOT NULL;

-- Trigger function
CREATE OR REPLACE FUNCTION sync_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists, then create
DROP TRIGGER IF EXISTS trg_sync_post_likes ON public.post_likes;
CREATE TRIGGER trg_sync_post_likes
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION sync_post_likes_count();

-- One-time backfill: sync likes_count with actual post_likes rows
UPDATE public.posts p
SET likes_count = (
  SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = p.id
);
