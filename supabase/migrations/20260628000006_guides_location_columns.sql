-- Add missing columns to guides table that the registration form uses
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8);
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8);
ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS specializations JSONB DEFAULT '[]'::jsonb;

-- Make contact_phone nullable so registration can succeed without a separate phone field
ALTER TABLE public.guides ALTER COLUMN contact_phone DROP NOT NULL;
