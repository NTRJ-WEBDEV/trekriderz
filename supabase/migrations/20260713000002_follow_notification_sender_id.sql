-- notify_new_follow() never set notifications.sender_id, but
-- notifications.tsx only renders Accept/Decline buttons when sender_id is
-- present (isFollowRequest = type === 'follow' && !!sender_id). Without this,
-- no follow notification — request or otherwise — could ever show the
-- accept/decline UI. Also differentiate copy for a pending request (needs
-- action) vs an already-accepted follow (informational only).
CREATE OR REPLACE FUNCTION public.notify_new_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT full_name INTO follower_name FROM public.users WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id)
  VALUES (
    NEW.following_id,
    NEW.follower_id,
    'follow',
    CASE WHEN NEW.status = 'pending'
      THEN COALESCE(follower_name, 'Someone') || ' wants to follow you'
      ELSE COALESCE(follower_name, 'Someone') || ' started following you'
    END,
    CASE WHEN NEW.status = 'pending'
      THEN 'Review this follow request.'
      ELSE 'Tap to view their profile.'
    END,
    NEW.follower_id
  );
  RETURN NEW;
END;
$$;
