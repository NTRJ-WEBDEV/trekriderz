-- Add youtube_url to posts for content creators to share videos
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS youtube_url TEXT;
