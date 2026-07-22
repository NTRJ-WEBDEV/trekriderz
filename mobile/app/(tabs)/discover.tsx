import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import EmptyState from '@/components/EmptyState';
import GuideCard from '@/components/adventure/GuideCard';
import HomestayCard from '@/components/adventure/HomestayCard';
import RentalCard from '@/components/adventure/RentalCard';
import {
  fetchTripRows, fetchGuideRows, fetchHomestayRows, fetchVehicleRows,
  matchesSearch, useDiscoveryList, discoveryEmptyState, perPersonBudgetOf,
} from '@/lib/services/DiscoveryService';

const GREEN = AppColors.primary;
const BG = AppColors.background;
const CARD = AppColors.card;
const BORDER = AppColors.border;

type Section = 'trips' | 'guides' | 'homestays' | 'vehicles';

const SECTIONS: { key: Section; label: string; emoji: string }[] = [
  { key: 'trips',     label: 'Trips',     emoji: '🗺️' },
  { key: 'guides',    label: 'Guides',    emoji: '🧭' },
  { key: 'homestays', label: 'Homestays', emoji: '🏡' },
  { key: 'vehicles',  label: 'Vehicles',  emoji: '🏍️' },
];

const TRIP_EMOJI: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒',
  weekend: '🌄', car_ride: '🚗', spiritual: '🙏', wildlife: '🦁', photography: '📸',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Discovery Engine Consolidation — this screen used to run its own four
// supabase queries (two of them against legacy `homestays`/`rentals`
// tables). All four now come from DiscoveryService (same source the Home
// tab and every browse screen use). Guides/homestays/vehicles rendering
// also now reuses the shared adventure/*Card components instead of this
// screen's own duplicate local versions. Trips keeps its own card: it
// shows "Partner Wanted" status and trip-creator attribution that the
// shared AdventureCard (built for the Home tab's read-only trek carousel)
// has no fields for — reusing it here would silently drop that
// information rather than just look different, so it's kept local
// rather than forced into a shared component that doesn't fit.
interface DiscoverData {
  tripRows: any[];
  guideItems: any[];
  homestayItems: any[];
  vehicleItems: any[];
}

const EMPTY_DATA: DiscoverData = { tripRows: [], guideItems: [], homestayItems: [], vehicleItems: [] };

export default function DiscoverScreen() {
  const [section, setSection] = useState<Section>('trips');
  const [search, setSearch] = useState('');

  // useDiscoveryList is array-shaped (it's built for listing screens); this
  // screen fetches four sections in one round trip, so it's used with a
  // singleton array holding the combined bundle rather than adding a
  // second, near-identical hook just for this one screen.
  const { data, loading, refreshing, onRefresh } = useDiscoveryList<DiscoverData>(async () => {
    const [tripRows, guideItems, homestayItems, vehicleItems] = await Promise.all([
      fetchTripRows({ limit: 40 }),
      fetchGuideRows(40),
      fetchHomestayRows(40),
      fetchVehicleRows(40),
    ]);
    return [{ tripRows, guideItems, homestayItems, vehicleItems }];
  }, []);
  const discoverData = data[0] || EMPTY_DATA;

  const q = search.toLowerCase();
  const filteredTrips = discoverData.tripRows.filter((t) => matchesSearch([t.title, t.destination], q));
  const filteredGuides = discoverData.guideItems.filter((g) => matchesSearch([g.name, g.location], q));
  const filteredHomestays = discoverData.homestayItems.filter((h) => matchesSearch([h.name, h.location], q));
  const filteredVehicles = discoverData.vehicleItems.filter((v) => matchesSearch([v.title, v.location], q));

  const counts: Record<Section, number> = {
    trips: filteredTrips.length, guides: filteredGuides.length,
    homestays: filteredHomestays.length, vehicles: filteredVehicles.length,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity onPress={() => router.push('/map' as any)} style={styles.mapBtn}>
          <Ionicons name="map-outline" size={18} color={GREEN} />
          <Text style={styles.mapBtnText}>Map</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.35)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search guides, stays, trips…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionScroll}
        contentContainerStyle={styles.sectionList}
      >
        {SECTIONS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sectionTab, section === s.key && styles.sectionTabActive]}
            onPress={() => setSection(s.key)}
          >
            <Text style={styles.sectionEmoji}>{s.emoji}</Text>
            <Text style={[styles.sectionLabel, section === s.key && styles.sectionLabelActive]}>
              {s.label} · {counts[s.key]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
        >
          <ContentForSection
            section={section}
            trips={filteredTrips}
            guides={filteredGuides}
            homestays={filteredHomestays}
            vehicles={filteredVehicles}
            search={search}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ContentForSection({ section, trips, guides, homestays, vehicles, search }: {
  section: Section; trips: any[]; guides: any[]; homestays: any[]; vehicles: any[]; search: string;
}) {
  const items = section === 'trips' ? trips : section === 'guides' ? guides : section === 'homestays' ? homestays : vehicles;

  if (items.length === 0) {
    const { icon, title, subtitle } = discoveryEmptyState(
      section === 'trips' ? 'trip' : section === 'guides' ? 'guide' : section === 'homestays' ? 'homestay' : 'vehicle',
      !!search
    );
    return (
      <EmptyState
        icon={icon as any} title={title} subtitle={subtitle}
        actionLabel={section === 'trips' && !search ? 'Plan a Trip' : undefined}
        onAction={section === 'trips' && !search ? () => router.push('/create' as any) : undefined}
      />
    );
  }

  if (section === 'trips') {
    return (
      <View style={{ gap: 12 }}>
        {trips.map((t) => <TripCard key={t.id} item={t} />)}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {section === 'guides' && guides.map((g) => (
        <GuideCard key={g.id} item={g} onPress={() => router.push(`/guide/${g.id}` as any)} onBookPress={() => router.push(`/guide/${g.id}` as any)} />
      ))}
      {section === 'homestays' && homestays.map((h) => (
        <HomestayCard key={h.id} item={h} onPress={() => router.push(`/homestay/${h.id}` as any)} />
      ))}
      {section === 'vehicles' && vehicles.map((v) => (
        <RentalCard key={v.id} item={v} onPress={() => router.push(`/rentals/${v.id}` as any)} />
      ))}
    </View>
  );
}

function TripCard({ item }: { item: any }) {
  const creator = Array.isArray(item.creator) ? item.creator[0] : item.creator;
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/trip/${item.id}` as any)} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.tripEmojiWrap}>
          <Text style={styles.tripEmoji}>{TRIP_EMOJI[item.trip_type] || '🗺️'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={GREEN} />
            <Text style={styles.metaText} numberOfLines={1}>{item.destination}</Text>
          </View>
          <Text style={styles.metaText}>
            {formatDate(item.start_date)} → {formatDate(item.end_date)}
          </Text>
        </View>
        {item.looking_for_partner && (
          <View style={styles.partnerBadge}>
            <Text style={styles.partnerBadgeText}>Partner Wanted</Text>
          </View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.footerChip}>👥 {item.group_size} people</Text>
        <Text style={styles.footerChip}>₹{perPersonBudgetOf(item).toLocaleString('en-IN')}/person</Text>
        {creator?.full_name && (
          <Text style={styles.footerCreator}>by {creator.full_name.split(' ')[0]}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(140,198,63,0.12)', borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  mapBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  sectionScroll: { marginBottom: 12 },
  sectionList: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  sectionTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
  },
  sectionTabActive: { backgroundColor: 'rgba(140,198,63,0.12)', borderColor: 'rgba(140,198,63,0.35)' },
  sectionEmoji: { fontSize: 14 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  sectionLabelActive: { color: GREEN },
  list: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  metaText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  footerChip: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  footerCreator: { marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  partnerBadge: {
    backgroundColor: 'rgba(167,139,250,0.15)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
  },
  partnerBadgeText: { color: '#A78BFA', fontSize: 10, fontWeight: '700' },
  tripEmojiWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(140,198,63,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  tripEmoji: { fontSize: 24 },
});
