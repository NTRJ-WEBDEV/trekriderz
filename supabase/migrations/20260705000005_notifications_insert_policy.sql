-- public.notifications had SELECT and UPDATE policies (both scoped to the
-- recipient) but no INSERT policy at all — meaning every notification insert
-- from client code (follow requests, trip join requests, community join
-- requests, admin approval messages, etc.) has been silently failing.
-- sender_id must either be null (system/admin-generated) or match the
-- authenticated user, so nobody can spoof a notification as coming from
-- someone else.
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;

CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (sender_id IS NULL OR sender_id = auth.uid());
