-- Notification system fixes, part of the Instagram-style redesign.

-- Realtime UPDATE payloads only include the primary key in `old` unless the
-- table has REPLICA IDENTITY FULL — the mobile store's new unread-count
-- logic needs to see old.is_read to tell "became read" apart from any other
-- update, so this is required for that fix to actually work, not optional.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 'comment_reply' was used by notify_post_comment() (20260717000003) but was
-- never added to this CHECK constraint. Since that INSERT runs inside an
-- AFTER INSERT trigger on post_comments with no exception handling, the
-- constraint violation aborted the whole transaction — replying to a
-- comment has been failing outright since that migration landed.
-- 'follow_accepted' is new: today only the followee is ever notified: the
-- person who sent a follow request is never told it was accepted.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'trip_invite',
    'homestay_approved', 'guide_approved',
    'booking', 'booking_cancelled',
    'community_join_request', 'community_approved', 'community_rejected',
    'like', 'comment', 'comment_reply', 'follow', 'follow_accepted',
    'sos_alert', 'other'
  ));

-- notify_new_follow() set title/message text differentiating a pending
-- request from an already-accepted follow, but nothing in the row itself
-- records which case it was — the mobile app was left guessing from
-- sender_id alone (always set for both cases), which is why Accept/Decline
-- buttons were rendering on "X started following you" notifications too.
-- metadata.follow_status makes this an explicit, reliable field instead of
-- inferring it from message text.
CREATE OR REPLACE FUNCTION public.notify_new_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  SELECT full_name INTO follower_name FROM public.users WHERE id = NEW.follower_id;

  INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id, metadata)
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
    NEW.follower_id,
    jsonb_build_object('follow_status', NEW.status)
  );
  RETURN NEW;
END;
$$;

-- New: notify the original requester once their pending follow request is
-- accepted (via handleFollowRespond in the app) — this direction never
-- fired a notification before.
CREATE OR REPLACE FUNCTION public.notify_follow_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  followee_name TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    SELECT full_name INTO followee_name FROM public.users WHERE id = NEW.following_id;

    INSERT INTO public.notifications (user_id, sender_id, type, title, message, related_id, metadata)
    VALUES (
      NEW.follower_id,
      NEW.following_id,
      'follow_accepted',
      COALESCE(followee_name, 'Someone') || ' accepted your follow request',
      'Tap to view their profile.',
      NEW.following_id,
      jsonb_build_object('follow_status', 'accepted')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow_accepted ON public.user_follows;
CREATE TRIGGER trg_notify_follow_accepted
  AFTER UPDATE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_follow_accepted();
