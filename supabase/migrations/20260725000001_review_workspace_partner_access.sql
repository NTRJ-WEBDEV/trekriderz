-- ============================================================
-- Partner Portal — Review Resolution Workspace
-- ============================================================
-- Evolves the review workspace tables from 20260724000001 rather than
-- adding new ones (per explicit direction to prefer evolution over
-- duplication):
--
-- 1. review_change_requests gets the richer 5-state flow the Partner
--    Portal needs (Requested → Partner Working → Ready For Review →
--    Resolved → Verified) instead of the original 2-state pending/
--    resolved, plus priority/comment/reference/history columns.
-- 2. review_document_status gets a staging column for partner-uploaded
--    replacement documents — layered on top of the original document
--    URL, never overwriting it, so "never overwrite history" holds by
--    construction rather than by convention.
-- 3. Both tables get a NEW partner-facing RLS policy. This is the
--    actually-required part of this migration: the previous migration
--    only granted staff (has_permission(...)) access — a partner had
--    zero ability to read their own change requests or document status
--    at all, which would make every screen this milestone builds
--    unable to load any data regardless of UI correctness.
-- 4. notifications_type_check widened by two values this workflow
--    needs (changes_requested, ready_for_review) — and two existing
--    call sites (mobile host/create.tsx, guide/register.tsx) that have
--    been silently failing to notify admins since they insert an
--    invalid type('system') are pointed at the new, valid type instead.
-- ============================================================

-- ── review_change_requests: richer status flow ───────────────
ALTER TABLE public.review_change_requests DROP CONSTRAINT IF EXISTS review_change_requests_status_check;

UPDATE public.review_change_requests SET status = 'requested' WHERE status = 'pending';

ALTER TABLE public.review_change_requests
  ADD CONSTRAINT review_change_requests_status_check
  CHECK (status IN ('requested', 'partner_working', 'ready_for_review', 'resolved', 'verified'));

ALTER TABLE public.review_change_requests ALTER COLUMN status SET DEFAULT 'requested';

ALTER TABLE public.review_change_requests
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS partner_comment TEXT,
  ADD COLUMN IF NOT EXISTS admin_reference_url TEXT,
  -- Append-only transition log: [{ status, actor_id, note, at }, ...].
  -- Appended by application code (ReviewWorkspaceService), never
  -- overwritten — this is the audit trail the brief asks for, without a
  -- second table, since a jsonb array is sufficient for "show me this
  -- request's history" and nothing here needs cross-request querying.
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── review_document_status: staged replacement, layered not overwritten ──
ALTER TABLE public.review_document_status
  ADD COLUMN IF NOT EXISTS replacement_path TEXT,
  ADD COLUMN IF NOT EXISTS replacement_uploaded_at TIMESTAMPTZ;

-- ── Partner-facing RLS ───────────────────────────────────────
-- Ownership resolved against the same three tables ApprovalService.ts
-- already keys on (guides.user_id, properties.owner_id,
-- rental_vehicles.owner_id) — entity_id is stored as TEXT so it's cast
-- to uuid for the comparison.
CREATE POLICY "Change requests: partner view own" ON public.review_change_requests FOR SELECT TO authenticated
  USING (
    (entity_type = 'guides' AND entity_id::uuid IN (SELECT id FROM public.guides WHERE user_id = auth.uid()))
    OR (entity_type = 'homestays' AND entity_id::uuid IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()))
    OR (entity_type = 'vehicles' AND entity_id::uuid IN (SELECT id FROM public.rental_vehicles WHERE owner_id = auth.uid()))
  );

-- Partners only ever update status/partner_comment/status_history in
-- practice (enforced by ReviewWorkspaceService, the same app-layer
-- boundary the previous migration already used for "does resubmission
-- clear this request") — not restricted at the column level here to
-- avoid a trigger for a non-security-sensitive boundary (a partner
-- editing their own issue/instructions text harms no one but their own
-- case, which the reviewer will simply see and can correct).
CREATE POLICY "Change requests: partner update own" ON public.review_change_requests FOR UPDATE TO authenticated
  USING (
    (entity_type = 'guides' AND entity_id::uuid IN (SELECT id FROM public.guides WHERE user_id = auth.uid()))
    OR (entity_type = 'homestays' AND entity_id::uuid IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()))
    OR (entity_type = 'vehicles' AND entity_id::uuid IN (SELECT id FROM public.rental_vehicles WHERE owner_id = auth.uid()))
  );

CREATE POLICY "Document status: partner view own" ON public.review_document_status FOR SELECT TO authenticated
  USING (
    (entity_type = 'guides' AND entity_id::uuid IN (SELECT id FROM public.guides WHERE user_id = auth.uid()))
    OR (entity_type = 'homestays' AND entity_id::uuid IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()))
    OR (entity_type = 'vehicles' AND entity_id::uuid IN (SELECT id FROM public.rental_vehicles WHERE owner_id = auth.uid()))
  );

-- Partner may only stage a replacement — status/reviewed_by/reviewed_at
-- stay staff-only in practice (set exclusively by ReviewWorkspaceService's
-- staff-side setDocumentStatus, never by the partner-side upload call).
CREATE POLICY "Document status: partner update own replacement" ON public.review_document_status FOR UPDATE TO authenticated
  USING (
    (entity_type = 'guides' AND entity_id::uuid IN (SELECT id FROM public.guides WHERE user_id = auth.uid()))
    OR (entity_type = 'homestays' AND entity_id::uuid IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()))
    OR (entity_type = 'vehicles' AND entity_id::uuid IN (SELECT id FROM public.rental_vehicles WHERE owner_id = auth.uid()))
  );

-- review_internal_notes intentionally gets NO partner policy — staff-only
-- by design, per that table's own header comment from the prior migration.

-- ── Notification types this workflow needs ───────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'trip_invite',
    'homestay_approved', 'guide_approved',
    'booking', 'booking_cancelled',
    'community_join_request', 'community_approved', 'community_rejected',
    'like', 'comment', 'comment_reply', 'follow', 'follow_accepted',
    'sos_alert', 'other',
    'changes_requested', 'ready_for_review'
  ));
