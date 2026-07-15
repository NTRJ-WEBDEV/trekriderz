import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// Lightweight global unread-notification count, scoped at the layout level
// (not just inside notifications.tsx) so the Home screen's bell icon can
// show a badge without needing that screen to be mounted. Populated once on
// login, kept live via a Realtime subscription on notifications INSERT.
interface NotificationState {
  unreadCount: number;
  channel: ReturnType<typeof supabase.channel> | null;
  init: (userId: string) => Promise<void>;
  reset: () => void;
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
      .subscribe();

    set({ channel });
  },

  reset: () => set({ unreadCount: 0 }),

  cleanup: () => {
    const { channel } = get();
    if (channel) supabase.removeChannel(channel);
    set({ channel: null });
  },
}));
