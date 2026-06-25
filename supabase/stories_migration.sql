-- Stories Feature
-- Run in Supabase SQL Editor

-- Add title column to posts (for blog-style story headlines)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Storage policies for stories bucket (reuse posts bucket)
-- posts bucket policies already exist from previous migration
-- No additional SQL needed for storage

-- Index for fast story queries
CREATE INDEX IF NOT EXISTS idx_posts_trip_story
  ON public.posts (post_type, created_at DESC)
  WHERE post_type = 'trip_story' AND visibility = 'public';
