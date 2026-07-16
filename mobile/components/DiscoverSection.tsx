import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const GREEN = '#8CC63F';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

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

// ── Discover: browse public trips, guides, homestays & vehicles — embedded in Home ──
// Rendered inline with .map() (not FlatList) since it lives inside Home's ScrollView;
// nesting a FlatList in a ScrollView triggers RN's VirtualizedList warning/crash.
export default function DiscoverSection() {
  const [section, setSection] = useState<Section>('trips');
  const [search, setSearch] = useState('');

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
        .limit(20),
      supabase
        .from('guides')
        .select('id, name, location, specializations, experience_years, rate_per_day, rating, photo_url, languages')
        .eq('status', 'approved')
        .order('rating', { ascending: false })
        .limit(20),
      supabase
        .from('homestays')
        .select('id, name, location, price_per_night, photos, amenities, rating')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('rentals')
        .select('id, vehicle_type, vehicle_name, location, price_per_day, photos, owner:users!owner_id(full_name)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setTrips(tripsRes.data || []);
    setGuides(guidesRes.data || []);
    setHomestays(homestaysRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();
  const filteredTrips = trips.filter(t => !q || t.title?.toLowerCase().includes(q) || t.destination?.toLowerCase().includes(q));
  const filteredGuides = guides.filter(g => !q || g.name?.toLowerCase().includes(q) || g.location?.toLowerCase().includes(q));
  const filteredHomestays = homestays.filter(h => !q || h.name?.toLowerCase().includes(q) || h.location?.toLowerCase().includes(q));
  const filteredVehicles = vehicles.filter(v => !q || v.vehicle_name?.toLowerCase().includes(q) || v.location?.toLowerCase().includes(q));

  const items =
    section === 'trips' ? filteredTrips
    : section === 'guides' ? filteredGuides
    : section === 'homestays' ? filteredHomestays
    : filteredVehicles;

  return (
    <View style={styles.container}>
      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>Discover</Text>
        <TouchableOpacity onPress={() => router.push('/map' as any)} style={styles.mapBtn}>
          <Ionicons name="map-outline" size={16} color={GREEN} />
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionList}>
        {SECTIONS.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sectionTab, section === s.key && styles.sectionTabActive]}
            onPress={() => setSection(s.key)}
          >
            <Text style={styles.sectionEmoji}>{s.emoji}</Text>
            <Text style={[styles.sectionLabel, section === s.key && styles.sectionLabelActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={GREEN} /></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{SECTIONS.find(s => s.key === section)?.emoji}</Text>
          <Text style={styles.emptyText}>No {section} found</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            if (section === 'trips') return <TripCard key={item.id} item={item} />;
            if (section === 'guides') return <GuideCard key={item.id} item={item} />;
            if (section === 'homestays') return <HomestayCard key={item.id} item={item} />;
            return <VehicleCard key={item.id} item={item} />;
          })}
        </View>
      )}
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
          <Text style={styles.metaText}>{formatDate(item.start_date)} → {formatDate(item.end_date)}</Text>
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
        {creator?.full_name && <Text style={styles.footerCreator}>by {creator.full_name.split(' ')[0]}</Text>}
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
      {photos[0] && <Image source={{ uri: photos[0] }} style={styles.cardImage} contentFit="cover" />}
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
      {photos[0] && <Image source={{ uri: photos[0] }} style={styles.cardImage} contentFit="cover" />}
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.vehicle_name || item.vehicle_type}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={GREEN} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
            {owner?.full_name && <Text style={styles.metaText}>by {owner.full_name}</Text>}
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
  container: { marginTop: 28 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(140,198,63,0.12)', borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  mapBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: BORDER, marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },

  sectionList: { gap: 8, paddingBottom: 14 },
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

  center: { paddingVertical: 40, alignItems: 'center' },
  list: { gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  card: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 150 },
  cardBody: { padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  metaText: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
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
