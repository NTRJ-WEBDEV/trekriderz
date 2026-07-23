-- ============================================================
-- Partner Audit & Reverification System
-- ============================================================
-- docs/architecture/PARTNER_PLATFORM.md §8 (Periodic Audit System),
-- built as its own operational workflow — deliberately NOT Trust Score
-- (§7), which is a later milestone that depends on this data existing
-- first (audit recency/pass-rate is one of that formula's inputs).
--
-- Two tables, keyed on (entity_type, entity_id) like every other review-
-- workspace table so far:
--   partner_audit_schedule  — current state: next due date, cadence,
--                             reminder tier, photo-refresh timestamp.
--   partner_audit_records   — append-only history: one row per
--                             completed audit, its checklist and outcome.
--
-- Auto-scheduling: a trigger on guides/properties/rental_vehicles seeds
-- a schedule row the moment status becomes 'approved', regardless of
-- whether that happens from web or mobile. A one-time backfill covers
-- listings already approved before this migration.
--
-- Reminders reuse this project's existing pg_cron + notifications
-- pattern (see send_scheduled_test_reminders() in
-- 20260719000004_schedule_test_reminders.sql) rather than inventing new
-- infrastructure — a daily cron job calls a SQL function that inserts
-- notification rows. This is safe to fully automate (reversible, zero
-- listing impact). Auto-HIDING an overdue listing is a different risk
-- class entirely — that stays a manual admin action from the audit
-- queue (AuditWorkspaceService.hideOverdueListing), not something this
-- migration schedules unattended.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_audit_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('guides', 'homestays', 'vehicles')),
  entity_id TEXT NOT NULL,
  cadence_months INTEGER NOT NULL DEFAULT 6 CHECK (cadence_months BETWEEN 3 AND 12),
  next_due_date DATE NOT NULL,
  last_photo_refresh_at TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  last_reminder_tier TEXT,
  -- Drives §8.1's risk-based cadence extension: 3+ consecutive clean
  -- (pass) audits earns a longer cadence next time; reset to 0 on any
  -- non-pass outcome. Read/written by record_audit_outcome() below.
  consecutive_clean_audits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'overdue', 'hidden_overdue')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_audit_schedule_due ON public.partner_audit_schedule(next_due_date);

CREATE TABLE IF NOT EXISTS public.partner_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('guides', 'homestays', 'vehicles')),
  entity_id TEXT NOT NULL,
  -- §8.3's per-partner-type default audit type — video walkthrough
  -- (homestays), document-only (rentals), cert/response review (guides),
  -- component refresh (future organiser type). Not enum-restrictive
  -- beyond that, so a physical-visit escalation is still just a string.
  audit_type TEXT NOT NULL CHECK (audit_type IN ('video', 'physical', 'document_only', 'component_refresh')),
  -- §8.4's checklist components, as flexible jsonb rather than five
  -- separate boolean columns — same reasoning as review_change_requests'
  -- status_history: this needs to be read back as one record, not
  -- queried column-by-column across audits.
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_set JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome TEXT CHECK (outcome IN ('pass', 'minor_issues', 'fail')),
  notes TEXT,
  auditor_id UUID REFERENCES auth.users(id),
  scheduled_for DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_audit_records_entity ON public.partner_audit_records(entity_type, entity_id, created_at DESC);

ALTER TABLE public.partner_audit_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_audit_records ENABLE ROW LEVEL SECURITY;

-- Staff-only — same reviewers who approve listings run their audits;
-- no partner-facing policy this milestone (not asked for, and the
-- Partner Dashboard's audit view per PARTNER_PLATFORM.md §11 is a
-- separate, later Partner Portal milestone, not this one).
DROP POLICY IF EXISTS "Audit schedule: staff manage" ON public.partner_audit_schedule;
CREATE POLICY "Audit schedule: staff manage" ON public.partner_audit_schedule FOR ALL TO authenticated
  USING (
    (entity_type = 'guides' AND public.has_permission('guides.approve'))
    OR (entity_type = 'homestays' AND public.has_permission('homestays.approve'))
    OR (entity_type = 'vehicles' AND public.has_permission('rentals.approve'))
  );

DROP POLICY IF EXISTS "Audit records: staff manage" ON public.partner_audit_records;
CREATE POLICY "Audit records: staff manage" ON public.partner_audit_records FOR ALL TO authenticated
  USING (
    (entity_type = 'guides' AND public.has_permission('guides.approve'))
    OR (entity_type = 'homestays' AND public.has_permission('homestays.approve'))
    OR (entity_type = 'vehicles' AND public.has_permission('rentals.approve'))
  );

-- ── Auto-scheduling trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_audit_schedule()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    v_entity_type := CASE TG_TABLE_NAME
      WHEN 'guides' THEN 'guides'
      WHEN 'properties' THEN 'homestays'
      WHEN 'rental_vehicles' THEN 'vehicles'
    END;

    INSERT INTO public.partner_audit_schedule (entity_type, entity_id, next_due_date)
    VALUES (v_entity_type, NEW.id::text, (now() + INTERVAL '6 months')::date)
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      next_due_date = EXCLUDED.next_due_date,
      status = 'active',
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_audit_schedule_guides ON public.guides;
CREATE TRIGGER trg_seed_audit_schedule_guides
  AFTER UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.seed_audit_schedule();

DROP TRIGGER IF EXISTS trg_seed_audit_schedule_properties ON public.properties;
CREATE TRIGGER trg_seed_audit_schedule_properties
  AFTER UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.seed_audit_schedule();

DROP TRIGGER IF EXISTS trg_seed_audit_schedule_vehicles ON public.rental_vehicles;
CREATE TRIGGER trg_seed_audit_schedule_vehicles
  AFTER UPDATE ON public.rental_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.seed_audit_schedule();

-- ── One-time backfill for already-approved listings ──────────
INSERT INTO public.partner_audit_schedule (entity_type, entity_id, next_due_date)
SELECT 'guides', id::text, (COALESCE(verified_at, created_at, now()) + INTERVAL '6 months')::date
FROM public.guides WHERE status = 'approved'
ON CONFLICT (entity_type, entity_id) DO NOTHING;

INSERT INTO public.partner_audit_schedule (entity_type, entity_id, next_due_date)
SELECT 'homestays', id::text, (COALESCE(approved_at, created_at, now()) + INTERVAL '6 months')::date
FROM public.properties WHERE status = 'approved'
ON CONFLICT (entity_type, entity_id) DO NOTHING;

INSERT INTO public.partner_audit_schedule (entity_type, entity_id, next_due_date)
SELECT 'vehicles', id::text, (COALESCE(created_at, now()) + INTERVAL '6 months')::date
FROM public.rental_vehicles WHERE status = 'approved'
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- ── Reminder tier (§8.2: 60/30/14/7/1 days before due, then overdue) ──
CREATE OR REPLACE FUNCTION public.compute_audit_reminder_tier(p_due_date DATE)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_due_date < CURRENT_DATE THEN 'overdue'
    WHEN p_due_date - CURRENT_DATE <= 1 THEN '1d'
    WHEN p_due_date - CURRENT_DATE <= 7 THEN '7d'
    WHEN p_due_date - CURRENT_DATE <= 14 THEN '14d'
    WHEN p_due_date - CURRENT_DATE <= 30 THEN '30d'
    WHEN p_due_date - CURRENT_DATE <= 60 THEN '60d'
    ELSE NULL
  END;
$$;

-- ── Automated reminder notifications (safe to schedule — see header) ──
CREATE OR REPLACE FUNCTION public.send_audit_reminders()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row RECORD;
  v_owner_id UUID;
  v_tier TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.partner_audit_schedule
    WHERE status != 'hidden_overdue'
  LOOP
    v_tier := public.compute_audit_reminder_tier(v_row.next_due_date);
    IF v_tier IS NULL THEN CONTINUE; END IF;
    IF v_tier = v_row.last_reminder_tier THEN CONTINUE; END IF; -- already reminded at this tier

    v_owner_id := NULL;
    IF v_row.entity_type = 'guides' THEN
      SELECT user_id INTO v_owner_id FROM public.guides WHERE id = v_row.entity_id::uuid;
    ELSIF v_row.entity_type = 'homestays' THEN
      SELECT owner_id INTO v_owner_id FROM public.properties WHERE id = v_row.entity_id::uuid;
    ELSIF v_row.entity_type = 'vehicles' THEN
      SELECT owner_id INTO v_owner_id FROM public.rental_vehicles WHERE id = v_row.entity_id::uuid;
    END IF;
    IF v_owner_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, type, title, message, related_id, metadata)
    VALUES (
      v_owner_id, 'audit_reminder',
      CASE WHEN v_tier = 'overdue' THEN 'Your listing''s re-verification is overdue'
           ELSE 'Re-verification coming up' END,
      CASE WHEN v_tier = 'overdue' THEN 'Your listing is now overdue for re-verification. Please respond soon to stay visible on TrekRiderz.'
           ELSE 'Your listing is due for a routine re-verification on ' || to_char(v_row.next_due_date, 'DD Mon YYYY') || '.' END,
      v_row.entity_id,
      jsonb_build_object('entity_type', v_row.entity_type, 'tier', v_tier)
    );

    UPDATE public.partner_audit_schedule
      SET last_reminder_sent_at = now(), last_reminder_tier = v_tier,
          status = CASE WHEN v_tier = 'overdue' THEN 'overdue' ELSE status END
      WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_audit_reminders() TO service_role;

SELECT cron.schedule(
  'partner-audit-reminders-daily',
  '0 3 * * *',
  'SELECT public.send_audit_reminders();'
);

-- ── Notification type this workflow needs ────────────────────
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
    'changes_requested', 'ready_for_review',
    'audit_reminder'
  ));
