import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// Global unread-notification count, scoped at the layout level (not just
// inside notifications.tsx) so the Home screen's bell icon can show a badge
// without needing that screen to be mounted. Populated once on login from
// the real is_read=false count, then kept accurate via two Realtime
// listeners: INSERT increments it, and UPDATE where is_read flips to true
// decrements it — the latter means the count self-corrects no matter which
// screen/action/device actually marked something read, instead of relying
// on every read-path in the app to remember to call a decrement function.
interface NotificationState {
  unreadCount: number;
  channel: ReturnType<typeof supabase.channel> | null;
  init: (userId: string) => Promise<void>;
  cleanup: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  channel: null,

  init: async (userId: string) => {
    get().cleanup(); // in case init() is ever called twice (e.g. re-login) without an intervening cleanup

    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      set({ unreadCount: count || 0 });
    } catch (error) {
      console.error('notificationStore init error:', error);
    }

    const channel = supabase
      .channel(`unread_notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => set((state) => ({ unreadCount: state.unreadCount + 1 }))
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.old?.is_read === false && payload.new?.is_read === true) {
            set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) }));
          }
        }
      )
      .subscribe();

    set({ channel });
  },

  cleanup: () => {
    const { channel } = get();
    if (channel) supabase.removeChannel(channel);
    set({ channel: null });
  },
}));
