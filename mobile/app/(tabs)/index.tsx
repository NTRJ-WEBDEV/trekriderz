import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { GuidedExpedition } from '@/lib/expeditions';
import {
  fetchTripRows, fetchHomestayRows, fetchGuideRows, fetchVehicleRows, fetchExpeditionRows,
  mapTripToAdventureCard, mapTripToListingCard,
} from '@/lib/services/DiscoveryService';
import { AppColors, Spacing } from '@/constants/theme';
import Wordmark from '@/components/ui/Wordmark';
import EmptyState from '@/components/EmptyState';
import SkeletonLoader from '@/components/SkeletonLoader';
import BottomSheet from '@/components/ui/BottomSheet';
import ExpeditionCard from '@/components/ExpeditionCard';
import SectionHeader from '@/components/ui/SectionHeader';
import CategoryChip from '@/components/adventure/CategoryChip';
import FilterChip from '@/components/ui/FilterChip';
import SearchBar from '@/components/ui/SearchBar';
import HeroCarousel, { HeroSlide } from '@/components/adventure/HeroCarousel';
import AdventureCard, { AdventureCardData } from '@/components/adventure/AdventureCard';
import ListingCard, { ListingCardData } from '@/components/adventure/ListingCard';
import GuideCard, { GuideCardData } from '@/components/adventure/GuideCard';
import HomestayCard, { HomestayCardData } from '@/components/adventure/HomestayCard';
import RentalCard, { RentalCardData } from '@/components/adventure/RentalCard';
import ComingSoonCard, { ComingSoonItem } from '@/components/adventure/ComingSoonCard';

const QUICK_CHIPS = [
  { emoji: '🏔', label: 'Trek', route: '/discover?type=trek' },
  { emoji: '🏍', label: 'Bike Ride', route: '/rentals?type=bike' },
  { emoji: '🏕', label: 'Camping', route: '/discover?type=camping' },
  { emoji: '🏡', label: 'Homestay', route: '/homestays' },
  { emoji: '🧭', label: 'Guide', route: '/guides' },
  { emoji: '🚗', label: 'Rentals', route: '/rentals' },
  { emoji: '🌊', label: 'Waterfalls', route: '/discover?type=waterfall' },
  { emoji: '🌄', label: 'Sunrise', route: '/discover?type=sunrise' },
] as const;

const RENTAL_CATEGORIES = [
  { emoji: '🏍', label: 'Bike', type: 'bike' },
  { emoji: '🚗', label: 'Car', type: 'car' },
  { emoji: '⛺', label: 'Camping Gear', type: 'camping_gear' },
  { emoji: '🥾', label: 'Trekking Equipment', type: 'trekking_equipment' },
  { emoji: '📷', label: 'Action Camera', type: 'action_camera' },
  { emoji: '🚁', label: 'Drone', type: 'drone' },
  { emoji: '📍', label: 'GPS', type: 'gps' },
] as const;

const DIFFICULTY_FILTERS = ['easy', 'moderate', 'challenging', 'expert'];

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'monsoon',
    title: 'Monsoon Treks',
    subtitle: 'Western Ghats at its greenest',
    emoji: '🌧️',
    colors: ['#1E5631', '#080C14'],
    ctaLabel: 'Explore Treks',
    onPress: () => router.push('/discover?type=trek' as any),
  },
  {
    id: 'ladakh',
    title: 'Ladakh Season',
    subtitle: 'High-altitude expeditions are open',
    emoji: '🏔️',
    colors: ['#1E3A5F', '#080C14'],
    ctaLabel: 'View Expeditions',
    onPress: () => router.push('/expeditions' as any),
  },
  {
    id: 'goa',
    title: 'Goa Ride',
    subtitle: 'Coastal roads, rented rides',
    emoji: '🏍️',
    colors: ['#7C4A1E', '#080C14'],
    ctaLabel: 'Browse Rentals',
    onPress: () => router.push('/rentals' as any),
  },
  {
    id: 'custom',
    title: 'Custom Trips',
    subtitle: 'Birthdays, anniversaries, your way',
    emoji: '🎉',
    colors: ['#5B1E5F', '#080C14'],
    ctaLabel: 'Plan with AI',
    onPress: () => router.push('/ai-planner' as any),
  },
];

const COMING_SOON: ComingSoonItem[] = [
  { icon: 'sparkles-outline', title: 'AI Trip Planner', subtitle: 'A full itinerary, built for you' },
  { icon: 'map-outline', title: 'Offline Maps', subtitle: 'Navigate with zero signal' },
  { icon: 'partly-sunny-outline', title: 'Weather Intelligence', subtitle: 'Trail-precise forecasts' },
  { icon: 'bag-check-outline', title: 'Packing Assistant', subtitle: 'Smart lists for your trek' },
  { icon: 'shield-checkmark-outline', title: 'Travel Insurance', subtitle: 'Cover your adventure' },
  { icon: 'compass-outline', title: 'Local Finds', subtitle: 'Hidden spots, local tips' },
];

export default function AdventureScreen() {
  const { user } = useAuthStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const searchRef = useRef<TextInput>(null);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [rentalCategory, setRentalCategory] = useState<typeof RENTAL_CATEGORIES[number]['type']>('bike');

  const [treks, setTreks] = useState<AdventureCardData[]>([]);
  const [recommends, setRecommends] = useState<ListingCardData[]>([]);
  const [homestays, setHomestays] = useState<HomestayCardData[]>([]);
  const [guides, setGuides] = useState<GuideCardData[]>([]);
  const [rentals, setRentals] = useState<RentalCardData[]>([]);
  const [expeditions, setExpeditions] = useState<GuidedExpedition[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      // Every query + row→card mapping below now comes from
      // DiscoveryService — the single shared query/mapping layer also
      // used by the Discover tab and every browse screen (Discovery
      // Engine Consolidation milestone). This screen only decides limits
      // and which sections to show; it no longer knows table names or
      // column shapes itself.
      const [tripRows, featuredRows, guideItems, homestayItems, vehicleItems, expeditionRows] = await Promise.all([
        fetchTripRows({ featured: false, limit: 20 }),
        fetchTripRows({ featured: true, limit: 10 }),
        fetchGuideRows(20),
        fetchHomestayRows(20),
        fetchVehicleRows(30),
        fetchExpeditionRows(),
      ]);

      setTreks(tripRows.map(mapTripToAdventureCard));
      setRecommends(featuredRows.map((t) => mapTripToListingCard(t)));
      setGuides(guideItems);
      setHomestays(homestayItems);
      setRentals(vehicleItems);
      setExpeditions(expeditionRows);
    } catch (e) {
      console.error('Adventure load error:', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const q = search.toLowerCase();
  const filteredTreks = treks
    .filter((t) => !q || t.title.toLowerCase().includes(q) || t.location.toLowerCase().includes(q))
    .filter((t) => !difficultyFilter || (t.difficulty || '').toLowerCase() === difficultyFilter);

  const rentalsByCategory = rentals.filter((r: any) => r.vehicleType === rentalCategory);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header: logo left, search/filter/notification right */}
      <View style={styles.topBar}>
        <Wordmark size="sm" />
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => searchRef.current?.focus()} hitSlop={6}>
            <Ionicons name="search-outline" size={20} color={AppColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterVisible(true)} hitSlop={6}>
            <Ionicons name="options-outline" size={20} color={AppColors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/notifications' as any)} hitSlop={6}>
            <Ionicons name="notifications-outline" size={20} color={AppColors.text} />
            {unreadCount > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchSection}>
          <SearchBar ref={searchRef} value={search} onChangeText={setSearch} onFilterPress={() => setFilterVisible(true)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {QUICK_CHIPS.map((c) => (
              <CategoryChip key={c.label} emoji={c.emoji} label={c.label} onPress={() => router.push(c.route as any)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <HeroCarousel slides={HERO_SLIDES} />
        </View>

        {loading ? (
          <SkeletonSections />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load Adventure" subtitle="Check your connection and pull down to try again." />
        ) : (
          <>
            {/* Popular Treks */}
            <View style={styles.section}>
              <SectionHeader title="Popular Treks" subtitle="Public trips open to join" onSeeAll={() => router.push('/discover?type=trek' as any)} />
              {filteredTreks.length === 0 ? (
                <EmptyState icon="trail-sign-outline" title="No treks match yet" subtitle="Try a different search or filter." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {filteredTreks.map((item) => (
                    <AdventureCard key={item.id} item={item} onPress={() => router.push(`/trip/${item.id}` as any)} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* TrekRiderz Recommends */}
            {recommends.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="TrekRiderz Recommends" subtitle="Curated by our team" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {recommends.map((item) => (
                    <ListingCard key={item.id} item={item} onPress={() => router.push(`/trip/${item.id}` as any)} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Handpicked Homestays */}
            <View style={styles.section}>
              <SectionHeader title="Handpicked Homestays" onSeeAll={() => router.push('/homestays' as any)} />
              {homestays.length === 0 ? (
                <EmptyState icon="home-outline" title="No homestays listed yet" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {homestays.map((item) => (
                    <HomestayCard key={item.id} item={item} onPress={() => router.push(`/homestay/${item.id}` as any)} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Verified Guides */}
            <View style={styles.section}>
              <SectionHeader title="Verified Guides" onSeeAll={() => router.push('/guides' as any)} />
              {guides.length === 0 ? (
                <EmptyState icon="compass-outline" title="No guides listed yet" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {guides.map((item) => (
                    <GuideCard
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/guide/${item.id}` as any)}
                      onBookPress={() => router.push(`/guide/${item.id}` as any)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Rentals */}
            <View style={styles.section}>
              <SectionHeader title="Rentals" subtitle="Bikes, cars & adventure gear" onSeeAll={() => router.push('/rentals' as any)} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {RENTAL_CATEGORIES.map((c) => (
                  <CategoryChip
                    key={c.type}
                    emoji={c.emoji}
                    label={c.label}
                    active={rentalCategory === c.type}
                    onPress={() => setRentalCategory(c.type)}
                  />
                ))}
              </ScrollView>
              {rentalsByCategory.length === 0 ? (
                <EmptyState
                  icon="construct-outline"
                  title={rentalCategory === 'bike' || rentalCategory === 'car' ? 'No listings right now' : 'Coming soon for this category'}
                  subtitle={rentalCategory === 'bike' || rentalCategory === 'car' ? undefined : "We're still building this out — bikes and cars are live today."}
                />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {rentalsByCategory.map((item) => (
                    <RentalCard key={item.id} item={item} onPress={() => router.push(`/rentals/${item.id}` as any)} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Expeditions */}
            <View style={styles.section}>
              <SectionHeader title="Expeditions" subtitle="Leh · Spiti · EBC · Kedarkantha & beyond" onSeeAll={() => router.push('/expeditions' as any)} />
              {expeditions.length === 0 ? (
                <EmptyState icon="flag-outline" title="No expeditions published yet" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {expeditions.map((exp) => (
                    <View key={exp.id} style={{ width: 260 }}>
                      <ExpeditionCard expedition={exp} onPress={() => router.push(`/expeditions/${exp.id}` as any)} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Coming Soon */}
            <View style={styles.section}>
              <SectionHeader title="Coming Soon to TrekRiderz" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                {COMING_SOON.map((item) => (
                  <ComingSoonCard key={item.title} item={item} />
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>

      {/* Filter sheet — difficulty only today, real client-side filter on Popular Treks */}
      <BottomSheet visible={filterVisible} onClose={() => setFilterVisible(false)}>
        <Text style={styles.sheetTitle}>Filter Treks</Text>
        <Text style={styles.sheetLabel}>Difficulty</Text>
        <View style={styles.filterRow}>
          <FilterChip label="All" selected={!difficultyFilter} onPress={() => setDifficultyFilter(null)} />
          {DIFFICULTY_FILTERS.map((d) => (
            <FilterChip key={d} label={d[0].toUpperCase() + d.slice(1)} selected={difficultyFilter === d} onPress={() => setDifficultyFilter(d)} />
          ))}
        </View>
        <TouchableOpacity style={styles.sheetDoneBtn} onPress={() => setFilterVisible(false)}>
          <Text style={styles.sheetDoneText}>Done</Text>
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

function SkeletonSections() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.xl }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ gap: Spacing.sm }}>
          <SkeletonLoader width="45%" height={16} />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <SkeletonLoader width={200} height={180} borderRadius={16} />
            <SkeletonLoader width={200} height={180} borderRadius={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: AppColors.border,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: AppColors.card, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: AppColors.background,
  },
  scrollContent: { paddingBottom: 48 },
  searchSection: { marginTop: Spacing.lg, gap: Spacing.md },
  chipsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  section: { marginTop: Spacing.xl },
  cardRow: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  sheetTitle: { color: AppColors.text, fontSize: 17, fontWeight: '800', marginBottom: Spacing.lg },
  sheetLabel: { color: AppColors.subtext, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: Spacing.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  sheetDoneBtn: { backgroundColor: AppColors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetDoneText: { color: AppColors.background, fontWeight: '800', fontSize: 15 },
});
