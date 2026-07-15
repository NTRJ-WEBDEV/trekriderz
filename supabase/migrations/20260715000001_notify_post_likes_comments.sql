-- Post likes and comments had no notification path at all — the only
-- existing triggers on these tables maintain posts.likes_count/
-- comments_count, nothing else. Mirrors the notify_new_follow pattern:
-- skip self-actions, populate sender_id + metadata so the push tap
-- handler and any future post-detail screen have something to route on.
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner_id UUID;
  v_liker_name TEXT;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW; -- post not found, or liking your own post — nothing to notify
  END IF;

  SELECT full_name INTO v_liker_name FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id, metadata)
  VALUES (
    v_post_owner_id,
    NEW.user_id,
    'like',
    COALESCE(v_liker_name, 'Someone') || ' liked your post',
    'Tap to view your post.',
    NEW.post_id,
    jsonb_build_object('post_id', NEW.post_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_like ON public.post_likes;
CREATE TRIGGER trg_notify_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner_id UUID;
  v_commenter_name TEXT;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_commenter_name FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id, metadata)
  VALUES (
    v_post_owner_id,
    NEW.user_id,
    'comment',
    COALESCE(v_commenter_name, 'Someone') || ' commented on your post',
    LEFT(NEW.content, 100),
    NEW.post_id,
    jsonb_build_object('post_id', NEW.post_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_comment ON public.post_comments;
CREATE TRIGGER trg_notify_post_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();
