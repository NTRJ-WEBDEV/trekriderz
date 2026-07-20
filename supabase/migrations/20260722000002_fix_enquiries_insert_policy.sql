-- ============================================================
-- Fix: public.enquiries INSERT policy not taking effect
-- ============================================================
-- Verified live after applying 20260722000001: anon-role inserts
-- (exactly what TripEnquiryForm/SpecialEnquiryForm/ContactForm/
-- Newsletter all do) are rejected with 42501 "row-level security
-- policy" even with a minimal payload — the original
-- "Enquiries: public insert" policy isn't being applied as intended.
-- Idempotent: drops and recreates the policy so this is safe to run
-- regardless of what caused the original one not to take effect.
-- ============================================================

DROP POLICY IF EXISTS "Enquiries: public insert" ON public.enquiries;

CREATE POLICY "Enquiries: public insert" ON public.enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
