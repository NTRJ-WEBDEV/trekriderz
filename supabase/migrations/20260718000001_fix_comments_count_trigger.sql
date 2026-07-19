-- posts.comments_count has the same bug post_likes_trigger.sql already
-- fixed once for posts.likes_count: update_comments_count() was never
-- SECURITY DEFINER, so its internal `UPDATE posts SET comments_count = ...`
-- runs under the commenter's own RLS ("Users can update own posts" USING
-- user_id = auth.uid()) — meaning it silently updates 0 rows whenever the
-- commenter isn't the post's owner, which is the majority case in a social
-- feed. Confirmed live: a real post had comments_count = 0 with 1 actual
-- row in post_comments from a different user.
CREATE OR REPLACE FUNCTION public.update_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- One-time backfill: sync comments_count with actual post_comments rows,
-- excluding hidden comments the same way the app's own fetch does.
UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*) FROM public.post_comments c
  WHERE c.post_id = p.id AND COALESCE(c.is_hidden, false) = false
);
