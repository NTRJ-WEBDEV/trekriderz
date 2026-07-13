-- direct_messages was never added to the supabase_realtime publication, so
-- Postgres logical replication never streamed its INSERTs to any client —
-- the DM screen's postgres_changes subscription was correctly written but
-- structurally unable to fire, regardless of RLS or filter correctness.
-- (trip_messages was already in this publication, which is why trip chat's
-- equivalent subscription works.)
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
