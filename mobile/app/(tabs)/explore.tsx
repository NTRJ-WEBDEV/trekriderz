import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Image, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useUnreadChatCount } from '@/hooks/useUnreadChatCount';
import { formatPostTime } from '@/lib/format';
import { AppColors, Spacing } from '@/constants/theme';
import AppHeader from '@/components/ui/AppHeader';
import PostCard from '@/components/PostCard';

interface StoryCircle {
  userId: string;
  name: string;
  avatar: string;
  hasUnseen: boolean;
}

// ── Composer teaser — Facebook-inspired "what's on your mind" bar. Always
// navigates out to the real create screens rather than expanding inline. ──

function QuickAction({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '1A' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ComposerTeaser({ avatarUrl }: { avatarUrl: string }) {
  return (
    <View style={styles.composer}>
      <TouchableOpacity style={styles.composerRow} activeOpacity={0.8} onPress={() => router.push('/post/create' as any)}>
        <Image source={{ uri: avatarUrl }} style={styles.composerAvatar} />
        <View style={styles.composerTextBlock}>
          <Text style={styles.composerPrompt} numberOfLines={1}>Share your adventure 🏔️</Text>
          <View style={styles.composerSubRow}>
            <Ionicons name="location-outline" size={12} color={AppColors.subtext} style={{ marginTop: 2 }} />
            <Text style={styles.composerSub} numberOfLines={2}>Where did your adventure take you today?</Text>
          </View>
        </View>
        <View style={styles.composerPhotoBtn}>
          <Ionicons name="image-outline" size={20} color={AppColors.primary} />
        </View>
      </TouchableOpacity>
      <View style={styles.quickActionsRow}>
        <QuickAction icon="camera-outline" label="Photo" color={AppColors.primary} onPress={() => router.push('/post/create' as any)} />
        <QuickAction icon="videocam-outline" label="Reel" color="#F43F5E" onPress={() => Alert.alert('Coming Soon', 'Reels are on their way — stay tuned!')} />
        <QuickAction icon="location-outline" label="Check-in" color="#F97316" onPress={() => router.push({ pathname: '/post/create', params: { focus: 'location' } } as any)} />
        <QuickAction icon="book-outline" label="Article" color={AppColors.primary} onPress={() => router.push('/stories/create' as any)} />
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const { user } = useAuthStore();
  const unreadNotifications = useNotificationStore((s) => s.unreadCount);
  const unreadChats = useUnreadChatCount();

  const [posts, setPosts] = useState<any[]>([]);
  const [storyCircles, setStoryCircles] = useState<StoryCircle[]>([]);
  const [myHasStory, setMyHasStory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFollowing = useCallback(async () => {
    if (!user?.id) return [] as string[];
    const { data } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted');
    const ids = (data || []).map((f: any) => f.following_id);
    return ids;
  }, [user?.id]);

  const fetchPosts = useCallback(async () => {
    try {
      const query = supabase
        .from('posts')
        .select('*, users:user_id(id, full_name, avatar_url, email)')
        .eq('visibility', 'public')
        .or('post_type.is.null,post_type.neq.trip_story')
        .order('created_at', { ascending: false })
        .limit(30);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) { setPosts([]); return; }

      const [{ data: likes }, { data: saves }] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user?.id || ''),
        supabase.from('post_saves').select('post_id').eq('user_id', user?.id || ''),
      ]);
      const likedIds = new Set((likes || []).map((l: any) => l.post_id));
      const savedIds = new Set((saves || []).map((s: any) => s.post_id));

      const tripIds = [...new Set(data.filter((p: any) => p.trip_id).map((p: any) => p.trip_id))];
      let tripsMap: Record<string, any> = {};
      if (tripIds.length > 0) {
        const { data: tripsData } = await supabase
          .from('trips').select('id, status, trip_type, destination, title').in('id', tripIds);
        tripsMap = Object.fromEntries((tripsData || []).map((t: any) => [t.id, t]));
      }

      setPosts(data.map((p: any) => ({
        id: p.id,
        user: {
          name: p.users?.full_name || p.users?.email?.split('@')[0] || 'Rider',
          avatar: p.users?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(p.users?.full_name || 'R')}&background=8CC63F&color=fff`,
          id: p.user_id,
        },
        images: Array.isArray(p.media) ? p.media : [],
        content: p.content || '',
        youtube_url: p.youtube_url,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        timestamp: formatPostTime(p.created_at),
        location: p.location,
        liked: likedIds.has(p.id),
        saved: savedIds.has(p.id),
        trip_id: p.trip_id,
        trip: p.trip_id ? tripsMap[p.trip_id] || undefined : undefined,
      })));
    } catch (error) {
      console.error('Feed error:', error);
    }
  }, [user?.id]);

  // Fetch real 24hr stories — one circle per author (self excluded, shown separately)
  const fetchStoryCircles = useCallback(async (following: string[]) => {
    if (!user?.id) return;
    try {
      const authorIds = [...following, user.id];
      const { data } = await supabase
        .from('stories_24h')
        .select('id, user_id, created_at, users:user_id(id, full_name, avatar_url, email)')
        .in('user_id', authorIds)
        .eq('is_hidden', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      const { data: viewedRows } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id);
      const viewedIds = new Set((viewedRows || []).map((v: any) => v.story_id));

      const byUser = new Map<string, { name: string; avatar: string; anyUnseen: boolean }>();
      for (const s of data || []) {
        const u = s.users as any;
        const name = u?.full_name || u?.email?.split('@')[0] || 'User';
        const existing = byUser.get(s.user_id);
        const unseen = !viewedIds.has(s.id);
        if (existing) {
          existing.anyUnseen = existing.anyUnseen || unseen;
        } else {
          byUser.set(s.user_id, {
            name,
            avatar: u?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8CC63F&color=fff`,
            anyUnseen: unseen,
          });
        }
      }

      setMyHasStory(byUser.has(user.id));
      const circles: StoryCircle[] = [];
      byUser.forEach((v, userId) => {
        if (userId === user.id) return;
        circles.push({ userId, name: v.name, avatar: v.avatar, hasUnseen: v.anyUnseen });
      });
      setStoryCircles(circles);
    } catch (_) {}
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    const following = await fetchFollowing();
    await Promise.all([fetchPosts(), fetchStoryCircles(following)]);
  }, [fetchFollowing, fetchPosts, fetchStoryCircles]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Refetch on every focus (e.g. returning from a post's comment screen) —
  // the realtime subscription in PostCard isn't a reliable enough guarantee
  // on its own that counts updated elsewhere show up immediately here.
  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const openStory = (userId: string, name: string, avatar: string) => {
    router.push({ pathname: '/story/view', params: { userId, name, avatar } } as any);
  };

  const myName = (user as any)?.user_metadata?.full_name?.split(' ')[0] || 'You';
  const myAvatar = (user as any)?.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=8CC63F&color=fff`;

  const HeaderComponent = () => (
    <>
      {/* Stories */}
      <View style={styles.storiesSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesList}>
          {/* "Your Story" — view own active story, or create a new one */}
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => myHasStory ? openStory(user!.id, 'Your Story', myAvatar) : router.push('/story/create' as any)}
          >
            <View style={[styles.storyRing, myHasStory && styles.storyRingOwn]}>
              <Image source={{ uri: myAvatar }} style={styles.storyAvatar} />
              <TouchableOpacity
                style={styles.addBadge}
                onPress={(e) => { e.stopPropagation(); router.push('/story/create' as any); }}
              >
                <Ionicons name="add" size={13} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>Your Story</Text>
          </TouchableOpacity>

          {/* 24hr story circles — followed users with an active story */}
          {storyCircles.map((item) => (
            <TouchableOpacity
              key={item.userId}
              style={styles.storyItem}
              onPress={() => openStory(item.userId, item.name, item.avatar)}
            >
              {item.hasUnseen ? (
                <LinearGradient
                  colors={['#833AB4', '#FD1D1D', '#F77737']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.storyRingGradient}
                >
                  <View style={styles.storyRingGap}>
                    <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.storyRing, styles.storyRingSeen]}>
                  <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
                </View>
              )}
              <Text style={styles.storyName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}

          {/* See All — full stories list */}
          {storyCircles.length > 0 && (
            <TouchableOpacity style={styles.storyItem} onPress={() => router.push('/stories' as any)}>
              <View style={styles.seeAllCircle}>
                <Ionicons name="ellipsis-horizontal" size={22} color={AppColors.subtext} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>See All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Create post teaser */}
      <ComposerTeaser avatarUrl={myAvatar} />

      {posts.length === 0 && (
        <View style={styles.emptyFollowing}>
          <Ionicons name="images-outline" size={40} color={AppColors.subtext} />
          <Text style={styles.emptyTitle}>No posts yet — be the first to share your adventure!</Text>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={AppColors.background} />

      <AppHeader avatarUrl={myAvatar} notificationCount={unreadNotifications} chatCount={unreadChats} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<HeaderComponent />}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 80, paddingTop: Spacing.md }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },

  storiesSection: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: AppColors.border },
  storiesList: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  storyItem: { alignItems: 'center', width: 72 },
  storyRing: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.15)', padding: 2.5, marginBottom: 4, position: 'relative',
  },
  storyRingGradient: {
    width: 64, height: 64, borderRadius: 32, padding: 2.5, marginBottom: 4, position: 'relative',
  },
  storyRingGap: {
    flex: 1, borderRadius: 27, backgroundColor: AppColors.background,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  storyRingOwn: { borderColor: AppColors.primary },
  storyRingSeen: { borderColor: 'rgba(255,255,255,0.15)' },
  storyAvatar: { width: 54, height: 54, borderRadius: 27 },
  addBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: AppColors.primary, borderWidth: 2, borderColor: AppColors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  seeAllCircle: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 4,
    backgroundColor: AppColors.card, borderWidth: 1, borderColor: AppColors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  storyName: { fontSize: 11, textAlign: 'center', color: AppColors.subtext },

  composer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  composerAvatar: { width: 42, height: 42, borderRadius: 21 },
  composerTextBlock: { flex: 1, gap: 4 },
  composerPrompt: { color: AppColors.text, fontSize: 15, fontWeight: '700' },
  composerSubRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  composerSub: { flex: 1, color: AppColors.subtext, fontSize: 12 },
  composerPhotoBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  quickAction: { alignItems: 'center', gap: 5, flex: 1 },
  quickActionIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: AppColors.subtext },

  emptyFollowing: { alignItems: 'center', paddingTop: Spacing.xxl * 2, paddingHorizontal: Spacing.xxl, gap: Spacing.md },
  emptyTitle: { fontSize: 14, textAlign: 'center', fontWeight: '600', color: AppColors.text },
});
