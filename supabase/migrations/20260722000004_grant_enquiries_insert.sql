-- ============================================================
-- Fix: anon/authenticated missing base INSERT grant
-- ============================================================
-- Two rounds of verification on `enquiries` and `custom_enquiries` both
-- showed: SELECT succeeds for the anon key, INSERT fails with HTTP 401
-- (not the normal 403 a pure RLS rejection returns) even against a
-- brand-new table with a plain `WITH CHECK (true)` policy. RLS policies
-- only apply on top of the underlying Postgres GRANT — a permissive
-- policy can't override a missing table-level INSERT privilege. This
-- explicitly grants it; safe to run regardless of the actual cause.
-- ============================================================

GRANT INSERT ON public.enquiries TO anon, authenticated;
GRANT INSERT ON public.custom_enquiries TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
