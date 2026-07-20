import { supabase } from '../supabase';

// The one place that inserts into `notifications` — every screen that used
// to call supabase.from('notifications').insert(...) directly should call
// this instead. Centralizing it is what caught the reject-notification bug
// below: 'system' isn't a valid `notifications.type` (see the CHECK
// constraint), so every admin rejection notification was silently failing.
export type NotificationType =
  | 'trip_invite' | 'homestay_approved' | 'guide_approved' | 'booking' | 'booking_cancelled'
  | 'community_join_request' | 'community_join_approved' | 'community_join_rejected'
  | 'like' | 'comment' | 'follow' | 'sos_alert' | 'other';

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  metadata?: Record<string, unknown>;
}

export async function notify({ userId, type, title, message, relatedId, metadata }: NotifyParams): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    related_id: relatedId ?? null,
    metadata: metadata ?? null,
  });
  if (error) console.error('NotificationService.notify failed:', error.message);
}
