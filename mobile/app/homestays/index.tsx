import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing } from '@/constants/theme';
import SearchBar from '@/components/ui/SearchBar';
import FilterChip from '@/components/ui/FilterChip';
import EmptyState from '@/components/EmptyState';
import HomestayCard from '@/components/adventure/HomestayCard';
import {
  fetchHomestayRows, matchesSearch, sortByKey, useDiscoveryList, discoveryEmptyState,
  type HomestayListItem, type DiscoverySortKey, SORT_LABELS,
} from '@/lib/services/DiscoveryService';

// Discovery Engine Consolidation — data (query + mapping + sort + search)
// now comes entirely from DiscoveryService, the same layer the Home tab
// and Discover tab use. This screen only owns its own filter UI (property
// type) and layout.

const SORTS: DiscoverySortKey[] = ['recent', 'verified', 'budget_low', 'budget_high'];

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

export default function HomestaysBrowseScreen() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DiscoverySortKey>('recent');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const { data: rows, loading, refreshing, onRefresh } = useDiscoveryList<HomestayListItem>(() => fetchHomestayRows(100), []);

  const filtered = sortByKey(
    rows
      .filter((r) => matchesSearch([r.name, r.location], search))
      .filter((r) => !typeFilter || r.propertyType.includes(typeFilter)),
    sort,
    { price: (r) => r.pricePerNight ?? null, createdAt: (r) => r.createdAt, verifiedAt: (r) => r.approvedAt }
  );

  const hasFilters = !!search || !!typeFilter;
  const empty = discoveryEmptyState('homestay', hasFilters);

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={{ maxHeight: 44, marginBottom: Spacing.sm }}>
        {SORTS.map((s) => <FilterChip key={s} label={SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />)}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={{ maxHeight: 44, marginBottom: Spacing.md }}>
        <FilterChip label="All Types" selected={!typeFilter} onPress={() => setTypeFilter(null)} />
        {PROPERTY_TYPES.map((t) => (
          <FilterChip key={t.value} label={t.label} selected={typeFilter === t.value} onPress={() => setTypeFilter(t.value)} />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={AppColors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />}
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={empty.icon as any} title={empty.title} subtitle={empty.subtitle}
              actionLabel={hasFilters ? 'Clear Filters' : 'List Your Property'}
              onAction={() => { if (hasFilters) { setSearch(''); setTypeFilter(null); } else { router.push('/host/create' as any); } }}
            />
          ) : (
            <View style={styles.grid}>
              {filtered.map((item) => (
                <HomestayCard key={item.id} item={item} onPress={() => router.push(`/homestay/${item.id}` as any)} />
              ))}
            </View>
          )}
        </ScrollView>
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
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  // flexWrap grid, not a fixed numColumns FlatList — HomestayCard has its
  // own intrinsic width (built for horizontal carousels), so it wraps
  // naturally to however many fit per row instead of being forced into
  // uneven fixed columns that clip or leave gaps on narrower screens.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'space-between' },
});
