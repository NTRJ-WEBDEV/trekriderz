import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

type Section = 'trips' | 'guides' | 'homestays' | 'vehicles';

const SECTIONS: { key: Section; label: string; emoji: string; icon: any }[] = [
  { key: 'trips',     label: 'Trips',     emoji: '🗺️',  icon: 'map-outline' },
  { key: 'guides',    label: 'Guides',    emoji: '🧭',  icon: 'compass-outline' },
  { key: 'homestays', label: 'Homestays', emoji: '🏡',  icon: 'home-outline' },
  { key: 'vehicles',  label: 'Vehicles',  emoji: '🏍️', icon: 'car-outline' },
];

const TRIP_EMOJI: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒',
  weekend: '🌄', car_ride: '🚗', spiritual: '🙏', wildlife: '🦁', photography: '📸',
};

// trips.budget means different things depending on budget_type ('total' vs
// 'per_person') — this always returns the per-person figure regardless of
// which one a given trip was created with.
function perPersonBudgetOf(trip: { budget?: number | null; budget_type?: string; group_size?: number | null }) {
  const budget = trip.budget || 0;
  if (trip.budget_type === 'per_person') return budget;
  return Math.round(budget / (trip.group_size || 1));
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DiscoverScreen() {
  const { user } = useAuthStore();
  const [section, setSection] = useState<Section>('trips');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [trips, setTrips] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [homestays, setHomestays] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [tripsRes, guidesRes, homestaysRes, vehiclesRes] = await Promise.all([
      supabase
        .from('trips')
        .select('id, title, destination, start_date, end_date, trip_type, group_size, budget, budget_type, looking_for_partner, creator:users!created_by(full_name, avatar_url)')
        .eq('is_public', true)
        .in('status', ['planning', 'confirmed'])
        .gte('end_date', today)
        .order('start_date', { ascending: true })
        .limit(40),
      supabase
        .from('guides')
        .select('id, name, location, specializations, experience_years, rate_per_day, rating, photo_url, languages')
        .eq('status', 'approved')
        .order('rating', { ascending: false })
        .limit(40),
      supabase
        .from('homestays')
        .select('id, name, location, price_per_night, photos, amenities, rating')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('rentals')
        .select('id, vehicle_type, vehicle_name, location, price_per_day, photos, owner:users!owner_id(full_name)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40),
    ]);
    setTrips(tripsRes.data || []);
    setGuides(guidesRes.data || []);
    setHomestays(homestaysRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const q = search.toLowerCase();

  const filteredTrips = trips.filter(t =>
    !q || t.title?.toLowerCase().includes(q) || t.destination?.toLowerCase().includes(q)
  );
  const filteredGuides = guides.filter(g =>
    !q || g.name?.toLowerCase().includes(q) || g.location?.toLowerCase().includes(q)
  );
  const filteredHomestays = homestays.filter(h =>
    !q || h.name?.toLowerCase().includes(q) || h.location?.toLowerCase().includes(q)
  );
  const filteredVehicles = vehicles.filter(v =>
    !q || v.vehicle_name?.toLowerCase().includes(q) || v.location?.toLowerCase().includes(q)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity onPress={() => router.push('/map' as any)} style={styles.mapBtn}>
          <Ionicons name="map-outline" size={18} color={GREEN} />
          <Text style={styles.mapBtnText}>Map</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
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

      {/* Section tabs */}
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
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : (
        <FlatList
          data={
            section === 'trips' ? filteredTrips
            : section === 'guides' ? filteredGuides
            : section === 'homestays' ? filteredHomestays
            : filteredVehicles
          }
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>
                {SECTIONS.find(s => s.key === section)?.emoji}
              </Text>
              <Text style={styles.emptyText}>No {section} found</Text>
              {section === 'trips' && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/create' as any)}>
                  <Text style={styles.emptyBtnText}>Plan a Trip</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            if (section === 'trips') return <TripCard item={item} />;
            if (section === 'guides') return <GuideCard item={item} />;
            if (section === 'homestays') return <HomestayCard item={item} />;
            return <VehicleCard item={item} />;
          }}
        />
      )}
    </SafeAreaView>
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

function GuideCard({ item }: { item: any }) {
  const specs: string[] = Array.isArray(item.specializations) ? item.specializations : [];
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/guide/${item.id}` as any)} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.guideAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.guideAvatar, styles.guideAvatarFallback]}>
            <Text style={styles.guideInitial}>{item.name?.charAt(0) || 'G'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={GREEN} />
            <Text style={styles.metaText}>{item.location || 'Location not set'}</Text>
          </View>
          <Text style={styles.metaText}>{item.experience_years}yr exp · ₹{(item.rate_per_day || 0).toLocaleString('en-IN')}/day</Text>
        </View>
        {item.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>
      {specs.length > 0 && (
        <View style={styles.specRow}>
          {specs.slice(0, 3).map((s, i) => (
            <View key={i} style={styles.specChip}>
              <Text style={styles.specText}>{s.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function HomestayCard({ item }: { item: any }) {
  const photos: string[] = Array.isArray(item.photos) ? item.photos : [];
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/homestay/${item.id}` as any)} activeOpacity={0.8}>
      {photos[0] && (
        <Image source={{ uri: photos[0] }} style={styles.cardImage} contentFit="cover" />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={GREEN} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          </View>
          <View style={styles.pricePill}>
            <Text style={styles.priceText}>₹{(item.price_per_night || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.priceUnit}>/night</Text>
          </View>
        </View>
        {item.rating && (
          <View style={styles.metaRow}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.metaText}>{Number(item.rating).toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function VehicleCard({ item }: { item: any }) {
  const photos: string[] = Array.isArray(item.photos) ? item.photos : [];
  const owner = Array.isArray(item.owner) ? item.owner[0] : item.owner;
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/rentals/${item.id}` as any)} activeOpacity={0.8}>
      {photos[0] && (
        <Image source={{ uri: photos[0] }} style={styles.cardImage} contentFit="cover" />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.vehicle_name || item.vehicle_type}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={GREEN} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
            {owner?.full_name && (
              <Text style={styles.metaText}>by {owner.full_name}</Text>
            )}
          </View>
          <View style={styles.pricePill}>
            <Text style={styles.priceText}>₹{(item.price_per_day || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.priceUnit}>/day</Text>
          </View>
        </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 16 },
  emptyBtn: { backgroundColor: GREEN, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: CARD, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 160 },
  cardBody: { padding: 14, gap: 8 },
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
  guideAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: GREEN },
  guideAvatarFallback: { backgroundColor: 'rgba(140,198,63,0.1)', justifyContent: 'center', alignItems: 'center' },
  guideInitial: { color: GREEN, fontSize: 20, fontWeight: '800' },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  ratingText: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 14 },
  specChip: {
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  specText: { color: GREEN, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  pricePill: { alignItems: 'flex-end' },
  priceText: { color: GREEN, fontSize: 16, fontWeight: '800' },
  priceUnit: { color: 'rgba(255,255,255,0.35)', fontSize: 10 },
});
