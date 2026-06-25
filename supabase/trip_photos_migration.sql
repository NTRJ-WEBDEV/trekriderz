-- Trip Photos Feature
-- Run in Supabase SQL Editor

-- 1. Add photos column to trips table
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 2. Storage policies for trip-photos bucket
-- IMPORTANT: First create the bucket in Supabase Dashboard → Storage → New Bucket
-- Bucket name: trip-photos, Public: YES

DROP POLICY IF EXISTS "trip_photos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "trip_photos_auth_upload"   ON storage.objects;
DROP POLICY IF EXISTS "trip_photos_owner_delete"  ON storage.objects;

CREATE POLICY "trip_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'trip-photos');

CREATE POLICY "trip_photos_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trip-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "trip_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'trip-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Auto-cleanup function (deletes images for trips whose end_date was 30+ days ago)
CREATE OR REPLACE FUNCTION cleanup_expired_trip_photos()
RETURNS integer AS $$
DECLARE
  trip_record RECORD;
  photo_path  TEXT;
  deleted_count INTEGER := 0;
BEGIN
  FOR trip_record IN
    SELECT id, photos
    FROM public.trips
    WHERE end_date + INTERVAL '30 days' < CURRENT_DATE
      AND photos IS NOT NULL
      AND photos != '[]'::jsonb
      AND jsonb_array_length(photos) > 0
  LOOP
    -- Delete each photo object from storage
    FOR photo_path IN
      SELECT regexp_replace(
        jsonb_array_elements_text(trip_record.photos),
        '^.*/trip-photos/',
        ''
      )
    LOOP
      DELETE FROM storage.objects
      WHERE bucket_id = 'trip-photos'
        AND name = photo_path;
    END LOOP;

    -- Clear the photos array
    UPDATE public.trips
    SET photos = '[]'::jsonb,
        updated_at = NOW()
    WHERE id = trip_record.id;

    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Schedule cleanup daily at 2 AM with pg_cron
-- Enable pg_cron first: Supabase Dashboard → Database → Extensions → pg_cron
SELECT cron.schedule(
  'cleanup-trip-photos-daily',
  '0 2 * * *',
  'SELECT cleanup_expired_trip_photos()'
);
