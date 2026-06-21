-- Storage RLS policies for all buckets
-- Run this in Supabase SQL Editor

-- =====================
-- AVATARS bucket
-- =====================
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================
-- POSTS bucket
-- =====================
CREATE POLICY "posts_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'posts');

CREATE POLICY "posts_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'posts');

CREATE POLICY "posts_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'posts');

CREATE POLICY "posts_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================
-- GUIDES bucket
-- =====================
CREATE POLICY "guides_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'guides');

CREATE POLICY "guides_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'guides');

CREATE POLICY "guides_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'guides');

CREATE POLICY "guides_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'guides' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================
-- HOMESTAYS bucket
-- =====================
CREATE POLICY "homestays_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'homestays');

CREATE POLICY "homestays_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'homestays');

CREATE POLICY "homestays_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'homestays');

CREATE POLICY "homestays_auth_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'homestays' AND auth.uid()::text = (storage.foldername(name))[1]);
