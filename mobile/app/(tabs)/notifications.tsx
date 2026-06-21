import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Notification {
  id: string;
  created_at: string;
  type: 'like' | 'comment' | 'follow' | 'trip_invite' | 'booking';
  content: string;
  message?: string;
  is_read: boolean;
  sender_id?: string;
  related_id?: string;
  metadata?: any;
  users?: {
    full_name: string;
    avatar_url: string;
  };
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(dateStr)) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          users:sender_id (full_name, avatar_url)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const channel = supabase
        .channel(`user_notifications:${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => fetchNotifications()
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unread.map((n) => n.id));
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const markRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error marking read:', err);
    }
  };

  const handleRespond = async (notif: Notification, action: 'accepted' | 'declined') => {
    if (!user || actionLoading) return;

    const tripId = notif.related_id || notif.metadata?.trip_id;
    if (!tripId) {
      Alert.alert('Error', 'Missing trip information');
      return;
    }

    setActionLoading(notif.id);
    try {
      const { error: memberError } = await supabase
        .from('trip_members')
        .update({ status: action })
        .eq('trip_id', tripId)
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id);

      Alert.alert('Success', action === 'accepted' ? 'You joined the trip!' : 'Invitation declined');

      if (action === 'accepted') {
        router.push(`/trip/${tripId}`);
      }

      fetchNotifications();
    } catch (error) {
      console.error('Error responding to invite:', error);
      Alert.alert('Error', 'Failed to respond to invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getIcon = (type: string): any => {
    switch (type) {
      case 'like': return 'heart';
      case 'comment': return 'chatbubble';
      case 'trip_invite': return 'airplane';
      case 'follow': return 'person-add';
      case 'booking': return 'receipt';
      default: return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'like': return '#ED4956';
      case 'comment': return '#3897F0';
      case 'trip_invite': return '#8CC63F';
      case 'follow': return '#A855F7';
      case 'booking': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isInvite = item.type === 'trip_invite';
    const msg = item.message || item.content;
    const iconColor = getIconColor(item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => !item.is_read && markRead(item.id)}
        style={[styles.notificationItem, !item.is_read && styles.unread]}
      >
        {!item.is_read && <View style={styles.unreadDot} />}

        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={getIcon(item.type)} size={20} color={iconColor} />
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.content} numberOfLines={isInvite ? undefined : 2}>
            <Text style={styles.senderName}>{item.users?.full_name || 'TrekRiderz'}</Text>
            {'  '}{msg}
          </Text>
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>

          {isInvite && !item.is_read && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.acceptBtn]}
                onPress={() => handleRespond(item, 'accepted')}
                disabled={!!actionLoading}
              >
                {actionLoading === item.id ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.btnText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.declineBtn]}
                onPress={() => handleRespond(item, 'declined')}
                disabled={!!actionLoading}
              >
                <Text style={[styles.btnText, { color: '#EF4444' }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const todayNotifs = notifications.filter((n) => isToday(n.created_at));
  const earlierNotifs = notifications.filter((n) => !isToday(n.created_at));
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const sections = [
    ...(todayNotifs.length > 0 ? [{ type: 'header', label: 'Today', id: 'h-today' }, ...todayNotifs.map((n) => ({ ...n, type: 'item' }))] : []),
    ...(earlierNotifs.length > 0 ? [{ type: 'header', label: 'Earlier', id: 'h-earlier' }, ...earlierNotifs.map((n) => ({ ...n, type: 'item' }))] : []),
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8CC63F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications" size={22} color="#8CC63F" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={sections as any[]}
        keyExtractor={(item) => item.id || item.type + item.label}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CC63F"
            colors={['#8CC63F']}
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={styles.sectionHeader}>{item.label}</Text>;
          }
          return renderItem({ item });
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={72} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>You have no notifications yet. When someone interacts with your trips or invites you, you'll see it here.</Text>
          </View>
        }
        contentContainerStyle={notifications.length === 0 && styles.emptyFlex}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#8CC63F',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#080C14',
    fontSize: 11,
    fontWeight: '700',
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.4)',
  },
  markAllText: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  unread: {
    backgroundColor: 'rgba(140,198,63,0.05)',
  },
  unreadDot: {
    position: 'absolute',
    left: 5,
    top: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8CC63F',
    marginTop: -3,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  senderName: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  time: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  acceptBtn: {
    backgroundColor: '#8CC63F',
  },
  declineBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFlex: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
