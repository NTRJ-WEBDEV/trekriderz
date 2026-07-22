import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { AppColors, Spacing } from '@/constants/theme';
import SearchBar from '@/components/ui/SearchBar';
import FilterChip from '@/components/ui/FilterChip';
import EmptyState from '@/components/EmptyState';
import HomestayCard, { HomestayCardData } from '@/components/adventure/HomestayCard';

// Traveller Discovery Experience — this screen didn't exist before; the
// Home tab's "Handpicked Homestays" section already linked its "See All"
// to /homestays, but the route 404'd. Reuses HomestayCard (already built
// for the Home tab carousel) rather than a new card shape.

type SortKey = 'recent' | 'verified' | 'budget_low' | 'budget_high';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'verified', label: 'Recently Verified' },
  { key: 'budget_low', label: 'Budget: Low to High' },
  { key: 'budget_high', label: 'Budget: High to Low' },
];

const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: 'private_room', label: 'Private Room' },
  { value: 'entire_home', label: 'Entire Home' },
  { value: 'villa', label: 'Villa / Bungalow' },
  { value: 'dormitory', label: 'Dormitory / Hostel' },
  { value: 'tent_camping', label: 'Tent / Camping' },
  { value: 'treehouse', label: 'Treehouse' },
  { value: 'farmstay', label: 'Farmstay' },
  { value: 'heritage_home', label: 'Heritage Home' },
];

interface Row extends HomestayCardData {
  approvedAt: string | null;
  createdAt: string;
  propertyType: string[];
}

export default function HomestaysBrowseScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('properties')
      .select('id, name, city, state, photos, amenities, property_type, status, created_at, approved_at, room_types(base_price)')
      .eq('status', 'approved')
      .limit(100);

    setRows((data || []).map((h: any) => {
      const basePrices = (h.room_types || []).map((r: any) => r.base_price).filter((p: any) => typeof p === 'number');
      return {
        id: h.id,
        image: Array.isArray(h.photos) ? h.photos[0] : null,
        name: h.name,
        location: [h.city, h.state].filter(Boolean).join(', '),
        pricePerNight: basePrices.length > 0 ? Math.min(...basePrices) : null,
        rating: null,
        amenities: Array.isArray(h.amenities) ? h.amenities : null,
        verified: true, // this query only ever fetches status='approved'
        approvedAt: h.approved_at,
        createdAt: h.created_at,
        propertyType: Array.isArray(h.property_type) ? h.property_type : [],
      };
    }));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();
  let filtered = rows
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q))
    .filter((r) => !typeFilter || r.propertyType.includes(typeFilter));

  filtered = [...filtered].sort((a, b) => {
    if (sort === 'verified') return (b.approvedAt || '').localeCompare(a.approvedAt || '');
    if (sort === 'budget_low') return (a.pricePerNight ?? Infinity) - (b.pricePerNight ?? Infinity);
    if (sort === 'budget_high') return (b.pricePerNight ?? -Infinity) - (a.pricePerNight ?? -Infinity);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Ionicons name="arrow-back" size={20} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Homestays</Text>
        <TouchableOpacity style={styles.listBtn} onPress={() => router.push('/host/create' as any)}>
          <Ionicons name="add" size={16} color={AppColors.background} />
          <Text style={styles.listBtnText}>List</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: Spacing.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search homestays or cities…" />
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={SORTS} keyExtractor={(s) => s.key}
        contentContainerStyle={styles.chipsRow}
        style={{ maxHeight: 44, marginBottom: Spacing.sm }}
        renderItem={({ item }) => <FilterChip label={item.label} selected={sort === item.key} onPress={() => setSort(item.key)} />}
      />

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={PROPERTY_TYPES} keyExtractor={(t) => t.value}
        contentContainerStyle={styles.chipsRow}
        style={{ maxHeight: 44, marginBottom: Spacing.md }}
        ListHeaderComponent={<FilterChip label="All Types" selected={!typeFilter} onPress={() => setTypeFilter(null)} />}
        renderItem={({ item }) => <FilterChip label={item.label} selected={typeFilter === item.value} onPress={() => setTypeFilter(item.value)} />}
      />

      {loading ? (
        <ActivityIndicator size="large" color={AppColors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: Spacing.md, paddingHorizontal: Spacing.lg }}
          contentContainerStyle={{ gap: Spacing.md, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={AppColors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="home-outline"
              title={search || typeFilter ? 'No homestays match yet' : 'No homestays listed yet'}
              subtitle={search || typeFilter ? 'Try a broader search or clear the type filter.' : 'Be the first to list a homestay on TrekRiderz.'}
              actionLabel={search || typeFilter ? 'Clear Filters' : 'List Your Property'}
              onAction={() => { if (search || typeFilter) { setSearch(''); setTypeFilter(null); } else { router.push('/host/create' as any); } }}
            />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <HomestayCard item={item} onPress={() => router.push(`/homestay/${item.id}` as any)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: AppColors.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: AppColors.text, fontSize: 20, fontWeight: '800' },
  listBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: AppColors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
  },
  listBtnText: { color: AppColors.background, fontSize: 13, fontWeight: '800' },
  chipsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
});
