-- Rental vehicles currently have no inquiry/booking record at all — hire/[id].tsx's
-- VehicleHireScreen only opens a WhatsApp deep link with zero persistence. This table
-- mirrors guide_inquiries' shape so vehicle inquiries get the same "soft" overlap-warning
-- treatment as guide inquiries, consistent with the WhatsApp-first manual-mediation model.
CREATE TABLE IF NOT EXISTS public.rental_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES public.rental_vehicles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  message text,
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rental_inquiries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rental_inquiries' AND policyname = 'Users can submit rental inquiries') THEN
    CREATE POLICY "Users can submit rental inquiries"
      ON public.rental_inquiries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rental_inquiries' AND policyname = 'Users can view own rental inquiries') THEN
    CREATE POLICY "Users can view own rental inquiries"
      ON public.rental_inquiries FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rental_inquiries' AND policyname = 'Owners can view inquiries for own vehicles') THEN
    CREATE POLICY "Owners can view inquiries for own vehicles"
      ON public.rental_inquiries FOR SELECT
      USING (vehicle_id IN (SELECT id FROM public.rental_vehicles WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- Note: no "anyone can SELECT" policy here on purpose — cross-user overlap checks for
-- date conflicts go through the SECURITY DEFINER check_rental_inquiry_overlap() function
-- (see 20260709000004_booking_overlap_functions.sql), which returns only a boolean rather
-- than widening table-level read access to other users' contact info/messages.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rental_inquiries' AND policyname = 'Admin full access to rental_inquiries') THEN
    CREATE POLICY "Admin full access to rental_inquiries"
      ON public.rental_inquiries FOR ALL
      USING (auth.uid() IN (SELECT id FROM auth.users WHERE email = 'ntrjwebdev@gmail.com'));
  END IF;
END $$;
