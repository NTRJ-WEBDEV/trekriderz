import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface PostUpdate {
  likes_count: number;
  comments_count: number;
}

export function usePostRealtime(postId: string, initialLikes: number, initialComments: number) {
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [commentsCount, setCommentsCount] = useState(initialComments);
  // Unique channel name per hook instance prevents "already subscribed" errors
  // when the same postId mounts multiple times (e.g. FlatList re-renders).
  const channelName = useRef(`post_updates:${postId}:${Math.random().toString(36).substr(2, 6)}`);

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` },
        (payload) => {
          if (payload.new) {
            if (typeof payload.new.likes_count === 'number') setLikesCount(payload.new.likes_count);
            if (typeof payload.new.comments_count === 'number') setCommentsCount(payload.new.comments_count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  return { likesCount, commentsCount, setLikesCount, setCommentsCount };
}
