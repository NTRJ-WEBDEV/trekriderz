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
import GuideCard, { GuideCardData } from '@/components/adventure/GuideCard';

// Traveller Discovery Experience — same gap as /homestays: the Home tab's
// "Verified Guides" section already linked "See All" to /guides, but the
// route 404'd. Reuses GuideCard as-is.

type SortKey = 'rating' | 'verified' | 'budget_low' | 'budget_high';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Top Rated' },
  { key: 'verified', label: 'Recently Verified' },
  { key: 'budget_low', label: 'Budget: Low to High' },
  { key: 'budget_high', label: 'Budget: High to Low' },
];

interface Row extends GuideCardData {
  verifiedAt: string | null;
}

export default function GuidesBrowseScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('rating');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('guides')
      .select('id, name, full_name, location, languages, experience_years, rating, total_reviews, rate_per_day, photo_url, profile_photo_url, status, verified_at')
      .eq('status', 'approved')
      .limit(100);

    setRows((data || []).map((g: any) => ({
      id: g.id,
      photoUrl: g.photo_url || g.profile_photo_url,
      name: g.full_name || g.name,
      location: g.location,
      languages: Array.isArray(g.languages) ? g.languages : null,
      experienceYears: g.experience_years,
      treksCompleted: null,
      rating: g.rating,
      totalReviews: g.total_reviews,
      verified: true, // this query only ever fetches status='approved'
      ratePerDay: g.rate_per_day,
      verifiedAt: g.verified_at,
    })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();
  let filtered = rows.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q));

  filtered = [...filtered].sort((a, b) => {
    if (sort === 'verified') return (b.verifiedAt || '').localeCompare(a.verifiedAt || '');
    if (sort === 'budget_low') return (a.ratePerDay ?? Infinity) - (b.ratePerDay ?? Infinity);
    if (sort === 'budget_high') return (b.ratePerDay ?? -Infinity) - (a.ratePerDay ?? -Infinity);
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

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

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={SORTS} keyExtractor={(s) => s.key}
        contentContainerStyle={styles.chipsRow}
        style={{ maxHeight: 44, marginBottom: Spacing.md }}
        renderItem={({ item }) => <FilterChip label={item.label} selected={sort === item.key} onPress={() => setSort(item.key)} />}
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
              icon="compass-outline"
              title={search ? 'No guides match yet' : 'No guides listed yet'}
              subtitle={search ? 'Try a different search term.' : 'Check back soon — new guides are verified regularly.'}
              actionLabel={search ? 'Clear Search' : undefined}
              onAction={search ? () => setSearch('') : undefined}
            />
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <GuideCard
                item={item}
                onPress={() => router.push(`/guide/${item.id}` as any)}
                onBookPress={() => router.push(`/guide/${item.id}` as any)}
              />
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
