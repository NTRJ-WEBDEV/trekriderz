import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useNotifications } from '@/hooks/useNotifications';
import { getTypeConfig } from '@/lib/notifications/registry';
import { groupNotifications, sectionNotifications, SectionedItem } from '@/lib/notifications/grouping';
import NotificationRow from '@/components/notifications/NotificationRow';

export default function NotificationsScreen() {
  const {
    raw, postMeta, followingSet, loading, refreshing, actionLoading,
    onRefresh, markRead, markAllRead, respondFollowRequest, respondTripInvite, followBack,
  } = useNotifications();

  const grouped = groupNotifications(raw);
  const sections = sectionNotifications(grouped);
  const unreadCount = raw.filter((n) => !n.is_read).length;

  const handlePress = (item: (typeof grouped)[number]) => {
    markRead(item.ids);
    const cfg = getTypeConfig(item.type);
    const route = cfg.getRoute(item);
    if (route) router.push(route as any);
  };

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
        data={sections}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8CC63F" colors={['#8CC63F']} />
        }
        renderItem={({ item }: { item: SectionedItem }) => {
          if (item.kind === 'header') {
            return <Text style={styles.sectionHeader}>{item.label}</Text>;
          }
          const n = item.notification;
          return (
            <NotificationRow
              item={n}
              postMeta={postMeta}
              followingSet={followingSet}
              actionLoading={actionLoading}
              onPress={() => handlePress(n)}
              onFollowRequest={(action) => respondFollowRequest(n, action)}
              onTripInvite={(action) => respondTripInvite(n, action)}
              onFollowBack={() => followBack(n)}
            />
          );
        }}
        removeClippedSubviews
        maxToRenderPerBatch={12}
        windowSize={8}
        initialNumToRender={12}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={72} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptySubtitle}>You have no notifications yet. When someone interacts with your trips or posts, you'll see it here.</Text>
          </View>
        }
        contentContainerStyle={sections.length === 0 && styles.emptyFlex}
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
