-- 20260718000001 fixed update_comments_count()'s body (added SECURITY
-- DEFINER) but never verified a trigger actually calls it on post_comments
-- INSERT/DELETE — no migration anywhere creates that binding. Confirmed
-- live: post 09f30adf-a5f3-45fe-9045-19a58f845b52 has 2 real post_comments
-- rows (one inserted well after the prior "fix" shipped) but comments_count
-- is still 1 — proof the binding itself is missing, not just the function
-- body. DROP+CREATE (not CREATE OR REPLACE, triggers don't support that)
-- makes this idempotent no matter what ad-hoc state exists live.
DROP TRIGGER IF EXISTS trg_update_comments_count ON public.post_comments;
CREATE TRIGGER trg_update_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

-- Re-backfill: the prior migration's backfill only reflects state as of
-- 2026-07-18; anything commented since then while the trigger was still
-- unbound needs correcting too.
UPDATE public.posts p
SET comments_count = (
  SELECT COUNT(*) FROM public.post_comments c
  WHERE c.post_id = p.id AND COALESCE(c.is_hidden, false) = false
);
