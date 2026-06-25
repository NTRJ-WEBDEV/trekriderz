-- Fix: Add missing SELECT policies for expedition sub-tables
-- Without these, PostgREST blocks joins from guided_expeditions → expedition_packages
-- Run in Supabase SQL Editor

-- expedition_packages: anyone can view packages for published expeditions
DROP POLICY IF EXISTS "Anyone can view expedition packages" ON public.expedition_packages;
CREATE POLICY "Anyone can view expedition packages" ON public.expedition_packages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.guided_expeditions ge
      WHERE ge.id = expedition_packages.expedition_id
        AND ge.status IN ('published', 'full', 'ongoing', 'completed')
    )
  );

-- expedition_itinerary_days: same rule
DROP POLICY IF EXISTS "Anyone can view expedition itinerary" ON public.expedition_itinerary_days;
CREATE POLICY "Anyone can view expedition itinerary" ON public.expedition_itinerary_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.guided_expeditions ge
      WHERE ge.id = expedition_itinerary_days.expedition_id
        AND ge.status IN ('published', 'full', 'ongoing', 'completed')
    )
  );

-- expedition_waitlist: users can see their own waitlist entries
DROP POLICY IF EXISTS "Users can view own waitlist entries" ON public.expedition_waitlist;
CREATE POLICY "Users can view own waitlist entries" ON public.expedition_waitlist
  FOR SELECT USING (auth.uid() = user_id);

-- expedition_bookings: users can see their own bookings
DROP POLICY IF EXISTS "Users can view own expedition bookings" ON public.expedition_bookings;
CREATE POLICY "Users can view own expedition bookings" ON public.expedition_bookings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create expedition bookings" ON public.expedition_bookings;
CREATE POLICY "Users can create expedition bookings" ON public.expedition_bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can cancel own expedition bookings" ON public.expedition_bookings;
CREATE POLICY "Users can cancel own expedition bookings" ON public.expedition_bookings
  FOR UPDATE USING (auth.uid() = user_id);
