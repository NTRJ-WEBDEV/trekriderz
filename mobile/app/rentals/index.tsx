import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FilterChip from '@/components/ui/FilterChip';
import EmptyState from '@/components/EmptyState';
import { supabase } from '@/lib/supabase';
import { matchesSearch, sortByKey, useDiscoveryList, discoveryEmptyState, type DiscoverySortKey, SORT_LABELS } from '@/lib/services/DiscoveryService';

// Discovery Engine Consolidation — query + search + sort now come from
// DiscoveryService (matching every other discovery screen). This
// screen's own richer card markup (year, fuel-included, type badge) is
// kept as-is rather than swapped for the compact adventure/RentalCard —
// that component is a smaller carousel-shaped card missing those fields,
// and replacing it here would remove information travellers currently
// see, which is a UX change outside this milestone's scope.
const SORTS: DiscoverySortKey[] = ['recent', 'budget_low', 'budget_high'];
// No "Recently Verified" sort here — rental_vehicles has no approved_at/
// verified_at column (confirmed against ApprovalService.ts's vehicle
// config, which sets no extra fields on approval), unlike homestays/
// guides. Not fabricated.

const VEHICLE_FILTERS = [
  { id: '',       label: 'All',    emoji: '🚦' },
  { id: 'bike',   label: 'Bike',   emoji: '🏍️' },
  { id: 'car',    label: 'Car',    emoji: '🚗' },
  { id: 'jeep',   label: 'Jeep',   emoji: '🚙' },
  { id: 'tempo',  label: 'Tempo',  emoji: '🚐' },
  { id: 'auto',   label: 'Auto',   emoji: '🛺' },
  { id: 'bus',    label: 'Bus',    emoji: '🚌' },
];

const TYPE_EMOJI: Record<string, string> = {
  bike: '🏍️', car: '🚗', jeep: '🚙', tempo: '🚐', auto: '🛺', bus: '🚌',
};

interface RentalVehicle {
  id: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: number | null;
  price_per_day: number;
  location: string;
  photos: string[];
  features: string[];
  fuel_included: boolean;
  is_available: boolean;
  created_at: string;
  seats: number | null;
  contact_phone: string;
  contact_whatsapp: string | null;
}

const RENTAL_VEHICLE_DETAIL_SELECT = 'id, vehicle_type, make, model, year, price_per_day, location, photos, features, fuel_included, is_available, created_at, seats, contact_phone, contact_whatsapp, status';

async function fetchAvailableVehicles(): Promise<RentalVehicle[]> {
  // This screen (unlike the Home tab / Discover tab) only ever shows
  // vehicles currently available to rent — a real, pre-existing behavior
  // difference, preserved exactly rather than folded into the shared
  // fetchVehicleRows(), which intentionally returns both available and
  // booked vehicles for contexts that show an "Available"/"Booked" badge.
  const { data } = await supabase
    .from('rental_vehicles')
    .select(RENTAL_VEHICLE_DETAIL_SELECT)
    .eq('status', 'approved')
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as RentalVehicle[]) || [];
}

export default function RentalsScreen() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState<DiscoverySortKey>('recent');

  const { data: vehicles, loading, refreshing, onRefresh } = useDiscoveryList<RentalVehicle>(fetchAvailableVehicles, []);

  const filtered = sortByKey(
    vehicles
      .filter((v) => matchesSearch([v.make, v.model, v.location], search))
      .filter((v) => !typeFilter || v.vehicle_type === typeFilter),
    sort,
    { price: (v) => v.price_per_day ?? null, createdAt: (v) => v.created_at }
  );
  const hasFilters = !!(search || typeFilter);
  const empty = discoveryEmptyState('vehicle', hasFilters);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(249,115,22,0.2)', '#080C14']}
        style={styles.bgGradient}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Rental Vehicles</Text>
            <Text style={styles.headerSub}>Bikes, cars, jeeps & more</Text>
          </View>
          <TouchableOpacity
            style={styles.listBtn}
            onPress={() => router.push('/rentals/register' as any)}
          >
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.listBtnText}>List</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by vehicle or location..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={VEHICLE_FILTERS}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.pill, typeFilter === f.id && styles.pillActive]}
              onPress={() => setTypeFilter(f.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillEmoji}>{f.emoji}</Text>
              <Text style={[styles.pillLabel, typeFilter === f.id && styles.pillLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Sort */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SORTS}
          keyExtractor={(s) => s}
          contentContainerStyle={styles.pillsRow}
          style={[styles.pillsScroll, { marginBottom: 4 }]}
          renderItem={({ item }) => <FilterChip label={SORT_LABELS[item]} selected={sort === item} onPress={() => setSort(item)} />}
        />

        {/* Count */}
        {!loading && (
          <Text style={styles.countText}>
            {filtered.length} {filtered.length === 1 ? 'vehicle' : 'vehicles'} available
          </Text>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#F97316" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(v) => v.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#F97316"
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={empty.icon as any}
                title={empty.title}
                subtitle={hasFilters ? 'Try a broader search or a different vehicle type.' : 'Be the first to list your vehicle for rent!'}
                actionLabel={hasFilters ? 'Clear Filters' : 'List Your Vehicle'}
                onAction={() => { if (hasFilters) { setSearch(''); setTypeFilter(''); } else { router.push('/rentals/register' as any); } }}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/rentals/${item.id}` as any)}
                activeOpacity={0.88}
              >
                {/* Photo */}
                <View style={styles.cardImgWrap}>
                  {item.photos?.[0] ? (
                    <Image
                      source={{ uri: item.photos[0] }}
                      style={styles.cardImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.cardImgPlaceholder}>
                      <Text style={{ fontSize: 36 }}>{TYPE_EMOJI[item.vehicle_type] || '🚗'}</Text>
                    </View>
                  )}
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {item.vehicle_type.toUpperCase()}
                    </Text>
                  </View>
                  {item.fuel_included && (
                    <View style={styles.fuelBadge}>
                      <Ionicons name="water" size={10} color="#FFF" />
                      <Text style={styles.fuelBadgeText}>Fuel</Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.make} {item.model}
                  </Text>
                  {item.year && (
                    <Text style={styles.cardYear}>{item.year}</Text>
                  )}
                  <View style={styles.cardLocRow}>
                    <Ionicons name="location-outline" size={12} color="#F97316" />
                    <Text style={styles.cardLoc} numberOfLines={1}>{item.location}</Text>
                  </View>
                  <View style={styles.cardPriceRow}>
                    <Text style={styles.cardPrice}>₹{item.price_per_day.toLocaleString()}</Text>
                    <Text style={styles.cardPriceUnit}>/day</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  listBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
  },
  listBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 10, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },

  pillsScroll: { height: 46, marginBottom: 10 },
  pillsRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  pillEmoji: { fontSize: 14 },
  pillLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  pillLabelActive: { color: '#FFF' },

  countText: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 20, marginBottom: 10,
  },

  list: { paddingHorizontal: 16, paddingBottom: 100 },

  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  cardImgWrap: { height: 120, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardImgPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: 'rgba(249,115,22,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(249,115,22,0.85)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.8 },
  fuelBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(34,197,94,0.85)',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  fuelBadgeText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  cardBody: { padding: 10 },
  cardName: { fontSize: 14, fontWeight: '800', color: '#FFF', marginBottom: 2 },
  cardYear: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardLoc: { fontSize: 11, color: '#F97316', flex: 1 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  cardPrice: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  cardPriceUnit: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#FFF' },
  emptySubtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.38)',
    textAlign: 'center', paddingHorizontal: 40, lineHeight: 19,
  },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#F97316',
    paddingHorizontal: 24, paddingVertical: 13,
    borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
