-- Location sharing for users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS last_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- Performance index for location updates
CREATE INDEX IF NOT EXISTS idx_users_location_update ON public.users(last_location_update);

-- Add real-time publication for users table (needed for location sharing)
-- Supabase automatically handles this if enabled in the dashboard, 
-- but we can explicitly add it to the 'realtime' publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add users to realtime publication: %', SQLERRM;
END $$;
