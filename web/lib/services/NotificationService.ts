import { createClient } from '@/lib/supabase';

// Mirrors mobile/lib/services/NotificationService.ts — same table, same
// valid type enum, same principle (one insert path instead of one per
// screen). Web Admin didn't have any notification-writing code before
// Phase 3; this is the first, not a second implementation of an existing one.
export type NotificationType =
  | 'trip_invite' | 'homestay_approved' | 'guide_approved' | 'booking' | 'booking_cancelled'
  | 'community_join_request' | 'community_join_approved' | 'community_join_rejected'
  | 'like' | 'comment' | 'follow' | 'sos_alert' | 'other'
  | 'changes_requested' | 'ready_for_review' | 'audit_reminder';

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  metadata?: Record<string, unknown>;
}

export async function notify({ userId, type, title, message, relatedId, metadata }: NotifyParams): Promise<void> {
  const supabase = createClient();
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
