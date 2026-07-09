-- property_inquiries.status currently has no CHECK constraint at all (any string is legal).
-- Confirmed via code audit: only 'new' (insert default, homestay/[id].tsx) and 'confirmed'
-- (host/manage.tsx markInquiryStatus) are ever written. 'reviewed' and 'cancelled' are added
-- here for parity with guide_inquiries' status set and to allow a future decline action
-- without another migration.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_inquiries_status_check'
  ) THEN
    ALTER TABLE public.property_inquiries
      ADD CONSTRAINT property_inquiries_status_check
      CHECK (status IN ('new', 'reviewed', 'confirmed', 'cancelled'));
  END IF;
END $$;
