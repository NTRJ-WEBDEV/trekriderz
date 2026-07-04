-- Feed & Community additions: 24hr stories, post saves, generic content reports.
-- Purely additive — does NOT touch existing posts/communities/community_posts/post_reports schema,
-- which already power app/(tabs)/explore.tsx, app/stories/*, app/community/*, and the admin Reports tab.

-- ─── 24hr Stories ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stories_24h (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  caption text,
  duration_seconds integer NOT NULL DEFAULT 5,
  view_count integer NOT NULL DEFAULT 0,
  moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'flagged', 'removed', 'pending')),
  moderation_reason text,
  is_hidden boolean NOT NULL DEFAULT false,
  report_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stories_24h_active
  ON public.stories_24h (user_id, created_at DESC)
  WHERE is_hidden = false;

CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES public.stories_24h(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);

-- Keep stories_24h.view_count in sync (mirrors the existing post_likes_trigger.sql pattern)
CREATE OR REPLACE FUNCTION sync_story_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stories_24h SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_story_view_count ON public.story_views;
CREATE TRIGGER trg_sync_story_view_count
  AFTER INSERT ON public.story_views
  FOR EACH ROW EXECUTE FUNCTION sync_story_view_count();

-- Best-effort cleanup helper — call periodically (no pg_cron assumed to be enabled on this project)
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stories_24h WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.stories_24h ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stories_public_read" ON public.stories_24h;
DROP POLICY IF EXISTS "stories_insert_own" ON public.stories_24h;
DROP POLICY IF EXISTS "stories_update_own" ON public.stories_24h;
DROP POLICY IF EXISTS "stories_delete_own" ON public.stories_24h;
DROP POLICY IF EXISTS "stories_admin_manage" ON public.stories_24h;

CREATE POLICY "stories_public_read" ON public.stories_24h
  FOR SELECT TO authenticated
  USING (expires_at > now() AND is_hidden = false OR user_id = auth.uid());

CREATE POLICY "stories_insert_own" ON public.stories_24h
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_update_own" ON public.stories_24h
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "stories_delete_own" ON public.stories_24h
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "stories_admin_manage" ON public.stories_24h
  FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "story_views_insert_own" ON public.story_views;
DROP POLICY IF EXISTS "story_views_read" ON public.story_views;

-- Anyone can log a view; only the story owner (or the viewer themself) can read the view list
CREATE POLICY "story_views_insert_own" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "story_views_read" ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.stories_24h s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

-- ─── Post saves / bookmarks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_saves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_saves_own" ON public.post_saves;
CREATE POLICY "post_saves_own" ON public.post_saves
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Generic content reports (for the content types post_reports doesn't cover) ──
-- Posts keep using the existing public.post_reports table (already wired into the
-- admin Reports tab). This table covers 24hr stories and community posts.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('story', 'community_post')),
  content_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_pending
  ON public.content_reports (content_type, status);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_reports_insert" ON public.content_reports;
DROP POLICY IF EXISTS "content_reports_read" ON public.content_reports;
DROP POLICY IF EXISTS "content_reports_admin_update" ON public.content_reports;

CREATE POLICY "content_reports_insert" ON public.content_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "content_reports_read" ON public.content_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "content_reports_admin_update" ON public.content_reports
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Auto-hide content once it collects 3+ pending reports (mirrors post-report handling)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION sync_content_report_count()
RETURNS TRIGGER AS $$
DECLARE
  pending_count integer;
BEGIN
  SELECT COUNT(*) INTO pending_count
  FROM public.content_reports
  WHERE content_type = NEW.content_type AND content_id = NEW.content_id AND status = 'pending';

  IF NEW.content_type = 'story' THEN
    UPDATE public.stories_24h
    SET report_count = pending_count,
        is_hidden = (pending_count >= 3),
        moderation_status = CASE WHEN pending_count >= 3 THEN 'flagged' ELSE moderation_status END
    WHERE id = NEW.content_id;
  ELSIF NEW.content_type = 'community_post' THEN
    UPDATE public.community_posts
    SET report_count = pending_count,
        is_hidden = (pending_count >= 3)
    WHERE id = NEW.content_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_content_report_count ON public.content_reports;
CREATE TRIGGER trg_sync_content_report_count
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION sync_content_report_count();

-- Community posts should also stay hidden from normal reads once flagged
DROP POLICY IF EXISTS "community_posts_read" ON public.community_posts;
CREATE POLICY "community_posts_read" ON public.community_posts
  FOR SELECT TO authenticated
  USING (
    is_hidden = false
    OR user_id = auth.uid()
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );
