import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#ADFF2F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';

type Vehicle = {
  id: string;
  make: string;
  model: string;
  vehicle_type: string;
  price_per_day: number;
  location: string;
  status: 'pending' | 'approved' | 'rejected';
  images: string[] | null;
  photos: any;
  created_at: string;
};

const STATUS_CONFIG = {
  pending:  { label: 'Under Review', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  approved: { label: 'Live',         color: '#22C55E', bg: 'rgba(34,197,94,0.15)'  },
  rejected: { label: 'Rejected',     color: '#EF4444', bg: 'rgba(239,68,68,0.15)'  },
} as const;

function coverPhoto(v: Vehicle): string | null {
  if (v.images && v.images.length > 0) return v.images[0];
  if (Array.isArray(v.photos) && v.photos.length > 0) return v.photos[0];
  if (v.photos && typeof v.photos === 'object' && v.photos.url) return v.photos.url;
  return null;
}

export default function MyVehiclesScreen() {
  const user = useAuthStore((s) => s.user);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVehicles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('rental_vehicles')
      .select('id, make, model, vehicle_type, price_per_day, location, status, images, photos, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setVehicles((data as Vehicle[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchVehicles();
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchVehicles();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Vehicles</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/rentals/register' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={BG} />
          </TouchableOpacity>
        </View>

        {vehicles.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(v) => v.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />
            }
            renderItem={({ item }) => (
              <VehicleCard
                vehicle={item}
                onPress={() => router.push(`/rentals/edit?id=${item.id}` as any)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  const cover = coverPhoto(vehicle);
  const status = STATUS_CONFIG[vehicle.status] ?? STATUS_CONFIG.pending;
  const displayName = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicle_type;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Cover photo */}
      <View style={styles.coverWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="car-outline" size={36} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.cardBody}>
        <Text style={styles.vehicleName} numberOfLines={1}>{displayName}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.4)" />
          <Text style={styles.metaText} numberOfLines={1}>{vehicle.location}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.price}>₹{vehicle.price_per_day.toLocaleString('en-IN')}<Text style={styles.perDay}>/day</Text></Text>
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>Edit</Text>
            <Ionicons name="chevron-forward" size={13} color={GREEN} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="car-outline" size={48} color="rgba(255,255,255,0.15)" />
      </View>
      <Text style={styles.emptyTitle}>No vehicles listed yet</Text>
      <Text style={styles.emptyText}>List your bike, car or jeep and earn by renting it to trekkers.</Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => router.push('/rentals/register' as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={18} color={BG} />
        <Text style={styles.emptyBtnText}>List a Vehicle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#FFF' },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 160 },
  coverPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  cardBody: { padding: 14 },
  vehicleName: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 18, fontWeight: '900', color: GREEN },
  perDay: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.4)' },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editHintText: { fontSize: 12, fontWeight: '700', color: GREEN },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: GREEN, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: BG },
});
