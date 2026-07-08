import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type TabType = 'upcoming' | 'past';

export default function MyBookingsScreen() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (error) throw error;

      const enhancedBookings = await Promise.all(
        (data || []).map(async (booking) => {
          if (booking.resource_type === 'homestay') {
            const { data: homestay } = await supabase
              .from('homestays')
              .select('name, location')
              .eq('id', booking.resource_id)
              .single();
            return {
              ...booking,
              resource: homestay || { name: 'Homestay', location: '' },
            };
          } else if (booking.resource_type === 'guide') {
            const { data: guide } = await supabase
              .from('guides')
              .select('name, specialization')
              .eq('id', booking.resource_id)
              .single();
            return {
              ...booking,
              resource: {
                name: guide?.name || 'Guide',
                location: guide?.specialization || 'Guide Services',
              },
            };
          }
          return booking;
        })
      );

      setBookings(enhancedBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const today = new Date();
  const upcomingBookings = bookings.filter(
    (b) => new Date(b.end_date) >= today && b.status !== 'cancelled'
  );
  const pastBookings = bookings.filter(
    (b) => new Date(b.end_date) < today || b.status === 'cancelled'
  );
  const displayedBookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Confirmed' };
      case 'pending':
        return { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Pending' };
      case 'cancelled':
        return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Cancelled' };
      case 'completed':
        return { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Completed' };
      default:
        return { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', label: status };
    }
  };

  const renderBookingItem = ({ item }: { item: any }) => {
    const statusConfig = getStatusConfig(item.status);
    const startDate = new Date(item.start_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const endDate = new Date(item.end_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/booking-details/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardIconWrap}>
            <Ionicons
              name={item.resource_type === 'guide' ? 'person-outline' : 'home-outline'}
              size={22}
              color="#8CC63F"
            />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.resourceName} numberOfLines={1}>
              {item.resource?.name || 'Booking'}
            </Text>
            <Text style={styles.resourceLocation} numberOfLines={1}>
              {item.resource?.location || ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.dateText}>
              {startDate} → {endDate}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.4)" />
            <Text style={styles.dateText}>{item.guests_count} guests</Text>
          </View>
          <Text style={styles.priceText}>₹{item.total_price?.toLocaleString('en-IN')}</Text>
        </View>

        {item.payment_status === 'unpaid' && item.status !== 'cancelled' && (
          <View style={styles.payNowBanner}>
            <Ionicons name="warning-outline" size={14} color="#F59E0B" />
            <Text style={styles.payNowText}>Payment pending</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
          {upcomingBookings.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{upcomingBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>Past</Text>
          {pastBookings.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pastBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8CC63F" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              size={64}
              color="rgba(255,255,255,0.08)"
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'upcoming'
                ? 'Start exploring homestays and guides'
                : 'Your completed trips will appear here'}
            </Text>
            {activeTab === 'upcoming' && (
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <Text style={styles.exploreBtnText}>Explore Now</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
    gap: 14,
    flexGrow: 1,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  resourceName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  resourceLocation: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  priceText: {
    marginLeft: 'auto',
    color: '#8CC63F',
    fontSize: 16,
    fontWeight: '800',
  },
  payNowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    padding: 8,
  },
  payNowText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  exploreBtn: {
    marginTop: 8,
    backgroundColor: '#8CC63F',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
  },
  exploreBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
