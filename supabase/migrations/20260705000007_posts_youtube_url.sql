-- Add youtube_url column referenced by mobile post creation (app/post/create.tsx, app/create-post.tsx)
-- and rendered by PostCard/SocialPost via YouTubePlayer. Missing column was causing
-- "PGRST204: Could not find the 'youtube_url' column" errors on post creation.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS youtube_url text;
