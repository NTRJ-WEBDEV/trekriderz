-- Same auth.users-in-policy landmine already fixed for storage.objects
-- (20260705000003_fix_guide_documents_admin_policy.sql) and pois
-- (20260706000002_fix_pois_admin_policy.sql), and explicitly flagged as
-- "still live (unfixed) on public.properties" in that second migration's
-- comment — this finally closes that out.
--
-- "Admin full access ..." policies on properties/room_types/property_inquiries
-- queried auth.users, a table the anon/authenticated roles have no SELECT
-- grant on. Postgres RLS evaluates every applicable policy on a query
-- (they're OR-combined), so even a request that should be satisfied by the
-- simple "status = 'approved'" policy alone still has to evaluate this one
-- too — and that evaluation itself fails outright with "permission denied
-- for table users", breaking the public property fetch (and, in turn, the
-- guest enquiry insert on the same connection) entirely. Discovered while
-- live-testing Stage 2's homestay overlap check: homestay/[id].tsx could not
-- load ANY property, confirming property_inquiries has likely never received
-- a real insert from the live app (consistent with its 0 rows in Stage 1).
DROP POLICY IF EXISTS "Admin full access properties" ON public.properties;
CREATE POLICY "Admin full access properties"
  ON public.properties FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));

DROP POLICY IF EXISTS "Admin full access room types" ON public.room_types;
CREATE POLICY "Admin full access room types"
  ON public.room_types FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));

DROP POLICY IF EXISTS "Admin full access property inquiries" ON public.property_inquiries;
CREATE POLICY "Admin full access property inquiries"
  ON public.property_inquiries FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));

-- Same landmine found on guide_inquiries (pre-existing) and rental_inquiries
-- (introduced earlier in this same Stage 2 migration batch by copying
-- guide_inquiries' policy shape verbatim, including the bug) while auditing
-- every RLS policy in the project for this pattern.
DROP POLICY IF EXISTS "Admin full access to guide_inquiries" ON public.guide_inquiries;
CREATE POLICY "Admin full access to guide_inquiries"
  ON public.guide_inquiries FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));

DROP POLICY IF EXISTS "Admin full access to rental_inquiries" ON public.rental_inquiries;
CREATE POLICY "Admin full access to rental_inquiries"
  ON public.rental_inquiries FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));
