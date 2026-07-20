-- ============================================================
-- Phase 2 Foundation: RBAC + Activity Log
-- ============================================================
-- Replaces hardcoded role-string checks (profiles.role IN (...),
-- users.role = 'admin') with a real roles/permissions model that
-- both Web Admin and Mobile Operations read from the same place.
--
-- IMPORTANT — closes a real hole found while building this: the
-- `handle_new_cms_user` trigger (20260629000001_cms_admin.sql)
-- defaults EVERY signup's profiles.role to 'moderator', including
-- ordinary mobile app customers (profiles is auto-created for all
-- of auth.users, not just staff). The Phase 1 fix to
-- getAdminSession()/middleware.ts checked `role IN ('super_admin',
-- 'moderator')` — which that default value silently satisfied for
-- every signed-up customer. This migration deliberately does NOT
-- treat the legacy `profiles.role` text column as authoritative;
-- authorization moves to the new nullable `role_id`, which nothing
-- defaults to and must be explicitly granted.
-- ============================================================

-- ── roles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── permissions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── role_permissions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── staff role assignment ───────────────────────────────────
-- Nullable, no default. A profile with role_id = NULL has zero
-- admin permissions regardless of what the legacy `role` text
-- column says.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles: authenticated read" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permissions: authenticated read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Role permissions: authenticated read" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- ── admin_activity_log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,              -- snapshot at time of action; roles change later, the log shouldn't
  action TEXT NOT NULL,          -- e.g. 'guide.approved', 'trip.edited', 'user.banned'
  entity_type TEXT NOT NULL,     -- e.g. 'guide', 'trip', 'user', 'post'
  entity_id TEXT,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  metadata JSONB,
  source TEXT NOT NULL CHECK (source IN ('web_admin', 'mobile_ops')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity ON public.admin_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_actor ON public.admin_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON public.admin_activity_log(created_at DESC);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- ── has_permission() / my_permissions() ─────────────────────
-- The one authorization primitive both apps call through — via
-- RPC from the TS PermissionService, and directly from RLS
-- policies below and on future tables. This IS the "shared
-- authorization layer": one function, one source of truth,
-- instead of parallel role-string checks per screen per app.
CREATE OR REPLACE FUNCTION public.has_permission(permission_key TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.id = auth.uid() AND perm.key = permission_key
  );
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE(permission_key TEXT) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT perm.key
  FROM public.profiles p
  JOIN public.role_permissions rp ON rp.role_id = p.role_id
  JOIN public.permissions perm ON perm.id = rp.permission_id
  WHERE p.id = auth.uid();
$$;

CREATE POLICY "Activity log: staff insert" ON public.admin_activity_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id IS NOT NULL));
CREATE POLICY "Activity log: view with permission" ON public.admin_activity_log FOR SELECT TO authenticated
  USING (public.has_permission('activity_log.view'));
-- No UPDATE/DELETE policy anywhere — an audit log that can be edited isn't one.

-- Replace the two RLS policies from 20260629000001_cms_admin.sql that
-- gated on the legacy text `role = 'super_admin'` directly.
DROP POLICY IF EXISTS "Profiles: admin read all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin update" ON public.profiles;
CREATE POLICY "Profiles: manage with permission" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_permission('profiles.manage'));
CREATE POLICY "Profiles: update with permission" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_permission('profiles.manage'));

-- ============================================================
-- Seed: 11 roles
-- ============================================================
INSERT INTO public.roles (key, name, description) VALUES
  ('super_admin', 'Super Admin', 'Full access to every module, including RBAC itself.'),
  ('operations_manager', 'Operations Manager', 'Full access to operational modules — trips, guides, homestays, rentals, bookings, moderation, support — excluding Finance approval and RBAC.'),
  ('trip_coordinator', 'Trip Coordinator', 'Trips and expeditions: create, edit, publish, check-in.'),
  ('guide_manager', 'Guide Manager', 'Guide approval, documents, performance.'),
  ('homestay_manager', 'Homestay Manager', 'Homestay/property approval, pricing, availability.'),
  ('rental_manager', 'Rental Manager', 'Rental vehicle/gear approval and inventory.'),
  ('moderator', 'Moderator', 'Content moderation and user ban/flag — no business modules.'),
  ('content_manager', 'Content Manager', 'CMS: banners, featured content, stories, videos, places.'),
  ('support', 'Support', 'Support tickets, SOS, refund requests, feedback.'),
  ('finance', 'Finance', 'Revenue, commission, payouts, refunds.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: permissions (module.action, expandable — new keys can be
-- added later without touching this migration or any screen code)
-- ============================================================
INSERT INTO public.permissions (key, description) VALUES
  ('rbac.manage', 'Manage roles, permissions, and role assignments'),
  ('profiles.manage', 'Manage staff profile records'),
  ('activity_log.view', 'View the admin activity log'),
  ('trips.manage', 'Create, edit, cancel, duplicate trips'),
  ('trips.view', 'View trip data'),
  ('expeditions.manage', 'Create, edit, publish, archive expeditions'),
  ('communities.manage', 'Create, edit, delete communities'),
  ('guides.approve', 'Approve or reject guide applications'),
  ('guides.edit', 'Edit guide profile/business data'),
  ('guides.delete', 'Remove a guide'),
  ('homestays.approve', 'Approve or reject homestay/property listings'),
  ('homestays.edit', 'Edit homestay/property business data'),
  ('homestays.delete', 'Remove a homestay/property'),
  ('rentals.approve', 'Approve or reject rental vehicle/gear listings'),
  ('rentals.edit', 'Edit rental business data'),
  ('rentals.delete', 'Remove a rental listing'),
  ('bookings.view', 'View bookings'),
  ('bookings.refund', 'Issue refunds on bookings'),
  ('bookings.cancel', 'Cancel bookings'),
  ('finance.view', 'View revenue/commission/payout data'),
  ('finance.edit', 'Edit payout/commission records'),
  ('cms.publish', 'Publish CMS content (stories, videos, places, banners)'),
  ('cms.edit', 'Edit CMS content'),
  ('cms.view', 'View CMS content'),
  ('users.view', 'View user directory'),
  ('users.ban', 'Ban or suspend a user'),
  ('users.verify', 'Verify a user/guide/homestay owner'),
  ('users.role_manage', 'Change a user''s app role'),
  ('reels.moderate', 'Hide, delete, restore reels'),
  ('posts.delete', 'Delete posts'),
  ('stories.moderate', 'Hide, delete, restore stories'),
  ('comments.moderate', 'Hide, delete, restore comments'),
  ('reports.resolve', 'Dismiss or action reported content/users'),
  ('sos.manage', 'Monitor and resolve SOS alerts'),
  ('analytics.view', 'View analytics dashboards')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: role → permission grants
-- ============================================================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'operations_manager' AND p.key IN (
  'trips.manage','trips.view','expeditions.manage','communities.manage',
  'guides.approve','guides.edit','homestays.approve','homestays.edit',
  'rentals.approve','rentals.edit','bookings.view','bookings.refund','bookings.cancel',
  'users.ban','users.verify','users.view',
  'reels.moderate','posts.delete','stories.moderate','comments.moderate','reports.resolve',
  'sos.manage','cms.view','analytics.view','activity_log.view'
) ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'trip_coordinator' AND p.key IN ('trips.manage','trips.view','expeditions.manage','bookings.view','activity_log.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'guide_manager' AND p.key IN ('guides.approve','guides.edit','guides.delete','trips.view','bookings.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'homestay_manager' AND p.key IN ('homestays.approve','homestays.edit','homestays.delete','bookings.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'rental_manager' AND p.key IN ('rentals.approve','rentals.edit','rentals.delete','bookings.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'moderator' AND p.key IN ('reels.moderate','posts.delete','stories.moderate','comments.moderate','reports.resolve','users.ban','users.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'content_manager' AND p.key IN ('cms.publish','cms.edit','cms.view','trips.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'support' AND p.key IN ('bookings.view','users.view','sos.manage','reports.resolve')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'finance' AND p.key IN ('finance.view','finance.edit','bookings.view','bookings.refund','users.view')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Backfill: grant role_id ONLY to accounts with confirmed,
-- deliberate admin access today. Deliberately does NOT touch
-- every existing profiles row with role='moderator' — that
-- value is the trigger's default for ALL signups, not proof of
-- legitimate staff access (see note at top of file). Any real
-- moderator/staff accounts beyond the two cases below must be
-- re-granted manually via the Team screen after this migration.
-- ============================================================
UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE key = 'super_admin')
WHERE email = 'ntrjwebdev@gmail.com';

UPDATE public.profiles p SET role_id = (SELECT id FROM public.roles WHERE key = 'operations_manager')
WHERE p.role_id IS NULL
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.id AND u.role = 'admin');
