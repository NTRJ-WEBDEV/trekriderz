-- WandR Launch Cleanup Script
-- Removes all mock/seed data to prepare for real user onboarding

TRUNCATE TABLE public.moderation_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.app_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.app_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.trip_messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.post_likes RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.post_comments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.posts RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.bookings RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.trip_members RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.trips RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.homestays RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.guides RESTART IDENTITY CASCADE;

-- Note: We keep public.users but reset their profiles to fresh state if needed.
-- For this MVP wrap, we assume current users are either the Admin or Test Users.

-- Reset any auto-banned users for a fresh start
UPDATE public.users SET is_banned = false, ban_reason = NULL;
