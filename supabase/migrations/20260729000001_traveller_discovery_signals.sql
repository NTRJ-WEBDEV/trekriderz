-- ============================================================
-- Traveller Discovery Experience — supporting data
-- ============================================================
-- Two pieces, both read-only/public-safe (no booking, no payment, no
-- public Trust Score, per this milestone's explicit scope):
--
-- 1. public.reviews — mobile/components/ReviewSheet.tsx has inserted into
--    a `reviews` table since an earlier milestone, but no migration ever
--    created it (grep across every migration file: zero matches) and
--    nothing in the app ever reads it back — guide/homestay detail
--    screens either hardcode "No reviews yet" or only show a write button.
--    CREATE TABLE IF NOT EXISTS brings whatever already exists (if
--    anything) under tracking without disturbing it; the shape here
--    matches ReviewSheet's insert exactly (target_id, target_type,
--    reviewer_id, rating, comment). 'vehicle' is added to target_type
--    since rentals currently have no review path at all.
--
-- 2. compute_public_trust_signals(entity_type, entity_id) — a NEW,
--    separate function from compute_partner_trust_factors(). That
--    existing function is deliberately gated to staff-or-owner
--    (PARTNER_PLATFORM.md §7, Internal Trust Engine) and returns
--    everything, including internal-only fields (policy violations,
--    suspension counts, open change requests) that must never reach a
--    traveller. Rather than loosening that gate, this is a narrower,
--    publicly-callable function that recomputes only the handful of
--    fields that are safe and meaningful to show a traveller (identity/
--    business verification, recent-audit outcome, photo freshness) —
--    intentionally NOT a wrapper around the admin function, since the
--    whole point is a smaller, public-safe surface, not the same data
--    with a permission check removed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('guide', 'homestay', 'expedition', 'vehicle')),
  target_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (target_type, target_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_target ON public.reviews(target_type, target_id, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviews: public read" ON public.reviews;
CREATE POLICY "Reviews: public read" ON public.reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Reviews: own insert" ON public.reviews;
CREATE POLICY "Reviews: own insert" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Reviews: own update" ON public.reviews;
CREATE POLICY "Reviews: own update" ON public.reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Reviews: own delete" ON public.reviews;
CREATE POLICY "Reviews: own delete" ON public.reviews FOR DELETE TO authenticated
  USING (reviewer_id = auth.uid());

-- ── compute_public_trust_signals() ──────────────────────────
-- Callable by ANY authenticated user, about ANY entity — no owner/staff
-- gate, because nothing it returns is sensitive. Deliberately excludes:
-- profile completeness %, document counts, change-request counts, policy
-- violations, suspension/reinstatement counts — all of those stay
-- internal-only (compute_partner_trust_factors).
CREATE OR REPLACE FUNCTION public.compute_public_trust_signals(p_entity_type TEXT, p_entity_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_status TEXT;
  v_created_at TIMESTAMPTZ;
  v_has_identity_doc BOOLEAN := false;
  v_has_business_doc BOOLEAN := false;
  v_business_applicable BOOLEAN := false;
  v_last_outcome TEXT;
  v_last_audit_at TIMESTAMPTZ;
  v_photo_refresh_at TIMESTAMPTZ;
BEGIN
  IF p_entity_type = 'guides' THEN
    SELECT status, created_at, (identity_doc_front_url IS NOT NULL)
      INTO v_status, v_created_at, v_has_identity_doc
    FROM public.guides WHERE id = p_entity_id::uuid;

  ELSIF p_entity_type = 'homestays' THEN
    SELECT status, created_at, (identity_doc_front_url IS NOT NULL), (ownership_proof_url IS NOT NULL)
      INTO v_status, v_created_at, v_has_identity_doc, v_has_business_doc
    FROM public.properties WHERE id = p_entity_id::uuid;
    v_business_applicable := true;

  ELSIF p_entity_type = 'vehicles' THEN
    SELECT status, created_at INTO v_status, v_created_at
    FROM public.rental_vehicles WHERE id = p_entity_id::uuid;
    -- no identity/document columns exist for rentals (same finding as
    -- compute_partner_trust_factors) — not fabricated here either.

  ELSE
    RAISE EXCEPTION 'unknown entity_type: %', p_entity_type;
  END IF;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'entity not found: % %', p_entity_type, p_entity_id;
  END IF;

  SELECT outcome, completed_at INTO v_last_outcome, v_last_audit_at
  FROM public.partner_audit_records
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id AND completed_at IS NOT NULL
  ORDER BY completed_at DESC LIMIT 1;

  SELECT last_photo_refresh_at INTO v_photo_refresh_at
  FROM public.partner_audit_schedule WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

  RETURN jsonb_build_object(
    'entity_type', p_entity_type, 'entity_id', p_entity_id,
    'status', v_status, 'created_at', v_created_at,
    'has_identity_verification', v_has_identity_doc,
    'business_verification_applicable', v_business_applicable,
    'has_business_verification', v_has_business_doc,
    'last_audit_outcome', v_last_outcome,
    'days_since_last_audit', CASE WHEN v_last_audit_at IS NULL THEN NULL ELSE EXTRACT(DAY FROM now() - v_last_audit_at)::int END,
    'days_since_photo_refresh', CASE WHEN v_photo_refresh_at IS NULL THEN NULL ELSE EXTRACT(DAY FROM now() - v_photo_refresh_at)::int END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_public_trust_signals(TEXT, TEXT) TO authenticated;
