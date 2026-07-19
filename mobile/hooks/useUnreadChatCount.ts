import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// Total unread DM count for header badges — reuses the same
// direct_messages.is_read column (tabs)/chats.tsx already reads, just
// aggregated rather than grouped per-conversation. Kept as its own small
// hook (mirrors notificationStore's fetch+realtime shape) so any screen
// needing just the badge number doesn't need chats.tsx's fuller
// per-partner grouping logic.
export function useUnreadChatCount() {
  const { user } = useAuthStore();
  const [count, setCount] = useState(0);
  // Unique channel name per hook instance — AppHeader now mounts this on
  // every bottom tab simultaneously (React Navigation keeps visited tabs
  // alive), and a shared `unread_dms:${user.id}` name across instances
  // hits the same "cannot add postgres_changes callbacks after subscribe()"
  // collision usePostRealtime already had to work around.
  const channelName = useRef(`unread_dms:${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!user?.id) return;

    const fetchCount = async () => {
      const { count: c } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      setCount(c || 0);
    };
    fetchCount();

    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        () => setCount((prev) => prev + 1)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.old?.is_read === false && payload.new?.is_read === true) {
            setCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return count;
}
