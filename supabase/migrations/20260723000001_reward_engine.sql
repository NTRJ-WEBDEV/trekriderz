-- ============================================================
-- Generic Reward Campaign Engine
-- ============================================================
-- This is deliberately NOT a "tester rewards" or "community champions"
-- feature — it's a reusable engine any future admin surface (Partner
-- Dashboard, Finance, Marketplace, Mobile Admin) can plug into by
-- inserting a new `reward_campaigns` row, not by adding tables. The
-- Web Admin "Community Champions" page is simply the first UI built on
-- top of it, seeded below as the closed-beta reward round.
--
-- Scoring weights and the active-days threshold live on the campaign
-- row itself (`scoring_weights`, `min_active_days`), not in application
-- code, so a future campaign with different point values or a different
-- bar for "active" never needs a migration or a code change — only a
-- new row. `reward_items` is a free-form jsonb array (`{type, label,
-- value?}`) rather than an enum, so new reward types (cashback, free
-- trips, sponsor merch, badges, certificates, ...) never need a schema
-- change either.
--
-- `compute_reward_campaign_scores()` currently aggregates exactly six
-- real activity signals (active days, posts, reels, stories, comments,
-- likes given) — the signals the current brief asks for. A future
-- campaign type needing a genuinely different signal (referral count,
-- booking count, etc.) is a follow-up change to this function, not a
-- new table.
-- ============================================================

-- ── permissions ──────────────────────────────────────────────
INSERT INTO public.permissions (key, description) VALUES
  ('reward_campaigns.view', 'View reward campaigns and candidate leaderboards'),
  ('reward_campaigns.manage', 'Recalculate scores, change candidate status, add notes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'super_admin' AND p.key IN ('reward_campaigns.view', 'reward_campaigns.manage')
ON CONFLICT DO NOTHING;

-- ── reward_campaigns ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'community_champions', -- free-form label, not an enum — new campaign types never need a migration
  reward_items JSONB NOT NULL DEFAULT '[]'::jsonb,           -- [{ type, label, value? }, ...] — type is free-form (voucher/tshirt/cap/merchandise/free_trip/cashback/points/badge/certificate/sponsor/...)
  scoring_weights JSONB NOT NULL,                             -- { activeDay, post, reel, story, comment, likeGiven }
  min_active_days INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── reward_candidates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.reward_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_score NUMERIC NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  reels_count INTEGER NOT NULL DEFAULT 0,
  stories_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  likes_given_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'eligible'
    CHECK (status IN ('eligible', 'shortlisted', 'approved', 'rewarded', 'disqualified')),
  internal_note TEXT,
  computed_at TIMESTAMPTZ DEFAULT now(),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_candidates_campaign ON public.reward_candidates(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reward_candidates_score ON public.reward_candidates(campaign_id, activity_score DESC);

ALTER TABLE public.reward_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reward campaigns: staff view" ON public.reward_campaigns FOR SELECT TO authenticated
  USING (public.has_permission('reward_campaigns.view'));
CREATE POLICY "Reward campaigns: staff manage insert" ON public.reward_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('reward_campaigns.manage'));
CREATE POLICY "Reward campaigns: staff manage update" ON public.reward_campaigns FOR UPDATE TO authenticated
  USING (public.has_permission('reward_campaigns.manage'));

CREATE POLICY "Reward candidates: staff view" ON public.reward_candidates FOR SELECT TO authenticated
  USING (public.has_permission('reward_campaigns.view'));
CREATE POLICY "Reward candidates: staff manage insert" ON public.reward_candidates FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('reward_campaigns.manage'));
CREATE POLICY "Reward candidates: staff manage update" ON public.reward_candidates FOR UPDATE TO authenticated
  USING (public.has_permission('reward_campaigns.manage'));

-- ── compute_reward_campaign_scores() ─────────────────────────
-- SECURITY DEFINER because it must aggregate activity across every
-- user, the same way has_permission()/my_permissions() already bypass
-- RLS for their own narrow purpose — self-guarded with the same
-- has_permission() primitive rather than relying on GRANT/REVOKE alone.
--
-- Reads weights/threshold off the campaign row (not passed in by the
-- caller) so a future campaign with different values needs a new row,
-- never a new function signature. Upserts on (campaign_id, user_id),
-- updating only score/metric columns — `status` is never touched here,
-- so re-running this after an admin has shortlisted/approved/rewarded/
-- disqualified a candidate can't silently undo that decision.
CREATE OR REPLACE FUNCTION public.compute_reward_campaign_scores(p_campaign_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_weights JSONB;
  v_min_active_days INTEGER;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF NOT public.has_permission('reward_campaigns.manage') THEN
    RAISE EXCEPTION 'insufficient permission';
  END IF;

  SELECT scoring_weights, min_active_days,
         COALESCE(starts_at, '-infinity'::timestamptz), COALESCE(ends_at, 'infinity'::timestamptz)
    INTO v_weights, v_min_active_days, v_window_start, v_window_end
  FROM public.reward_campaigns WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign not found';
  END IF;

  WITH activity AS (
    SELECT user_id, COUNT(DISTINCT activity_date) AS active_days
    FROM public.user_daily_activity
    WHERE activity_date BETWEEN v_window_start::date AND v_window_end::date
    GROUP BY user_id
  ),
  posts_agg AS (
    SELECT user_id,
      COUNT(*) FILTER (WHERE post_type IS DISTINCT FROM 'reel') AS posts_count,
      COUNT(*) FILTER (WHERE post_type = 'reel') AS reels_count
    FROM public.posts
    WHERE created_at BETWEEN v_window_start AND v_window_end
    GROUP BY user_id
  ),
  stories_agg AS (
    SELECT user_id, COUNT(*) AS stories_count
    FROM public.stories_24h
    WHERE created_at BETWEEN v_window_start AND v_window_end
    GROUP BY user_id
  ),
  comments_agg AS (
    SELECT user_id, COUNT(*) AS comments_count
    FROM public.post_comments
    WHERE created_at BETWEEN v_window_start AND v_window_end
    GROUP BY user_id
  ),
  likes_agg AS (
    SELECT user_id, COUNT(*) AS likes_given_count
    FROM public.post_likes
    WHERE created_at BETWEEN v_window_start AND v_window_end
    GROUP BY user_id
  ),
  combined AS (
    SELECT
      a.user_id,
      a.active_days,
      COALESCE(p.posts_count, 0) AS posts_count,
      COALESCE(p.reels_count, 0) AS reels_count,
      COALESCE(s.stories_count, 0) AS stories_count,
      COALESCE(c.comments_count, 0) AS comments_count,
      COALESCE(l.likes_given_count, 0) AS likes_given_count
    FROM activity a
    LEFT JOIN posts_agg p ON p.user_id = a.user_id
    LEFT JOIN stories_agg s ON s.user_id = a.user_id
    LEFT JOIN comments_agg c ON c.user_id = a.user_id
    LEFT JOIN likes_agg l ON l.user_id = a.user_id
    WHERE a.active_days >= v_min_active_days
  )
  INSERT INTO public.reward_candidates (
    campaign_id, user_id, activity_score, active_days,
    posts_count, reels_count, stories_count, comments_count, likes_given_count, computed_at
  )
  SELECT
    p_campaign_id,
    combined.user_id,
    (combined.active_days * COALESCE((v_weights->>'activeDay')::numeric, 0))
      + (combined.posts_count * COALESCE((v_weights->>'post')::numeric, 0))
      + (combined.reels_count * COALESCE((v_weights->>'reel')::numeric, 0))
      + (combined.stories_count * COALESCE((v_weights->>'story')::numeric, 0))
      + (combined.comments_count * COALESCE((v_weights->>'comment')::numeric, 0))
      + (combined.likes_given_count * COALESCE((v_weights->>'likeGiven')::numeric, 0)),
    combined.active_days, combined.posts_count, combined.reels_count,
    combined.stories_count, combined.comments_count, combined.likes_given_count, now()
  FROM combined
  JOIN public.users u ON u.id = combined.user_id AND COALESCE(u.is_banned, false) = false
  ON CONFLICT (campaign_id, user_id) DO UPDATE SET
    activity_score = EXCLUDED.activity_score,
    active_days = EXCLUDED.active_days,
    posts_count = EXCLUDED.posts_count,
    reels_count = EXCLUDED.reels_count,
    stories_count = EXCLUDED.stories_count,
    comments_count = EXCLUDED.comments_count,
    likes_given_count = EXCLUDED.likes_given_count,
    computed_at = EXCLUDED.computed_at;
    -- status/internal_note/decided_by/decided_at deliberately not in the UPDATE SET

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Seed: the closed-beta reward round ───────────────────────
-- Guarded with NOT EXISTS rather than ON CONFLICT — reward_campaigns has
-- no natural unique key on (name, campaign_type), so this keeps a re-run
-- of the migration from inserting a duplicate campaign row.
INSERT INTO public.reward_campaigns (name, description, campaign_type, reward_items, scoring_weights, min_active_days, is_active)
SELECT
  'Closed Beta Champions',
  'Rewards for the most active users of the TrekRiderz closed beta.',
  'community_champions',
  '[{"type":"voucher","label":"TrekRiderz Voucher","value":"₹1,000"},{"type":"cap","label":"TrekRiderz Cap"},{"type":"tshirt","label":"TrekRiderz T-Shirt"}]'::jsonb,
  '{"activeDay":10,"post":5,"reel":8,"story":3,"comment":2,"likeGiven":1}'::jsonb,
  3,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.reward_campaigns WHERE campaign_type = 'community_champions'
);
