import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useExpeditionStore } from '@/stores/expeditionStore';
import ExpeditionCard from '@/components/ExpeditionCard';
import EmptyState from '@/components/EmptyState';
import { sortByKey, minExpeditionPackagePrice, type DiscoverySortKey, SORT_LABELS } from '@/lib/services/DiscoveryService';

// Discovery Engine Consolidation — sort logic (previously a local
// minPackagePrice() + inline .sort()) now comes from DiscoveryService,
// shared with every other discovery screen. The expedition query itself
// was already correctly shared (useExpeditionStore → fetchExpeditions()
// in lib/expeditions.ts) — nothing to consolidate there.
const DIFFICULTY_FILTERS = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Challenging', value: 'challenging' },
  { label: 'Expert', value: 'expert' },
];

const SORTS: DiscoverySortKey[] = ['recent', 'budget_low', 'budget_high'];

export default function BrowseExpeditionsScreen() {
  const { expeditions, loading, error, fetchExpeditions, setFilters, filters } =
    useExpeditionStore();
  const [activeDifficulty, setActiveDifficulty] = useState<string | null>(null);
  const [sort, setSort] = useState<DiscoverySortKey>('recent');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchExpeditions();
  }, []);

  const handleDifficultyFilter = (value: string | null) => {
    setActiveDifficulty(value);
    setFilters({ ...filters, difficulty: value ?? undefined });
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchExpeditions();
    setRefreshing(false);
  }, [fetchExpeditions]);

  return (
    <View style={styles.container}>
      {/* Header gradient */}
      <LinearGradient
        colors={['#8CC63F', '#080C14']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.35 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Expeditions</Text>
            <Text style={styles.headerSubtitle}>Join guided group adventures</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Difficulty Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
          style={styles.filtersContainer}
        >
          {DIFFICULTY_FILTERS.map((filter) => {
            const isActive = activeDifficulty === filter.value;
            return (
              <TouchableOpacity
                key={filter.label}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => handleDifficultyFilter(filter.value)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
          style={[styles.filtersContainer, { marginTop: -4 }]}
        >
          {SORTS.map((s) => {
            const isActive = sort === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSort(s)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{SORT_LABELS[s]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8CC63F" />
            <Text style={styles.loadingText}>Finding expeditions...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.15)" />
            <Text style={styles.errorText}>Failed to load expeditions</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchExpeditions()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#8CC63F"
              />
            }
          >
            {expeditions.length === 0 ? (
              <EmptyState
                icon="map-outline"
                title="No expeditions found"
                subtitle={activeDifficulty
                  ? `No ${activeDifficulty} expeditions available right now.`
                  : 'Check back soon — new adventures are added regularly!'}
                actionLabel={activeDifficulty ? 'Clear Filter' : undefined}
                onAction={activeDifficulty ? () => handleDifficultyFilter(null) : undefined}
              />
            ) : (
              <View style={styles.cardList}>
                {sortByKey(expeditions, sort, { price: minExpeditionPackagePrice, createdAt: (e) => e.created_at }).map((expedition) => (
                  <ExpeditionCard key={expedition.id} expedition={expedition} onPress={() => router.push(`/expeditions/${expedition.id}` as any)} />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  filtersContainer: {
    maxHeight: 52,
    marginBottom: 8,
  },
  filtersScroll: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
  },
  retryBtn: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  cardList: {
    gap: 16,
  },
});
