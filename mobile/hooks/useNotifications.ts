import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppNotification } from '@/lib/notifications/registry';

// LayoutAnimation is a no-op on Android until this is enabled once — the
// mark-read/mark-all transitions below rely on it for the "unread tint
// fades out" effect.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface PostMeta {
  thumbnail?: string;
  caption?: string;
}

// All notification data-fetching and mutation logic in one place — the
// screen only renders. Adding a new notification TYPE never touches this
// file; it only needs a registry entry (mobile/lib/notifications/registry.ts).
// This file only grows if a new notification needs a genuinely new *inline
// action* (a new mutation), not for a new type using an existing one.
export function useNotifications() {
  const { user } = useAuthStore();
  const [raw, setRaw] = useState<AppNotification[]>([]);
  const [postMeta, setPostMeta] = useState<Record<string, PostMeta>>({});
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const rawRef = useRef<AppNotification[]>([]);
  rawRef.current = raw;

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, users:sender_id (full_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as AppNotification[];
      setRaw(rows);

      const postIds = [...new Set(
        rows
          .filter((n) => n.type === 'like' || n.type === 'comment' || n.type === 'comment_reply')
          .map((n) => n.related_id || n.metadata?.post_id)
          .filter(Boolean)
      )];
      if (postIds.length > 0) {
        const { data: posts } = await supabase.from('posts').select('id, media, content').in('id', postIds);
        const map: Record<string, PostMeta> = {};
        (posts || []).forEach((p: any) => {
          map[p.id] = { thumbnail: Array.isArray(p.media) ? p.media[0] : undefined, caption: p.content };
        });
        setPostMeta(map);
      } else {
        setPostMeta({});
      }

      const { data: following } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('status', 'accepted');
      setFollowingSet(new Set((following || []).map((f: any) => f.following_id)));
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchAll();
    const channel = supabase
      .channel(`user_notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchAll()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  // Store's own unread badge self-corrects via its Realtime UPDATE listener
  // (see notificationStore.ts) — this only needs to update the DB and the
  // local list, not touch the badge count itself.
  const markRead = useCallback(async (ids: string[]) => {
    const targets = ids.filter((id) => rawRef.current.find((n) => n.id === id && !n.is_read));
    if (targets.length === 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRaw((prev) => prev.map((n) => (targets.includes(n.id) ? { ...n, is_read: true } : n)));
    try {
      await supabase.from('notifications').update({ is_read: true }).in('id', targets);
    } catch (err) {
      console.error('Error marking read:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = rawRef.current.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRaw((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  }, []);

  const respondFollowRequest = useCallback(async (notif: AppNotification, action: 'accepted' | 'declined') => {
    if (!user?.id || !notif.sender_id || actionLoading) return;
    setActionLoading(notif.id);
    try {
      // RLS only lets the follower delete their own row (follows_delete: follower_id =
      // auth.uid()), so the followee accepting/declining must go through follows_update
      // (following_id = auth.uid()) for both actions — a delete here would silently
      // affect zero rows instead of erroring.
      const { error } = await supabase
        .from('user_follows')
        .update({ status: action === 'accepted' ? 'accepted' : 'rejected' })
        .eq('follower_id', notif.sender_id)
        .eq('following_id', user.id);
      if (error) throw error;
      await markRead([notif.id]);
      fetchAll();
    } catch (error) {
      console.error('Error responding to follow request:', error);
      Alert.alert('Error', 'Failed to respond to follow request');
    } finally {
      setActionLoading(null);
    }
  }, [user, actionLoading, markRead, fetchAll]);

  const respondTripInvite = useCallback(async (notif: AppNotification, action: 'accepted' | 'declined') => {
    if (!user?.id || actionLoading) return;
    const tripId = notif.related_id || notif.metadata?.trip_id;
    if (!tripId) {
      Alert.alert('Error', 'Missing trip information');
      return;
    }
    setActionLoading(notif.id);
    try {
      if (action === 'accepted') {
        const { data: result, error: acceptError } = await supabase.rpc('accept_trip_invite', { p_trip_id: tripId });
        if (acceptError) throw acceptError;
        if (!result?.success) {
          Alert.alert('Cannot Join', result?.message || 'This trip is already full.');
          return;
        }
      } else {
        const { error: memberError } = await supabase
          .from('trip_members')
          .update({ status: action })
          .eq('trip_id', tripId)
          .eq('user_id', user.id);
        if (memberError) throw memberError;
      }

      await markRead([notif.id]);
      Alert.alert('Success', action === 'accepted' ? 'You joined the trip!' : 'Invitation declined');
      fetchAll();
    } catch (error) {
      console.error('Error responding to invite:', error);
      Alert.alert('Error', 'Failed to respond to invitation');
    } finally {
      setActionLoading(null);
    }
  }, [user, actionLoading, markRead, fetchAll]);

  const followBack = useCallback(async (notif: AppNotification) => {
    if (!user?.id || !notif.sender_id || actionLoading) return;
    setActionLoading(notif.id);
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('is_private')
        .eq('id', notif.sender_id)
        .maybeSingle();
      const isPrivate = !!profile?.is_private;
      // upsert, not insert — a prior decline leaves a 'rejected' row occupying the
      // (follower_id, following_id) unique slot, which a plain insert would conflict on
      const { error } = await supabase.from('user_follows').upsert(
        { follower_id: user.id, following_id: notif.sender_id, status: isPrivate ? 'pending' : 'accepted' },
        { onConflict: 'follower_id,following_id' }
      );
      if (error) throw error;
      setFollowingSet((prev) => new Set(prev).add(notif.sender_id!));
    } catch (error) {
      console.error('Error following back:', error);
      Alert.alert('Error', 'Could not follow back');
    } finally {
      setActionLoading(null);
    }
  }, [user, actionLoading]);

  return {
    raw,
    postMeta,
    followingSet,
    loading,
    refreshing,
    actionLoading,
    onRefresh,
    markRead,
    markAllRead,
    respondFollowRequest,
    respondTripInvite,
    followBack,
  };
}
