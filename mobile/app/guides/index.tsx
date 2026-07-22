import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing } from '@/constants/theme';
import SearchBar from '@/components/ui/SearchBar';
import FilterChip from '@/components/ui/FilterChip';
import EmptyState from '@/components/EmptyState';
import GuideCard from '@/components/adventure/GuideCard';
import {
  fetchGuideRows, matchesSearch, sortByKey, useDiscoveryList, discoveryEmptyState,
  type GuideListItem, type DiscoverySortKey, SORT_LABELS,
} from '@/lib/services/DiscoveryService';

// Discovery Engine Consolidation — same pattern as /homestays: query,
// mapping, sort, and search all come from DiscoveryService.

const SORTS: DiscoverySortKey[] = ['rating', 'verified', 'budget_low', 'budget_high'];

export default function GuidesBrowseScreen() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DiscoverySortKey>('rating');

  const { data: rows, loading, refreshing, onRefresh } = useDiscoveryList<GuideListItem>(() => fetchGuideRows(100), []);

  const filtered = sortByKey(
    rows.filter((r) => matchesSearch([r.name, r.location], search)),
    sort,
    { price: (r) => r.ratePerDay ?? null, createdAt: (r) => r.createdAt, verifiedAt: (r) => r.verifiedAt, rating: (r) => r.rating ?? null }
  );

  const empty = discoveryEmptyState('guide', !!search);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Ionicons name="arrow-back" size={20} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guides</Text>
        <TouchableOpacity style={styles.listBtn} onPress={() => router.push('/guide/register' as any)}>
          <Ionicons name="add" size={16} color={AppColors.background} />
          <Text style={styles.listBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: Spacing.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search guides or locations…" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={{ maxHeight: 44, marginBottom: Spacing.md }}>
        {SORTS.map((s) => <FilterChip key={s} label={SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />)}
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
              actionLabel={search ? 'Clear Search' : undefined}
              onAction={search ? () => setSearch('') : undefined}
            />
          ) : (
            <View style={styles.grid}>
              {filtered.map((item) => (
                <GuideCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/guide/${item.id}` as any)}
                  onBookPress={() => router.push(`/guide/${item.id}` as any)}
                />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'space-between' },
});
