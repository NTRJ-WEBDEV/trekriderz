-- ============================================================
-- Phase 3 Foundation: Featured / Suspend columns for the Admin
-- Operations Dashboard
-- ============================================================
-- Additive only. `trips.is_featured` and `stories.is_featured`
-- already exist (20260629000001_cms_admin.sql) — this adds the
-- same concept to the entities that don't have it yet, so the
-- Featured Content Manager has real columns to write to instead
-- of faking a feature that doesn't persist.
--
-- Suspend: `guides.is_active` already exists and is reused as the
-- suspend flag there (is_active = false ⇒ suspended) rather than
-- adding a redundant column. properties/rental_vehicles/communities
-- have no equivalent, so they get `is_suspended`.
-- ============================================================

ALTER TABLE public.guides ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.guided_expeditions ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.rental_vehicles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.rental_vehicles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- "Warn User" / "Reset Warnings" in the Content Moderation spec had no
-- backing counter — users.is_banned is binary, there was nowhere to record
-- an escalating warning short of a ban. One counter, incremented by the
-- warn action and reset by the reset action, makes both real.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_guides_featured ON public.guides(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_properties_featured ON public.properties(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_expeditions_featured ON public.guided_expeditions(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_communities_featured ON public.communities(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_posts_featured ON public.posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_rental_vehicles_featured ON public.rental_vehicles(is_featured) WHERE is_featured = true;

-- Grant new permission keys for the modules Phase 3 adds admin UI
-- for (expeditions/communities already had a permission from Phase 2;
-- these are the ones that were missing).
INSERT INTO public.permissions (key, description) VALUES
  ('communities.approve', 'Suspend or restore a community'),
  ('featured.manage', 'Feature or unfeature content across modules')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'operations_manager' AND p.key IN ('communities.approve', 'featured.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.key = 'content_manager' AND p.key = 'featured.manage'
ON CONFLICT DO NOTHING;
