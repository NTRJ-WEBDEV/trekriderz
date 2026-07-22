-- ============================================================
-- Internal Trust Engine (Phase 1)
-- ============================================================
-- docs/architecture/PARTNER_PLATFORM.md §7 (Trust System), Phase 1:
-- the internal foundation only. NOT the public Trust Score — no
-- traveller-facing score, badge, ranking, or search-sorting signal is
-- created here. Admin-only visibility; partners see an actionable
-- checklist derived from the same numbers, never a score (enforced in
-- application code, not this migration — see web/mobile
-- TrustEngineService.ts's interpret functions).
--
-- Two pieces:
-- 1. partner_trust_events — append-only log, the "every trust value must
--    be traceable to real data" requirement made literal. Written from
--    the existing single choke points that already exist for each kind
--    of change (ApprovalService.setSuspended/setGuideActive,
--    ReviewWorkspaceService.setDocumentStatus,
--    AuditWorkspaceService.recordAuditOutcome) rather than a new trigger
--    layer — this avoids a second, parallel way these same actions get
--    recorded.
-- 2. compute_partner_trust_factors(entity_type, entity_id) — ONE SQL
--    function computing every raw factor number, called via RPC from
--    both web and mobile. This is the actual answer to "avoid duplicate
--    calculations": the NUMBERS are computed once, in the database: only
--    the human-readable explanation strings are formatted per-platform
--    (mirrored, same convention as every other service pair in this
--    codebase, e.g. ApprovalService/NotificationService/AuditService).
--    Callable by staff (has_permission) OR the entity's own owner (a
--    partner reading their own trust factors) — no one else.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_trust_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('guides', 'homestays', 'vehicles')),
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'audit_passed', 'audit_minor_issues', 'audit_failed',
    'document_verified', 'document_rejected', 'document_expired',
    'photo_refreshed', 'policy_violation',
    'account_suspended', 'account_reinstated'
  )),
  description TEXT NOT NULL,
  impact TEXT NOT NULL CHECK (impact IN ('positive', 'negative', 'neutral')),
  actor_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_trust_events_entity ON public.partner_trust_events(entity_type, entity_id, created_at DESC);

ALTER TABLE public.partner_trust_events ENABLE ROW LEVEL SECURITY;

-- Staff-only — no partner policy. Some events (policy_violation notes
-- especially) may contain internal staff commentary not meant for a
-- partner's eyes; the partner-facing surface reads the *computed
-- factors* (below), never this raw event log directly.
CREATE POLICY "Trust events: staff manage" ON public.partner_trust_events FOR ALL TO authenticated
  USING (
    (entity_type = 'guides' AND public.has_permission('guides.approve'))
    OR (entity_type = 'homestays' AND public.has_permission('homestays.approve'))
    OR (entity_type = 'vehicles' AND public.has_permission('rentals.approve'))
  );

-- ── compute_partner_trust_factors() ──────────────────────────
CREATE OR REPLACE FUNCTION public.compute_partner_trust_factors(p_entity_type TEXT, p_entity_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id UUID;
  v_is_owner BOOLEAN := false;
  v_result JSONB;

  -- Profile / verification
  v_profile_fields INTEGER := 0;
  v_profile_filled INTEGER := 0;
  v_has_identity_doc BOOLEAN := false;
  v_has_business_doc BOOLEAN := false;
  v_business_applicable BOOLEAN := false;
  v_status TEXT;
  v_is_suspended BOOLEAN := false;
  v_created_at TIMESTAMPTZ;

  -- Audit
  v_audit_count INTEGER := 0;
  v_last_outcome TEXT;
  v_last_audit_at TIMESTAMPTZ;
  v_consecutive_clean INTEGER := 0;
  v_next_due DATE;
  v_photo_refresh_at TIMESTAMPTZ;

  -- Documents
  v_doc_total INTEGER := 0;
  v_doc_verified INTEGER := 0;
  v_doc_rejected INTEGER := 0;
  v_doc_expired INTEGER := 0;
  v_doc_pending INTEGER := 0;

  -- Change requests / responsiveness
  v_open_changes INTEGER := 0;
  v_overdue_changes INTEGER := 0;

  -- Trust events
  v_policy_violations_recent INTEGER := 0;
  v_suspension_count INTEGER := 0;
  v_reinstatement_count INTEGER := 0;
BEGIN
  IF p_entity_type = 'guides' THEN
    SELECT user_id, status, NOT is_active, created_at,
      (full_name IS NOT NULL)::int + (contact_phone IS NOT NULL)::int + (COALESCE(about, bio) IS NOT NULL)::int
        + (COALESCE(profile_photo_url, photo_url) IS NOT NULL)::int + (COALESCE(location, '') != '' OR jsonb_array_length(COALESCE(to_jsonb(locations), '[]'::jsonb)) > 0)::int
        + (rate_per_day IS NOT NULL)::int + (jsonb_array_length(COALESCE(to_jsonb(languages), '[]'::jsonb)) > 0)::int
        + (jsonb_array_length(COALESCE(to_jsonb(specializations), '[]'::jsonb)) > 0)::int,
      (identity_doc_front_url IS NOT NULL)
    INTO v_owner_id, v_status, v_is_suspended, v_created_at, v_profile_filled, v_has_identity_doc
    FROM public.guides WHERE id = p_entity_id::uuid;
    v_profile_fields := 8;
    v_business_applicable := false;

  ELSIF p_entity_type = 'homestays' THEN
    SELECT owner_id, status, is_suspended, created_at,
      (name IS NOT NULL)::int + (description IS NOT NULL)::int + (contact_phone IS NOT NULL)::int
        + (contact_email IS NOT NULL)::int + (cover_photo_url IS NOT NULL)::int
        + (COALESCE(array_length(photos, 1), 0) > 0)::int + (COALESCE(array_length(amenities, 1), 0) > 0)::int
        + (cancellation_policy IS NOT NULL)::int,
      (identity_doc_front_url IS NOT NULL), (ownership_proof_url IS NOT NULL)
    INTO v_owner_id, v_status, v_is_suspended, v_created_at, v_profile_filled, v_has_identity_doc, v_has_business_doc
    FROM public.properties WHERE id = p_entity_id::uuid;
    v_profile_fields := 8;
    v_business_applicable := true;

  ELSIF p_entity_type = 'vehicles' THEN
    SELECT owner_id, status, is_suspended, created_at,
      (make IS NOT NULL)::int + (model IS NOT NULL)::int + (description IS NOT NULL)::int
        + (contact_phone IS NOT NULL)::int + (price_per_day IS NOT NULL)::int
        + ((COALESCE(jsonb_array_length(COALESCE(to_jsonb(photos), '[]'::jsonb)), 0) + COALESCE(array_length(images, 1), 0)) > 0)::int
        + (COALESCE(jsonb_array_length(COALESCE(to_jsonb(features), '[]'::jsonb)), 0) > 0)::int
        + (seats IS NOT NULL)::int
    INTO v_owner_id, v_status, v_is_suspended, v_created_at, v_profile_filled
    FROM public.rental_vehicles WHERE id = p_entity_id::uuid;
    v_profile_fields := 8;
    v_has_identity_doc := false; -- no identity/document columns exist for rentals (confirmed prior audit) — not fabricated
    v_business_applicable := false;
  ELSE
    RAISE EXCEPTION 'unknown entity_type: %', p_entity_type;
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'entity not found: % %', p_entity_type, p_entity_id;
  END IF;

  v_is_owner := (auth.uid() = v_owner_id);
  IF NOT v_is_owner AND NOT public.has_permission(
    CASE p_entity_type WHEN 'guides' THEN 'guides.approve' WHEN 'homestays' THEN 'homestays.approve' ELSE 'rentals.approve' END
  ) THEN
    RAISE EXCEPTION 'insufficient permission';
  END IF;

  -- Audit factors
  SELECT next_due_date, consecutive_clean_audits, last_photo_refresh_at
    INTO v_next_due, v_consecutive_clean, v_photo_refresh_at
  FROM public.partner_audit_schedule WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

  SELECT count(*) INTO v_audit_count FROM public.partner_audit_records WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

  SELECT outcome, completed_at INTO v_last_outcome, v_last_audit_at
  FROM public.partner_audit_records
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id AND completed_at IS NOT NULL
  ORDER BY completed_at DESC LIMIT 1;

  -- Document factors
  SELECT count(*), count(*) FILTER (WHERE status = 'verified'), count(*) FILTER (WHERE status = 'rejected'),
         count(*) FILTER (WHERE status = 'expired'), count(*) FILTER (WHERE status = 'pending')
    INTO v_doc_total, v_doc_verified, v_doc_rejected, v_doc_expired, v_doc_pending
  FROM public.review_document_status WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

  -- Responsiveness factors
  SELECT count(*), count(*) FILTER (WHERE created_at < now() - INTERVAL '14 days')
    INTO v_open_changes, v_overdue_changes
  FROM public.review_change_requests
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id AND status NOT IN ('resolved', 'verified');

  -- Trust event history
  SELECT count(*) INTO v_policy_violations_recent FROM public.partner_trust_events
  WHERE entity_type = p_entity_type AND entity_id = p_entity_id AND event_type = 'policy_violation' AND created_at > now() - INTERVAL '6 months';

  SELECT count(*) FILTER (WHERE event_type = 'account_suspended'), count(*) FILTER (WHERE event_type = 'account_reinstated')
    INTO v_suspension_count, v_reinstatement_count
  FROM public.partner_trust_events WHERE entity_type = p_entity_type AND entity_id = p_entity_id;

  v_result := jsonb_build_object(
    'entity_type', p_entity_type, 'entity_id', p_entity_id, 'status', v_status, 'is_suspended', v_is_suspended,
    'created_at', v_created_at, 'is_owner_view', v_is_owner,
    'profile_completeness_pct', ROUND(100.0 * v_profile_filled / GREATEST(v_profile_fields, 1)),
    'has_identity_verification', v_has_identity_doc,
    'business_verification_applicable', v_business_applicable,
    'has_business_verification', v_has_business_doc,
    'audit_count', v_audit_count, 'last_audit_outcome', v_last_outcome,
    'days_since_last_audit', CASE WHEN v_last_audit_at IS NULL THEN NULL ELSE EXTRACT(DAY FROM now() - v_last_audit_at)::int END,
    'consecutive_clean_audits', COALESCE(v_consecutive_clean, 0),
    'next_audit_due_date', v_next_due,
    'audit_overdue', (v_next_due IS NOT NULL AND v_next_due < CURRENT_DATE),
    'days_since_photo_refresh', CASE WHEN v_photo_refresh_at IS NULL THEN NULL ELSE EXTRACT(DAY FROM now() - v_photo_refresh_at)::int END,
    'document_total', v_doc_total, 'document_verified', v_doc_verified, 'document_rejected', v_doc_rejected,
    'document_expired', v_doc_expired, 'document_pending', v_doc_pending,
    'open_change_requests', v_open_changes, 'overdue_change_requests', v_overdue_changes,
    'policy_violations_recent', v_policy_violations_recent,
    'suspension_count', v_suspension_count, 'reinstatement_count', v_reinstatement_count,
    -- Explicitly not computed — no automated customer-issue-report
    -- pipeline exists yet (see PARTNER_PLATFORM.md's own note on this
    -- being framework-only). Null here, not zero, so the UI can show
    -- "not yet tracked" instead of implying a clean record.
    'customer_issue_count', NULL
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_partner_trust_factors(TEXT, TEXT) TO authenticated;
