// Per-type notification config: icon, color, whether it can be grouped
// ("X, Y and 18 others liked your post"), what inline action it offers, and
// where tapping it navigates. Adding a new notification type means adding
// one entry here — mobile/hooks/useNotifications.ts and
// mobile/components/notifications/NotificationRow.tsx read this registry
// generically and never branch on a hardcoded type string themselves.

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  sender_id?: string | null;
  related_id?: string | null;
  metadata?: any;
  created_at: string;
  users?: { full_name: string; avatar_url: string | null } | null;
}

export type NotificationActionKind =
  | 'none'
  | 'followRequest'   // Accept / Decline a pending follow request
  | 'followBack'      // "Follow Back" button (suppressed if already following)
  | 'tripInvite'      // Accept / Decline a trip invite
  | 'view';           // generic "View" button navigating to getRoute()

export interface ActionContext {
  amFollowing: (userId: string) => boolean;
}

export interface NotificationTypeConfig {
  icon: string;
  color: string;
  groupable: boolean;
  // Verb used when this type is grouped, e.g. "liked your post" in
  // "Rahul, Priya and 18 others liked your post."
  groupVerb?: string;
  getActionKind: (n: AppNotification, ctx: ActionContext) => NotificationActionKind;
  getRoute: (n: AppNotification) => string | null;
}

function postRoute(n: AppNotification): string | null {
  const postId = n.related_id || n.metadata?.post_id;
  return postId ? `/post/${postId}` : null;
}

export const NOTIFICATION_TYPES: Record<string, NotificationTypeConfig> = {
  like: {
    icon: 'heart', color: '#ED4956', groupable: true, groupVerb: 'liked your post',
    getActionKind: () => 'none',
    getRoute: postRoute,
  },
  comment: {
    icon: 'chatbubble', color: '#3897F0', groupable: true, groupVerb: 'commented on your post',
    getActionKind: () => 'none',
    getRoute: postRoute,
  },
  comment_reply: {
    icon: 'chatbubble-ellipses', color: '#3897F0', groupable: false,
    getActionKind: () => 'none',
    getRoute: postRoute,
  },
  follow: {
    icon: 'person-add', color: '#A855F7', groupable: false,
    getActionKind: (n) => (n.metadata?.follow_status === 'pending' ? 'followRequest' : 'followBack'),
    getRoute: (n) => (n.sender_id ? `/user/${n.sender_id}` : null),
  },
  follow_accepted: {
    icon: 'checkmark-circle', color: '#8CC63F', groupable: false,
    getActionKind: () => 'none',
    getRoute: (n) => (n.sender_id ? `/user/${n.sender_id}` : null),
  },
  trip_invite: {
    icon: 'airplane', color: '#8CC63F', groupable: false,
    getActionKind: () => 'tripInvite',
    getRoute: (n) => {
      const id = n.related_id || n.metadata?.trip_id;
      return id ? `/trip/${id}` : null;
    },
  },
  booking: {
    icon: 'receipt', color: '#F59E0B', groupable: false,
    getActionKind: () => 'view',
    getRoute: (n) => (n.related_id ? `/booking-details/${n.related_id}` : null),
  },
  booking_cancelled: {
    icon: 'receipt-outline', color: '#EF4444', groupable: false,
    getActionKind: () => 'view',
    getRoute: (n) => (n.related_id ? `/booking-details/${n.related_id}` : null),
  },
  community_join_request: {
    icon: 'people', color: '#8CC63F', groupable: false,
    getActionKind: () => 'view',
    getRoute: (n) => {
      const id = n.related_id || n.metadata?.community_id;
      return id ? `/community/manage/${id}` : null;
    },
  },
  community_approved: {
    icon: 'checkmark-circle', color: '#8CC63F', groupable: false,
    getActionKind: () => 'view',
    getRoute: (n) => {
      const id = n.related_id || n.metadata?.community_id;
      return id ? `/community/${id}` : null;
    },
  },
  community_rejected: {
    icon: 'close-circle', color: '#EF4444', groupable: false,
    getActionKind: () => 'none',
    getRoute: (n) => {
      const id = n.related_id || n.metadata?.community_id;
      return id ? `/community/${id}` : null;
    },
  },
  guide_approved: {
    icon: 'ribbon', color: '#8CC63F', groupable: false,
    getActionKind: () => 'view',
    getRoute: (n) => (n.related_id ? `/guide/${n.related_id}` : null),
  },
  homestay_approved: {
    icon: 'home', color: '#8CC63F', groupable: false,
    getActionKind: () => 'view',
    getRoute: () => '/host/my-properties',
  },
  sos_alert: {
    icon: 'alert-circle', color: '#EF4444', groupable: false,
    getActionKind: () => 'view',
    getRoute: (n) => {
      const id = n.related_id || n.metadata?.trip_id;
      return id ? `/map/${id}` : null;
    },
  },
};

export const DEFAULT_TYPE_CONFIG: NotificationTypeConfig = {
  icon: 'notifications', color: '#6B7280', groupable: false,
  getActionKind: () => 'none',
  getRoute: () => null,
};

export function getTypeConfig(type: string): NotificationTypeConfig {
  return NOTIFICATION_TYPES[type] || DEFAULT_TYPE_CONFIG;
}
