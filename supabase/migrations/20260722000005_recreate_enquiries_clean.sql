-- ============================================================
-- Clean recreation of public.enquiries
-- ============================================================
-- Diagnostic history: SET ROLE anon; INSERT ...; against the original
-- table throws "new row violates row-level security policy" even with
-- a verified-correct WITH CHECK (true) INSERT policy, correct GRANTs,
-- no triggers, no FKs, no restrictive policies, no FORCE RLS. That
-- should be impossible — so this rules out accumulated state on the
-- original object (created, altered, and re-policied multiple times in
-- this session) by building a fresh table under the same name instead
-- of continuing to patch the existing one.
--
-- Run this migration first, THEN run the verification block below it
-- separately, THEN only run the final DROP if verification succeeds.
-- ============================================================

-- 1. Rename existing table out of the way
ALTER TABLE public.enquiries RENAME TO enquiries_old;

-- 2. Create a brand new table under the original name, same schema
CREATE TABLE public.enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID,
  trip_name TEXT,
  name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  group_size INTEGER,
  preferred_date TEXT,
  message TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- 4. Grants — matching the pattern other public-facing tables use:
-- anon can read/write its own submissions, authenticated (staff) gets
-- full CRUD, service_role gets everything (it bypasses RLS regardless).
GRANT SELECT, INSERT ON public.enquiries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiries TO authenticated;
GRANT ALL ON public.enquiries TO service_role;

-- 5. Only these three policies
CREATE POLICY "Public insert"
ON public.enquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Staff read"
ON public.enquiries
FOR SELECT
TO authenticated
USING (has_permission('trips.view'));

CREATE POLICY "Staff update"
ON public.enquiries
FOR UPDATE
TO authenticated
USING (has_permission('trips.view'));

-- 6. Copy existing data across (explicit column list — safer than
-- SELECT * against a rename in case column order ever drifts)
INSERT INTO public.enquiries (id, trip_id, trip_name, name, email, whatsapp, group_size, preferred_date, message, status, created_at)
SELECT id, trip_id, trip_name, name, email, whatsapp, group_size, preferred_date, message, status, created_at
FROM public.enquiries_old;

NOTIFY pgrst, 'reload schema';
