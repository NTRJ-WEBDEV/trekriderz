import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { searchPlaces } from '@/lib/geocoding';
import { fetchWeatherOpenMeteo, WeatherData } from '@/lib/weather';
import ExploreMapView, { MapMarker, MarkerKind } from '@/components/ExploreMapView';

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️', 'partly-sunny': '⛅', cloudy: '☁️', 'cloud-outline': '🌫️',
  rainy: '🌧️', snow: '❄️', thunderstorm: '⛈️', moon: '🌙',
};

type FilterKind = 'all' | MarkerKind;

const FILTERS: { kind: FilterKind; label: string; emoji: string }[] = [
  { kind: 'all',       label: 'All',        emoji: '🗺️' },
  { kind: 'homestay',  label: 'Homestays',  emoji: '🏠' },
  { kind: 'guide',     label: 'Guides',     emoji: '👤' },
  { kind: 'expedition',label: 'Expeditions',emoji: '⛰️' },
];

interface SelectedMarker extends MapMarker {
  description?: string;
  fullData?: Record<string, unknown>;
}

export default function ExploreMapScreen() {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [allMarkers, setAllMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [selected, setSelected] = useState<SelectedMarker | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const markers: MapMarker[] = [];

    // User location
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        const w = await fetchWeatherOpenMeteo(lat, lng);
        if (w) setWeather(w);
      }
    } catch (_) {}

    // Homestays (have lat/lng in DB)
    try {
      const { data: homestays } = await supabase
        .from('homestays')
        .select('id, name, location, lat, lng, category, price_per_night, rating')
        .eq('status', 'approved')
        .not('lat', 'is', null)
        .limit(50);

      for (const h of homestays || []) {
        if (!h.lat || !h.lng) continue;
        markers.push({
          id: h.id,
          kind: 'homestay',
          name: h.name,
          lat: h.lat,
          lng: h.lng,
          sublabel: h.location || h.category,
          price: h.price_per_night ? `₹${h.price_per_night}/night` : undefined,
          rating: h.rating,
          extra: { category: h.category, price_per_night: h.price_per_night },
        });
      }
    } catch (_) {}

    // Guides — use saved lat/lng (from registration) or geocode location
    try {
      const { data: guides } = await supabase
        .from('guides')
        .select('id, name, location, lat, lng, specialties, rate_per_day, rating, is_premium')
        .eq('is_verified', true)
        .limit(30);

      for (const g of guides || []) {
        let glat = g.lat;
        let glng = g.lng;
        if (!glat && g.location) {
          try {
            const places = await searchPlaces(g.location);
            if (places.length > 0) {
              [glng, glat] = places[0].center;
            }
          } catch (_) {}
        }
        if (!glat || !glng) continue;
        const specs = Array.isArray(g.specialties) ? g.specialties.join(', ') : g.specialties;
        markers.push({
          id: g.id,
          kind: 'guide',
          name: g.name,
          lat: glat,
          lng: glng,
          sublabel: specs || g.location,
          price: g.rate_per_day ? `₹${g.rate_per_day}/day` : undefined,
          rating: g.rating,
          extra: { is_premium: g.is_premium, rate_per_day: g.rate_per_day },
        });
      }
    } catch (_) {}

    // Expeditions — geocode destination
    try {
      const { data: expeditions } = await supabase
        .from('guided_expeditions')
        .select('id, title, destination, difficulty, start_date, price_per_person, available_seats, max_participants')
        .eq('status', 'published')
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true })
        .limit(20);

      for (const ex of expeditions || []) {
        if (!ex.destination) continue;
        try {
          const places = await searchPlaces(ex.destination);
          if (places.length === 0) continue;
          const [elng, elat] = places[0].center;
          const seatsLeft = ex.max_participants - (ex.available_seats ?? 0);
          const dateLabel = ex.start_date
            ? new Date(ex.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
            : '';
          markers.push({
            id: ex.id,
            kind: 'expedition',
            name: ex.title,
            lat: elat,
            lng: elng,
            sublabel: `${dateLabel} · ${ex.difficulty || ''}`,
            price: ex.price_per_person ? `₹${ex.price_per_person}/person` : undefined,
            extra: { available_seats: ex.available_seats, difficulty: ex.difficulty, start_date: ex.start_date },
          });
        } catch (_) {}
      }
    } catch (_) {}

    setAllMarkers(markers);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const visibleMarkers = filter === 'all'
    ? allMarkers
    : allMarkers.filter((m) => m.kind === filter);

  const handleMarkerTap = (marker: MapMarker) => {
    setSelected(marker as SelectedMarker);
  };

  const handleViewDetails = () => {
    if (!selected) return;
    setSelected(null);
    switch (selected.kind) {
      case 'homestay':
        router.push(`/homestay/${selected.id}` as any);
        break;
      case 'guide':
        router.push(`/guide/${selected.id}` as any);
        break;
      case 'expedition':
        router.push(`/expeditions/${selected.id}` as any);
        break;
    }
  };

  const countsByKind: Record<string, number> = {};
  for (const m of allMarkers) {
    countsByKind[m.kind] = (countsByKind[m.kind] || 0) + 1;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Explore Map</Text>
          {weather && (
            <Text style={styles.headerSub}>
              {WEATHER_EMOJI[weather.icon] || '🌤️'} {weather.currentTemp}°C · {weather.condition}
              {userLat ? ' · Near you' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={loadData} style={styles.headerBtn}>
          <Ionicons name="refresh-outline" size={22} color="#8CC63F" />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const count = f.kind === 'all' ? allMarkers.length : (countsByKind[f.kind] || 0);
          const active = filter === f.kind;
          return (
            <TouchableOpacity
              key={f.kind}
              onPress={() => setFilter(f.kind)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={styles.chipEmoji}>{f.emoji}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Map */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Finding places near you…</Text>
        </View>
      ) : (
        <ExploreMapView
          markers={visibleMarkers}
          userLat={userLat}
          userLng={userLng}
          onMarkerTap={handleMarkerTap}
          zoom={userLat ? 9 : 6}
        />
      )}

      {/* Bottom sheet for selected marker */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        />
        {selected && (
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            <View style={styles.sheetKindRow}>
              <View style={[styles.sheetKindBadge, { backgroundColor: kindColor(selected.kind) + '22' }]}>
                <Text style={[styles.sheetKindText, { color: kindColor(selected.kind) }]}>
                  {kindEmoji(selected.kind)} {kindLabel(selected.kind)}
                </Text>
              </View>
            </View>

            <Text style={styles.sheetName}>{selected.name}</Text>
            {selected.sublabel ? <Text style={styles.sheetSub}>{selected.sublabel}</Text> : null}

            {selected.rating ? (
              <Text style={styles.sheetRating}>
                {'★'.repeat(Math.round(selected.rating))} {selected.rating.toFixed(1)}
              </Text>
            ) : null}

            {selected.price ? (
              <Text style={styles.sheetPrice}>{selected.price}</Text>
            ) : null}

            {/* Weather for this location */}
            {selected.kind !== 'member' && (
              <WeatherInline lat={selected.lat} lng={selected.lng} />
            )}

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetBtnPrimary} onPress={handleViewDetails}>
                <Text style={styles.sheetBtnPrimaryText}>
                  {selected.kind === 'guide' ? 'Book Guide' : selected.kind === 'homestay' ? 'Book Stay' : 'View Expedition'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetBtnSecondary}
                onPress={() => {
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`;
                  Linking.openURL(mapsUrl);
                }}
              >
                <Ionicons name="navigate-outline" size={16} color="#8CC63F" />
                <Text style={styles.sheetBtnSecondaryText}>Get Directions</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function WeatherInline({ lat, lng }: { lat: number; lng: number }) {
  const [w, setW] = useState<WeatherData | null>(null);
  useEffect(() => {
    fetchWeatherOpenMeteo(lat, lng).then(setW).catch(() => {});
  }, [lat, lng]);
  if (!w) return null;
  return (
    <View style={styles.inlineWeather}>
      <Text style={styles.inlineWeatherEmoji}>{WEATHER_EMOJI[w.icon] || '🌤️'}</Text>
      <Text style={styles.inlineWeatherText}>{w.currentTemp}°C · {w.condition}</Text>
      {w.wind > 0 && <Text style={styles.inlineWeatherWind}>💨 {w.wind} km/h</Text>}
    </View>
  );
}

function kindColor(kind: MarkerKind): string {
  const map: Record<MarkerKind, string> = {
    homestay: '#F97316', guide: '#8B5CF6', expedition: '#8CC63F', member: '#3B82F6', destination: '#8CC63F',
  };
  return map[kind] || '#8CC63F';
}
function kindEmoji(kind: MarkerKind): string {
  const map: Record<MarkerKind, string> = {
    homestay: '🏠', guide: '👤', expedition: '⛰️', member: '🧑', destination: '📍',
  };
  return map[kind] || '📍';
}
function kindLabel(kind: MarkerKind): string {
  const map: Record<MarkerKind, string> = {
    homestay: 'Homestay', guide: 'Guide', expedition: 'Expedition', member: 'Member', destination: 'Destination',
  };
  return map[kind] || kind;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  headerSub: { color: '#8CC63F', fontSize: 12, marginTop: 1 },

  filterScroll: { maxHeight: 52 },
  filterRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: 'rgba(140,198,63,0.15)', borderColor: '#8CC63F' },
  chipEmoji: { fontSize: 13 },
  chipLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: '#8CC63F' },
  chipBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
  },
  chipBadgeActive: { backgroundColor: '#8CC63F' },
  chipBadgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
  chipBadgeTextActive: { color: '#080C14' },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  // Bottom sheet
  sheetOverlay: { flex: 1 },
  sheet: {
    backgroundColor: '#0F1724',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  sheetKindRow: { marginBottom: 8 },
  sheetKindBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  sheetKindText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sheetName: { color: '#FFF', fontSize: 20, fontWeight: '800', lineHeight: 26, marginBottom: 4 },
  sheetSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 4 },
  sheetRating: { color: '#F59E0B', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  sheetPrice: { color: '#8CC63F', fontSize: 16, fontWeight: '800', marginBottom: 8 },

  inlineWeather: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginVertical: 10,
  },
  inlineWeatherEmoji: { fontSize: 20 },
  inlineWeatherText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  inlineWeatherWind: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 4 },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetBtnPrimary: {
    flex: 1, backgroundColor: '#8CC63F',
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  sheetBtnPrimaryText: { color: '#080C14', fontSize: 15, fontWeight: '800' },
  sheetBtnSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(140,198,63,0.1)', borderWidth: 1, borderColor: '#8CC63F',
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
  },
  sheetBtnSecondaryText: { color: '#8CC63F', fontSize: 14, fontWeight: '700' },
});
