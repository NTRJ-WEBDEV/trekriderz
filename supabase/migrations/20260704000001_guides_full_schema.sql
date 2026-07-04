-- Full guide registration schema: new columns + guide_inquiries table

-- Add new columns to existing guides table (keep old ones for backward compat)
ALTER TABLE public.guides
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS locations jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS experience text,
  ADD COLUMN IF NOT EXISTS identity_doc_type text
    CHECK (identity_doc_type IN ('aadhaar', 'voter_id', 'driving_licence') OR identity_doc_type IS NULL),
  ADD COLUMN IF NOT EXISTS identity_doc_front_url text,
  ADD COLUMN IF NOT EXISTS identity_doc_back_url text,
  ADD COLUMN IF NOT EXISTS certificates jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill full_name from name where not set
UPDATE public.guides SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Guide inquiries: users request a guide (TrekRiderz team mediates)
CREATE TABLE IF NOT EXISTS public.guide_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guide_id uuid REFERENCES public.guides(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_dates text,
  location text,
  group_size integer DEFAULT 1,
  specialization_needed text,
  message text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.guide_inquiries ENABLE ROW LEVEL SECURITY;

-- Users can submit and view their own inquiries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guide_inquiries' AND policyname = 'Users can submit guide inquiries') THEN
    CREATE POLICY "Users can submit guide inquiries"
      ON public.guide_inquiries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guide_inquiries' AND policyname = 'Users can view own inquiries') THEN
    CREATE POLICY "Users can view own inquiries"
      ON public.guide_inquiries FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Guides can view inquiries directed at them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guide_inquiries' AND policyname = 'Guides can view own inquiries') THEN
    CREATE POLICY "Guides can view own inquiries"
      ON public.guide_inquiries FOR SELECT
      USING (guide_id IN (SELECT id FROM public.guides WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Admin full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guide_inquiries' AND policyname = 'Admin full access to guide_inquiries') THEN
    CREATE POLICY "Admin full access to guide_inquiries"
      ON public.guide_inquiries FOR ALL
      USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'ntrjwebdev@gmail.com'));
  END IF;
END $$;

-- Storage buckets: create via Supabase dashboard
-- 'guide-photos'    → public bucket
-- 'guide-documents' → private bucket (admin only)
