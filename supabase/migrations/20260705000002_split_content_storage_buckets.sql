-- Feed posts, 24hr stories, and travel stories were all uploading into the
-- shared 'posts' bucket. Split them into dedicated buckets so each content
-- type's storage can be moderated/cleaned up independently (e.g. 24hr story
-- media can be purged on a schedule without touching feed post media).
-- Safe to re-run: bucket creation is ON CONFLICT DO NOTHING and policies are
-- dropped before being recreated.

INSERT INTO storage.buckets (id, name, public) VALUES ('feed-posts',    'feed-posts',    true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-stories',  'feed-stories',  true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('travel-stories','travel-stories',true) ON CONFLICT (id) DO NOTHING;

-- ─── feed-posts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feed_posts_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "feed_posts_auth_upload"   ON storage.objects;
DROP POLICY IF EXISTS "feed_posts_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "feed_posts_auth_delete"   ON storage.objects;

CREATE POLICY "feed_posts_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feed-posts');
CREATE POLICY "feed_posts_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-posts');
CREATE POLICY "feed_posts_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'feed-posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "feed_posts_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── feed-stories (24hr) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feed_stories_public_read" ON storage.objects;
DROP POLICY IF EXISTS "feed_stories_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "feed_stories_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "feed_stories_auth_delete" ON storage.objects;

CREATE POLICY "feed_stories_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feed-stories');
CREATE POLICY "feed_stories_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-stories');
CREATE POLICY "feed_stories_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'feed-stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "feed_stories_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─── travel-stories ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "travel_stories_public_read" ON storage.objects;
DROP POLICY IF EXISTS "travel_stories_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "travel_stories_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "travel_stories_auth_delete" ON storage.objects;

CREATE POLICY "travel_stories_public_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'travel-stories');
CREATE POLICY "travel_stories_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'travel-stories');
CREATE POLICY "travel_stories_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'travel-stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "travel_stories_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'travel-stories' AND auth.uid()::text = (storage.foldername(name))[1]);

-- The old 'posts' bucket and its policies (20260621000000_storage_policies.sql)
-- are left untouched — existing feed/story media already served from it keeps
-- working, new uploads just stop landing there.
