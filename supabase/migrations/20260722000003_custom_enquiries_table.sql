-- ============================================================
-- Missing table: public.custom_enquiries
-- ============================================================
-- Same pattern as `enquiries` (20260722000001): web/app/plan/page.tsx
-- (the 4-step custom trip planner) and web/app/admin/enquiries/page.tsx
-- have both referenced `public.custom_enquiries` since they were written,
-- but the table was never migrated — confirmed live via PGRST205 "table
-- not found." The planner's insert error isn't checked before continuing
-- to the trip-matching step, so every submission has appeared to succeed
-- to the user while saving nothing. Shape matches exactly what
-- plan/page.tsx inserts and admin/enquiries/page.tsx reads/exports.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.custom_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_range TEXT,
  destination_type TEXT,
  countries TEXT[],
  fitness_level TEXT,
  group_size INTEGER,
  duration TEXT,
  preferred_month TEXT,
  name TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.custom_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Custom enquiries: public insert" ON public.custom_enquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Custom enquiries: staff read" ON public.custom_enquiries FOR SELECT TO authenticated USING (public.has_permission('trips.view'));
CREATE POLICY "Custom enquiries: staff update" ON public.custom_enquiries FOR UPDATE TO authenticated USING (public.has_permission('trips.view'));

-- In case the enquiries INSERT policy from 20260722000001/000002 is still
-- not taking effect after a schema-cache reload, force a reload here too
-- so this table's policies are picked up immediately rather than needing
-- a second manual reload.
NOTIFY pgrst, 'reload schema';
