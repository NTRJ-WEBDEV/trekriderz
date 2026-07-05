-- "Admin can read all guide documents" queried auth.users, a table the
-- authenticated/anon roles have no SELECT grant on. Since every upload in the
-- app goes through uploadMedia() with upsert: true, and an upsert requires
-- Postgres to evaluate ALL SELECT policies on storage.objects (not just ones
-- matching the target bucket) to check for a conflicting row, this one bad
-- policy broke every upload to every bucket with "permission denied for table
-- users" — not just guide-documents. Rewriting it against public.users (which
-- authenticated can now read, per 20260705000001_users_rls_policies.sql)
-- fixes uploads app-wide.
DROP POLICY IF EXISTS "Admin can read all guide documents" ON storage.objects;

CREATE POLICY "Admin can read all guide documents" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'guide-documents'
    AND auth.uid() IN (SELECT id FROM public.users WHERE email = 'ntrjwebdev@gmail.com')
  );
