-- Fix: Add missing public SELECT policy on guided_expeditions
-- Without this, all SELECT queries on the table fail (RLS enabled, no policy = deny all)
-- Run in Supabase SQL Editor

-- guided_expeditions: public can browse published/full/ongoing/completed expeditions
DROP POLICY IF EXISTS "Public can view active expeditions" ON public.guided_expeditions;
CREATE POLICY "Public can view active expeditions" ON public.guided_expeditions
  FOR SELECT USING (
    status IN ('published', 'full', 'ongoing', 'completed')
  );

-- guides: public can view approved guide profiles (needed for the JOIN)
DROP POLICY IF EXISTS "Public can view approved guides" ON public.guides;
CREATE POLICY "Public can view approved guides" ON public.guides
  FOR SELECT USING (
    status = 'approved'
  );

-- Make sure RLS is enabled on both tables
ALTER TABLE public.guided_expeditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
