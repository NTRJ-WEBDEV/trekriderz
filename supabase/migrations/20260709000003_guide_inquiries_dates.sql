-- guide_inquiries.trip_dates is free text (e.g. "2026-08-01 to 2026-08-05"), which makes
-- a reliable date-range overlap query impossible. Add real DATE columns alongside it for
-- the overlap check to use; trip_dates is kept as-is (still populated) since it's used
-- for display elsewhere and isn't worth a wider text-parsing migration right now.
ALTER TABLE public.guide_inquiries ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.guide_inquiries ADD COLUMN IF NOT EXISTS end_date date;
