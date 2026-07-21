-- ============================================================
-- Admin Review Workspace v1
-- ============================================================
-- Implements the highest-leverage piece of docs/architecture/
-- PARTNER_PLATFORM.md's Admin Review Workspace (§10) and Communication
-- System (§9.1): structured, itemized Request Changes; per-document
-- status; and a staff-only internal notes thread — for the three
-- partner types that already have review pages (guides/homestays/
-- rentals; entity_type values match the literal strings
-- ApprovalService.ts already uses: 'guides', 'homestays', 'vehicles').
--
-- Deliberately NOT part of this migration (see build-phase discussion):
-- - A generic Document entity replacing existing per-table URL columns
--   (identity_doc_front_url, ownership_proof_url, etc.). Those columns
--   stay as the file-location source of truth; review_document_status
--   below references them by `document_key` (e.g. 'identity_doc_front')
--   rather than duplicating file storage. Migrating the columns
--   themselves is real-data-migration risk not required for this
--   workspace to function, and PARTNER_PLATFORM.md §16 sequences
--   broader data-model change after workspace unification, not before.
-- - Trust Score (§16 sequences it as a later step, after this one).
-- - Reviewer assignment (no second reviewer to assign to yet — add a
--   nullable assigned_to column when that changes, no redesign needed).
-- - A formal VerificationCase wrapper entity — these three tables key
--   directly on (entity_type, entity_id), the same pattern
--   admin_activity_log and reward_candidates already use.
-- ============================================================

-- ── review_change_requests ───────────────────────────────────
-- One row per itemized ask, independently resolvable. A case only
-- reads as "fully addressed" once every open item for that
-- (entity_type, entity_id) is resolved — enforced in application code
-- (ReviewWorkspaceService), not a DB constraint, since "does resubmission
-- clear this" is a workflow decision, not a data-integrity one.
CREATE TABLE IF NOT EXISTS public.review_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('guides', 'homestays', 'vehicles')),
  entity_id TEXT NOT NULL,
  field_key TEXT,                 -- e.g. 'identity_doc_front_url'; nullable — a request can be about something that isn't a single field (e.g. "clarify your pricing")
  issue TEXT NOT NULL,            -- short label, e.g. 'blurred', 'expired', 'mismatch'
  instructions TEXT NOT NULL,     -- what the partner needs to do
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_change_requests_entity ON public.review_change_requests(entity_type, entity_id);

-- ── review_document_status ───────────────────────────────────
-- Generic per-document review state, keyed by the existing column name
-- it corresponds to rather than storing the file itself.
CREATE TABLE IF NOT EXISTS public.review_document_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('guides', 'homestays', 'vehicles')),
  entity_id TEXT NOT NULL,
  document_key TEXT NOT NULL,     -- e.g. 'identity_doc_front', 'ownership_proof'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  expiry_date DATE,
  UNIQUE (entity_type, entity_id, document_key)
);

-- ── review_internal_notes ────────────────────────────────────
-- Staff-only thread. Never surfaced to the partner — distinct from
-- review_change_requests, which IS partner-facing.
CREATE TABLE IF NOT EXISTS public.review_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('guides', 'homestays', 'vehicles')),
  entity_id TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_internal_notes_entity ON public.review_internal_notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_review_document_status_entity ON public.review_document_status(entity_type, entity_id);

ALTER TABLE public.review_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_document_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_internal_notes ENABLE ROW LEVEL SECURITY;

-- Reuses the existing per-entity approve permissions rather than
-- introducing new permission keys — 'guides.approve' etc. already exist
-- and already gate the same review actions on the list/detail pages.
-- One FOR ALL policy per table (covers SELECT/INSERT/UPDATE/DELETE) —
-- no separate SELECT policy needed alongside it, that would just be a
-- redundant duplicate of the same condition.
CREATE POLICY "Change requests: staff manage" ON public.review_change_requests FOR ALL TO authenticated
  USING (
    (entity_type = 'guides' AND public.has_permission('guides.approve'))
    OR (entity_type = 'homestays' AND public.has_permission('homestays.approve'))
    OR (entity_type = 'vehicles' AND public.has_permission('rentals.approve'))
  );

CREATE POLICY "Document status: staff manage" ON public.review_document_status FOR ALL TO authenticated
  USING (
    (entity_type = 'guides' AND public.has_permission('guides.approve'))
    OR (entity_type = 'homestays' AND public.has_permission('homestays.approve'))
    OR (entity_type = 'vehicles' AND public.has_permission('rentals.approve'))
  );

CREATE POLICY "Internal notes: staff manage" ON public.review_internal_notes FOR ALL TO authenticated
  USING (
    (entity_type = 'guides' AND public.has_permission('guides.approve'))
    OR (entity_type = 'homestays' AND public.has_permission('homestays.approve'))
    OR (entity_type = 'vehicles' AND public.has_permission('rentals.approve'))
  );
