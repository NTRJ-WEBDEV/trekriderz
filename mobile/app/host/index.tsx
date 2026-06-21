import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';

export default function HostDashboard() {
  const { user } = useAuthStore();
  const [homestays, setHomestays] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHostData();
  }, []);

  const loadHostData = async () => {
    if (!user) return;
    try {
      const { data: hs } = await supabase
        .from('homestays')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      setHomestays(hs || []);

      if (hs && hs.length > 0) {
        const hsIds = hs.map((h) => h.id);
        const { data: bk } = await supabase
          .from('bookings')
          .select('*, users:user_id(full_name, avatar_url)')
          .in('resource_id', hsIds)
          .order('created_at', { ascending: false })
          .limit(20);
        setBookings(bk || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHostData();
  };

  const getStatusColor = (s: string) => {
    const map: any = {
      pending: '#FBBF24',
      confirmed: '#22C55E',
      cancelled: '#EF4444',
      completed: '#3B82F6',
    };
    return map[s] || '#9CA3AF';
  };

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const totalRevenue = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_price || 0), 0);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Host Panel</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/host/create' as any)}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8CC63F" />
        }
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Properties" value={homestays.length.toString()} icon="home-outline" />
          <StatCard label="Pending" value={pendingCount.toString()} icon="time-outline" color="#FBBF24" />
          <StatCard
            label="Revenue"
            value={`₹${(totalRevenue / 1000).toFixed(0)}k`}
            icon="cash-outline"
            color="#8CC63F"
          />
        </View>

        {/* Verification / Status Card */}
        <View style={styles.verificationCard}>
          <View style={styles.vIconCircle}>
            <Ionicons name="shield-checkmark" size={22} color="#8CC63F" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vTitle}>Property Status</Text>
            <Text style={styles.vSub}>
              {homestays.some((h) => h.status === 'pending')
                ? 'Some properties are under review by our team.'
                : homestays.length === 0
                ? 'Add your first property to start hosting adventurers.'
                : 'All your properties are active and accepting bookings!'}
            </Text>
          </View>
        </View>

        {/* Properties */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Properties</Text>
          <TouchableOpacity onPress={() => router.push('/host/create' as any)}>
            <Text style={styles.sectionAction}>+ Add New</Text>
          </TouchableOpacity>
        </View>

        {homestays.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="home-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>No properties listed yet</Text>
            <TouchableOpacity
              style={styles.addPropertyBtn}
              onPress={() => router.push('/host/create' as any)}
            >
              <Text style={styles.addPropertyBtnText}>List Your Property</Text>
            </TouchableOpacity>
          </View>
        ) : (
          homestays.map((h) => (
            <TouchableOpacity
              key={h.id}
              style={styles.propertyCard}
              onPress={() => router.push(`/homestay/${h.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(h.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.propertyName}>{h.name}</Text>
                <Text style={styles.propertySub}>
                  {h.location} • ₹{h.price_per_night?.toLocaleString('en-IN')}/night
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(h.status) + '20' }]}>
                <Text style={[styles.statusPillText, { color: getStatusColor(h.status) }]}>
                  {h.status || 'pending'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))
        )}

        {/* Recent Bookings */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Recent Booking Requests</Text>
        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>No booking requests yet</Text>
          </View>
        ) : (
          bookings.slice(0, 10).map((b) => (
            <TouchableOpacity
              key={b.id}
              style={styles.bookingCard}
              onPress={() => router.push(`/booking-details/${b.id}` as any)}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri:
                    b.users?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      b.users?.full_name || 'Guest'
                    )}&background=1a2a1a&color=8CC63F`,
                }}
                style={styles.miniAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.bookerName}>{b.users?.full_name || 'Guest'}</Text>
                <Text style={styles.bookerSub}>
                  {b.guests_count} guests • {new Date(b.start_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <View>
                <Text style={styles.bookingAmount}>
                  ₹{b.total_price?.toLocaleString('en-IN')}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(b.status) + '20' },
                  ]}
                >
                  <Text
                    style={[styles.statusBadgeText, { color: getStatusColor(b.status) }]}
                  >
                    {b.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = '#FFF',
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={20} color={color === '#FFF' ? '#8CC63F' : color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8CC63F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(140,198,63,0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 28,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.15)',
  },
  vIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(140,198,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vTitle: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 3,
  },
  vSub: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 14,
  },
  sectionAction: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
  },
  propertyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  propertyName: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 3,
  },
  propertySub: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  miniAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(140,198,63,0.1)',
  },
  bookerName: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 3,
  },
  bookerSub: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  bookingAmount: {
    color: '#8CC63F',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
    marginBottom: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
  },
  addPropertyBtn: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  addPropertyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
