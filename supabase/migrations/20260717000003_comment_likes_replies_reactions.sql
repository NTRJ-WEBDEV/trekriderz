-- Comment system: likes, one-level-deep replies, and emoji reactions.
--
-- post_comments.parent_comment_id and .likes_count already exist live —
-- added directly via the SQL Editor at some point, never captured in a
-- migration. ADD COLUMN IF NOT EXISTS silently no-ops on a column that
-- already exists; it verifies nothing about its existing constraints. Since
-- their current live state is otherwise unknown, every property below is
-- made explicit (check-then-add) rather than assumed already correct.

ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_comment_id uuid;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS likes_count integer;

ALTER TABLE public.post_comments ALTER COLUMN likes_count SET DEFAULT 0;
UPDATE public.post_comments SET likes_count = 0 WHERE likes_count IS NULL;
ALTER TABLE public.post_comments ALTER COLUMN likes_count SET NOT NULL;

-- Add the FK only if no constraint already covers this column — checked by
-- column, not a guessed constraint name, since a pre-existing FK (if any)
-- could have been named anything by whoever added it outside migrations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'post_comments' AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'parent_comment_id'
  ) THEN
    ALTER TABLE public.post_comments
      ADD CONSTRAINT post_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id ON public.post_comments(parent_comment_id);

-- ============================================================
-- One-level-deep reply enforcement
-- ============================================================
-- Rejects a reply-to-a-reply at the DB layer, not just in the UI — a
-- comment can only be a reply target if it is itself top-level.
CREATE OR REPLACE FUNCTION public.enforce_comment_reply_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_grandparent_id uuid;
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT parent_comment_id INTO v_grandparent_id
    FROM public.post_comments WHERE id = NEW.parent_comment_id;

    IF v_grandparent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a reply — comments support only one level of nesting.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_comment_reply_depth ON public.post_comments;
CREATE TRIGGER trg_enforce_comment_reply_depth
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_reply_depth();

-- ============================================================
-- Comment likes — mirrors post_likes' RLS/trigger shape exactly
-- ============================================================
CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comment likes" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like comments" ON public.comment_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike comments" ON public.comment_likes
  FOR DELETE USING (user_id = auth.uid());

-- SECURITY DEFINER from the start. posts.likes_count's original trigger
-- (update_likes_count) lacked this and silently failed to update likes_count
-- whenever the liker wasn't the post's own owner, since the inner UPDATE on
-- posts was then evaluated under the caller's RLS ("Users can update own
-- posts" USING user_id = auth.uid()) — fixed later in post_likes_trigger.sql.
-- post_comments.comments_count (update_comments_count) still has this same
-- unfixed bug today. Not repeating it here.
CREATE OR REPLACE FUNCTION public.sync_comment_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.post_comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.post_comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comment_likes ON public.comment_likes;
CREATE TRIGGER trg_sync_comment_likes
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_comment_likes_count();

-- ============================================================
-- Comment emoji reactions — one reaction per user per comment (WhatsApp
-- model: picking a new emoji replaces your existing reaction, rather than
-- stacking multiple reactions from the same person on one comment).
-- ============================================================
CREATE TABLE public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  emoji text NOT NULL CHECK (char_length(emoji) <= 8),
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comment reactions" ON public.comment_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can react to comments" ON public.comment_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can change their reaction" ON public.comment_reactions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their reaction" ON public.comment_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Reply notifications — notify the parent comment's author, not just the
-- post owner. Rewritten rather than patched: the original function's early
-- return (skip everything when the commenter IS the post owner) would have
-- also skipped notifying a reply target whenever the post owner is the one
-- replying to someone else's comment on their own post. The two notify
-- branches below are independent for exactly that reason.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_owner_id UUID;
  v_parent_author_id UUID;
  v_commenter_name TEXT;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
  SELECT full_name INTO v_commenter_name FROM public.users WHERE id = NEW.user_id;

  IF v_post_owner_id IS NOT NULL AND v_post_owner_id != NEW.user_id THEN
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
  END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author_id FROM public.post_comments WHERE id = NEW.parent_comment_id;

    IF v_parent_author_id IS NOT NULL
       AND v_parent_author_id != NEW.user_id
       AND v_parent_author_id != v_post_owner_id THEN
      INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id, metadata)
      VALUES (
        v_parent_author_id,
        NEW.user_id,
        'comment_reply',
        COALESCE(v_commenter_name, 'Someone') || ' replied to your comment',
        LEFT(NEW.content, 100),
        NEW.post_id,
        jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.parent_comment_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
