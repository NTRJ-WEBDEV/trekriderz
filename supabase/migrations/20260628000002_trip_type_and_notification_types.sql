-- Expand trip_type to include wildlife and photography (used by create.tsx and ai-planner.tsx)
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_trip_type_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_trip_type_check
  CHECK (trip_type IN (
    'trek', 'bike', 'temple', 'backpacking', 'weekend',
    'car_ride', 'spiritual', 'wildlife', 'photography'
  ));

-- Extend notifications.type to include all types used by community screens,
-- booking flows, and social interactions
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'trip_invite',
    'homestay_approved', 'guide_approved',
    'booking', 'booking_cancelled',
    'community_join_request', 'community_approved', 'community_rejected',
    'like', 'comment', 'follow',
    'other'
  ));
