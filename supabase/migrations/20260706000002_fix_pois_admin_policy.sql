-- "Admin full access pois" queried auth.users, a table the anon/authenticated
-- roles have no SELECT grant on. Postgres RLS evaluates every applicable
-- policy on a SELECT (they're OR-combined), so even a request that should be
-- satisfied by the simple "status = 'approved'" policy alone still has to
-- evaluate this one too — and that evaluation itself fails outright with
-- "permission denied for table users", breaking the public POI fetch entirely.
-- This is the same landmine already fixed once in this project for
-- storage.objects (see 20260705000003_fix_guide_documents_admin_policy.sql)
-- and still live (unfixed) on public.properties — rewriting against
-- public.users, which authenticated/anon can read, fixes it here the same way.
DROP POLICY IF EXISTS "Admin full access pois" ON public.pois;

CREATE POLICY "Admin full access pois"
  ON public.pois FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com'
  ));
