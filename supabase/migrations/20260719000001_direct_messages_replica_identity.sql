-- Same fix as notifications (20260718000002): Realtime UPDATE payloads only
-- include the primary key in `old` unless the table has REPLICA IDENTITY
-- FULL. The new chat unread-badge hook (useUnreadChatCount) needs to see
-- old.is_read to tell "became read" apart from any other update to the row.
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
