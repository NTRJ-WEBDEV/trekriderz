-- public.users is missing `location`, which app/user/[id].tsx (profile view) and
-- app/profile/edit.tsx (profile save) already reference. The view's SELECT hard-fails
-- with "column users.location does not exist" (confirmed live), meaning every profile
-- view has been showing "User not found" and every profile edit save has been
-- silently failing. Adding the column fixes both at the root.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location TEXT;

-- Verified badge — distinct from the existing role-based text badge (Guide/Homestay
-- Owner/Admin). Lets any account be marked verified independent of role.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- Admin accounts are verified by definition.
UPDATE public.users SET is_verified = true WHERE role = 'admin';
