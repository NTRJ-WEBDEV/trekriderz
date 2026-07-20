import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Dimensions, ViewToken, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors } from '@/constants/theme';
import ReelPlayerItem, { ReelPostData } from '@/components/reels/ReelPlayerItem';
import EmptyState from '@/components/EmptyState';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 10;

function mapRow(p: any): ReelPostData {
  return {
    id: p.id,
    user: {
      id: p.user_id,
      name: p.users?.full_name || p.users?.email?.split('@')[0] || 'Rider',
      avatar: p.users?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.users?.full_name || 'R')}&background=8CC63F&color=fff`,
    },
    videoUri: Array.isArray(p.media) ? p.media[0] : '',
    content: p.content || '',
    likes_count: p.likes_count || 0,
    comments_count: p.comments_count || 0,
    location: p.location || undefined,
    activityType: Array.isArray(p.tags) && p.tags.length > 0 ? p.tags[0] : null,
  };
}

// Full-screen vertical Reels feed. Same data source (`posts` where
// post_type='reel') whether entered from the Feed, a profile's Reels tab,
// or (later) Explore/Adventure — the query only changes shape via the
// optional `userId` param.
export default function ReelsScreen() {
  const { postId, userId } = useLocalSearchParams<{ postId?: string; userId?: string }>();
  const { user } = useAuthStore();
  const [reels, setReels] = useState<ReelPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<ReelPostData>>(null);
  const initialScrollDone = useRef(false);

  const applyLikedSaved = useCallback(async (items: ReelPostData[]) => {
    if (!user?.id || items.length === 0) return items;
    const ids = items.map((r) => r.id);
    const [{ data: likes }, { data: saves }] = await Promise.all([
      supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
      supabase.from('post_saves').select('post_id').eq('user_id', user.id).in('post_id', ids),
    ]);
    const likedIds = new Set((likes || []).map((l: any) => l.post_id));
    const savedIds = new Set((saves || []).map((s: any) => s.post_id));
    return items.map((r) => ({ ...r, liked: likedIds.has(r.id), saved: savedIds.has(r.id) }));
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('posts')
        .select('id, content, media, likes_count, comments_count, location, tags, created_at, user_id, users:user_id(id, full_name, avatar_url, email)')
        .eq('post_type', 'reel')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (userId) query = query.eq('user_id', userId);

      const { data, error } = await query;
      if (error) throw error;
      let items = (data || []).map(mapRow);

      // The tapped reel might be older than this first page — make sure
      // it's always present so entry-from-Feed/Profile never lands on the
      // wrong screen.
      if (postId && !items.some((r) => r.id === postId)) {
        const { data: single } = await supabase
          .from('posts')
          .select('id, content, media, likes_count, comments_count, location, tags, created_at, user_id, users:user_id(id, full_name, avatar_url, email)')
          .eq('id', postId)
          .maybeSingle();
        if (single) items = [mapRow(single), ...items];
      }

      items = await applyLikedSaved(items);
      setReels(items);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error('Reels load error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId, postId, applyLikedSaved]);

  useEffect(() => { load(); }, [load]);

  // Land on the tapped reel once the list is populated.
  useEffect(() => {
    if (initialScrollDone.current || loading || reels.length === 0 || !postId) return;
    const idx = reels.findIndex((r) => r.id === postId);
    if (idx > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: idx, animated: false }));
      setActiveIndex(idx);
    }
    initialScrollDone.current = true;
  }, [loading, reels, postId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || reels.length === 0) return;
    setLoadingMore(true);
    try {
      let query = supabase
        .from('posts')
        .select('id, content, media, likes_count, comments_count, location, tags, created_at, user_id, users:user_id(id, full_name, avatar_url, email)')
        .eq('post_type', 'reel')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .range(reels.length, reels.length + PAGE_SIZE - 1);

      if (userId) query = query.eq('user_id', userId);

      const { data, error } = await query;
      if (error) throw error;
      const items = await applyLikedSaved((data || []).map(mapRow));
      setReels((prev) => [...prev, ...items]);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error('Reels loadMore error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const removeReel = (id: string) => setReels((prev) => prev.filter((r) => r.id !== id));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: AppColors.background }]}>
        <EmptyState icon="film-outline" title="No reels yet" subtitle="Adventure reels will show up here once people start posting them." fillScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        // Small window + one-at-a-time batching keeps at most a couple of
        // VideoView/decoder instances mounted, regardless of feed length —
        // the memory/battery risk the audit flagged in Section 7.
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        removeClippedSubviews
        getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        renderItem={({ item, index }) => (
          <ReelPlayerItem post={item} isActive={index === activeIndex} onDeleted={removeReel} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
});
