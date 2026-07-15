-- notifications was never added to the supabase_realtime publication —
-- found while verifying the new unread-count badge (notificationStore.ts):
-- the live-increment-on-INSERT subscription never fired, despite RLS being
-- correct (user_id = auth.uid() on SELECT). Same root cause class as the
-- direct_messages gap fixed earlier this session (20260713000004) — a
-- table missing from the publication means Postgres never streams its
-- changes to any client, independent of RLS or subscription code
-- correctness. This also silently affected the pre-existing notifications
-- screen's own real-time refresh, not just the new badge.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
