-- Two fixes to the private-account follow flow:
--
-- 1. Re-follow-after-decline: a 'rejected' row occupies the
--    UNIQUE(follower_id, following_id) slot, so a plain insert on re-follow
--    conflicts. The app now upserts on that conflict, which requires the
--    follower to be able to UPDATE their own row (previously only the
--    followee could, via follows_update, for accept/reject).
--
-- 2. Security gap: follows_insert only checked follower_id = auth.uid(),
--    with no constraint on the status value — a client could insert
--    status:'accepted' directly against a private account and skip
--    approval entirely. Both the insert policy and the new follower-update
--    policy now enforce: 'accepted' is only allowed when the target is not
--    private; private targets can only ever get 'pending'.

-- "Users can follow others" / "Users can unfollow" are untracked duplicates of
-- follows_insert/follows_delete that predate this repo's migration history
-- (created ad hoc, never captured in git). Postgres OR-combines permissive
-- policies for the same command, so "Users can follow others" — which has no
-- status restriction — would silently defeat the WITH CHECK below if left in
-- place alongside it.
DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;

DROP POLICY IF EXISTS "follows_insert" ON public.user_follows;
CREATE POLICY "follows_insert" ON public.user_follows
  FOR INSERT TO authenticated
  WITH CHECK (
    follower_id = auth.uid()
    AND (
      status = 'pending'
      OR (
        status = 'accepted'
        AND NOT EXISTS (
          SELECT 1 FROM public.users WHERE id = following_id AND is_private = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "follows_follower_update" ON public.user_follows;
CREATE POLICY "follows_follower_update" ON public.user_follows
  FOR UPDATE TO authenticated
  USING (follower_id = auth.uid())
  WITH CHECK (
    follower_id = auth.uid()
    AND (
      status = 'pending'
      OR (
        status = 'accepted'
        AND NOT EXISTS (
          SELECT 1 FROM public.users WHERE id = following_id AND is_private = true
        )
      )
    )
  );
