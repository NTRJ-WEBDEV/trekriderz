import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { searchPlaces } from '@/lib/geocoding';
import { fetchWeatherOpenMeteo, formatWeatherAge, WeatherData } from '@/lib/weather';
import { Ionicons } from '@expo/vector-icons';
import ExploreMapView, { MapMarker, TripPointCategory, TRIP_POINT_CATEGORIES } from '@/components/ExploreMapView';
import { setActiveTrailTripId, primeTrailCache } from '@/lib/offline-safety';
import { startLocationSharing } from '@/lib/location-service';

// Kept in sync with ExploreMapView's POI_EMOJI (the Leaflet-side map) —
// used here for the category picker and the Points & Stops list chips.
const CATEGORY_META: Record<TripPointCategory, { emoji: string; label: string }> = {
  waterfall: { emoji: '💧', label: 'Waterfall' },
  viewpoint: { emoji: '🌄', label: 'Viewpoint' },
  peak: { emoji: '⛰️', label: 'Peak' },
  campsite: { emoji: '⛺', label: 'Campsite' },
  temple: { emoji: '🛕', label: 'Temple' },
  other: { emoji: '📍', label: 'Place' },
  custom: { emoji: '📌', label: 'Custom Pin' },
};

interface TripPoint {
  id: string;
  poi_id: string | null;
  label: string;
  category: TripPointCategory;
  lat: number;
  lng: number;
  notes: string | null;
  added_by: string;
}

interface NearbyPoi {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
}

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️', 'partly-sunny': '⛅', cloudy: '☁️', 'cloud-outline': '🌫️',
  rainy: '🌧️', snow: '❄️', thunderstorm: '⛈️', moon: '🌙',
};

interface Member {
  id: string;
  name: string;
  avatar?: string;
  latitude?: number;
  longitude?: number;
  lastUpdate?: string;
}

export default function TripMapScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { user } = useAuthStore();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [points, setPoints] = useState<TripPoint[]>([]);
  const [nearbyPois, setNearbyPois] = useState<NearbyPoi[]>([]);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [addModal, setAddModal] = useState<{ lat: number; lng: number } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<TripPointCategory>('custom');
  const [saving, setSaving] = useState(false);

  const isOrganizer = trip?.created_by === user?.id;

  const loadData = useCallback(async () => {
    try {
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripData) {
        setTrip(tripData);
        // Use stored coordinates or geocode destination
        let dlat = tripData.lat ? parseFloat(tripData.lat) : null;
        let dlng = tripData.lng ? parseFloat(tripData.lng) : null;
        if (!dlat && tripData.destination) {
          try {
            const places = await searchPlaces(tripData.destination);
            if (places.length > 0) {
              [dlng, dlat] = places[0].center;
            }
          } catch (_) {}
        }
        if (dlat && dlng) {
          setDestLat(dlat);
          setDestLng(dlng);
          const w = await fetchWeatherOpenMeteo(dlat, dlng).catch(() => null);
          if (w) setWeather(w);

          // Rough ±0.5° bounding box (~55km) around the destination — enough
          // to surface nearby catalog POIs without a PostGIS radius query.
          const { data: poiRows } = await supabase
            .from('pois')
            .select('id, name, category, lat, lng')
            .eq('status', 'approved')
            .gte('lat', dlat - 0.5).lte('lat', dlat + 0.5)
            .gte('lng', dlng - 0.5).lte('lng', dlng + 0.5)
            .limit(50);
          setNearbyPois(poiRows || []);
        }

        // Trail recording is active only while today falls within the trip's
        // own dates — viewing a past or future trip's map doesn't start it.
        const todayStr = new Date().toISOString().split('T')[0];
        const isOngoing = tripData.start_date <= todayStr && todayStr <= tripData.end_date;
        if (isOngoing) {
          await setActiveTrailTripId(tripData.id);
          // Idempotent — no-ops if already running. Ensures trail recording
          // works even for a user who hasn't consented to member-location
          // sharing; the write-gate in updateDatabaseLocation() is what
          // actually stops their position from becoming visible to others.
          startLocationSharing().catch(() => {});
          primeTrailCache({
            tripId: tripData.id,
            tripTitle: tripData.title,
            tripEndDate: tripData.end_date,
            destinationLat: dlat ?? undefined,
            destinationLng: dlng ?? undefined,
          }).catch(() => {});
        }
      }

      const { data: membersData } = await supabase
        .from('trip_members')
        .select('user_id, users:user_id(id, full_name, avatar_url, last_latitude, last_longitude, last_location_update)')
        .eq('trip_id', tripId)
        .eq('status', 'accepted');

      const { data: pointRows } = await supabase
        .from('trip_points')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });
      setPoints(pointRows || []);

      const active: Member[] = (membersData || []).map((m: any) => ({
        id: m.users?.id,
        name: m.users?.full_name || 'Member',
        avatar: m.users?.avatar_url,
        latitude: m.users?.last_latitude ? parseFloat(m.users.last_latitude) : undefined,
        longitude: m.users?.last_longitude ? parseFloat(m.users.last_longitude) : undefined,
        lastUpdate: m.users?.last_location_update,
      })).filter((m: Member) => m.id);

      setMembers(active);
    } catch (error) {
      console.error('Trip map load error:', error);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadData();
    const sub = supabase
      .channel(`map-locations-${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => loadData())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [tripId, loadData]);

  const mapMarkers: MapMarker[] = [];

  // Member pins (only those who shared location)
  for (const m of members) {
    if (m.latitude && m.longitude) {
      mapMarkers.push({
        id: m.id,
        kind: 'member',
        name: m.name,
        lat: m.latitude,
        lng: m.longitude,
        sublabel: m.lastUpdate
          ? `Updated ${new Date(m.lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
          : 'Location shared',
      });
    }
  }

  // Destination pin
  if (destLat && destLng && trip?.destination) {
    mapMarkers.push({
      id: 'destination',
      kind: 'destination',
      name: trip.destination,
      lat: destLat,
      lng: destLng,
      sublabel: trip.title,
    });
  }

  // Saved trip points
  for (const p of points) {
    mapMarkers.push({
      id: `point-${p.id}`,
      kind: 'trip_point',
      name: p.label,
      lat: p.lat,
      lng: p.lng,
      sublabel: p.notes || undefined,
      extra: { category: p.category, pointId: p.id, addedBy: p.added_by },
    });
  }

  // Nearby catalog POIs not already added to this trip
  const addedPoiIds = new Set(points.map((p) => p.poi_id).filter(Boolean));
  for (const poi of nearbyPois) {
    if (addedPoiIds.has(poi.id)) continue;
    mapMarkers.push({
      id: `poi-${poi.id}`,
      kind: 'poi',
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      extra: { category: poi.category, poiId: poi.id },
    });
  }

  const membersWithLocation = members.filter((m) => m.latitude && m.longitude);
  const membersNoLocation = members.filter((m) => !m.latitude || !m.longitude);

  const handleMarkerTap = (marker: MapMarker) => {
    if (marker.kind === 'poi') {
      const category = (marker.extra?.category as string) || 'other';
      const poiId = (marker.extra?.poiId as string) || marker.id.replace(/^poi-/, '');
      Alert.alert('Add to Trip', `Add "${marker.name}" as a stop on this trip?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add', onPress: async () => {
            try {
              const { error } = await supabase.from('trip_points').insert({
                trip_id: tripId,
                poi_id: poiId,
                label: marker.name,
                category,
                lat: marker.lat,
                lng: marker.lng,
                added_by: user?.id,
              });
              if (error) throw error;
              loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not add point');
            }
          },
        },
      ]);
    } else if (marker.kind === 'trip_point') {
      const pointId = (marker.extra?.pointId as string) || marker.id.replace(/^point-/, '');
      const addedBy = marker.extra?.addedBy as string | undefined;
      if (!isOrganizer && addedBy !== user?.id) return;
      Alert.alert(marker.name, 'Remove this point from the trip?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              const { error } = await supabase.from('trip_points').delete().eq('id', pointId);
              if (error) throw error;
              loadData();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not remove point');
            }
          },
        },
      ]);
    }
  };

  const removePoint = (point: TripPoint) => {
    Alert.alert(point.label, 'Remove this point from the trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('trip_points').delete().eq('id', point.id);
            if (error) throw error;
            loadData();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not remove point');
          }
        },
      },
    ]);
  };

  const saveCustomPoint = async () => {
    if (!addModal || !newLabel.trim() || !user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('trip_points').insert({
        trip_id: tripId,
        label: newLabel.trim(),
        category: newCategory,
        lat: addModal.lat,
        lng: addModal.lng,
        added_by: user.id,
      });
      if (error) throw error;
      setAddModal(null);
      setNewLabel('');
      setNewCategory('custom');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add point');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header trip={null} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Loading trip map…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header trip={trip} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />

      {/* Offline safety view — sibling of the WebView map, not inside it, so
          it's reachable even if the map's WebView never loads (no network). */}
      <TouchableOpacity
        style={styles.trailViewBtn}
        onPress={() => router.push(`/trail-view?tripId=${tripId}` as any)}
        accessibilityLabel="Open offline trail view"
      >
        <Ionicons name="shield-checkmark-outline" size={16} color="#080C14" />
        <Text style={styles.trailViewBtnText}>Trail View</Text>
      </TouchableOpacity>

      {/* Weather bar for destination */}
      {weather && (
        <View style={styles.weatherBar}>
          <Text style={styles.weatherEmoji}>{WEATHER_EMOJI[weather.icon] || '🌤️'}</Text>
          <Text style={styles.weatherText}>
            {weather.currentTemp}°C · {weather.condition}
          </Text>
          {weather.isStale && weather.fetchedAt && (
            <Text style={styles.weatherStale}>· {formatWeatherAge(weather.fetchedAt)}</Text>
          )}
          {weather.wind > 0 && (
            <Text style={styles.weatherWind}>💨 {weather.wind} km/h</Text>
          )}
          <View style={styles.weatherSpacer} />
          {weather.forecast.slice(0, 2).map((f) => (
            <View key={f.day} style={styles.forecastItem}>
              <Text style={styles.forecastDay}>{f.day}</Text>
              <Text style={styles.forecastTemp}>{f.temp}°</Text>
            </View>
          ))}
        </View>
      )}

      {/* Map */}
      <ExploreMapView
        markers={mapMarkers}
        centerLat={focusPoint?.lat ?? destLat ?? undefined}
        centerLng={focusPoint?.lng ?? destLng ?? undefined}
        zoom={focusPoint ? 14 : destLat ? 10 : 5}
        onMarkerTap={handleMarkerTap}
        onMapLongPress={(lat, lng) => setAddModal({ lat, lng })}
      />

      {/* Members panel */}
      <View style={styles.membersPanel}>
        <View style={styles.membersPanelHeader}>
          <Text style={styles.membersPanelTitle}>
            {members.length} Member{members.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{membersWithLocation.length} sharing live</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersScroll}>
          {members.map((m) => {
            const hasLoc = !!(m.latitude && m.longitude);
            return (
              <View key={m.id} style={[styles.memberChip, !hasLoc && styles.memberChipDim]}>
                <View style={[styles.memberDot, { backgroundColor: hasLoc ? '#8CC63F' : 'rgba(255,255,255,0.2)' }]} />
                <Text style={styles.memberName}>{m.name.split(' ')[0]}</Text>
                {!hasLoc && <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.3)" />}
              </View>
            );
          })}
        </ScrollView>

        {membersNoLocation.length > 0 && (
          <Text style={styles.noLocHint}>
            {membersNoLocation.length} member{membersNoLocation.length > 1 ? 's' : ''} haven't shared location yet
          </Text>
        )}
      </View>

      {/* Points & Stops panel */}
      <View style={styles.membersPanel}>
        <View style={styles.membersPanelHeader}>
          <Text style={styles.membersPanelTitle}>
            {points.length} Point{points.length !== 1 ? 's' : ''} & Stops
          </Text>
          <Text style={styles.pointsHint}>Long-press map to add</Text>
        </View>

        {points.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersScroll}>
            {points.map((p) => {
              const meta = CATEGORY_META[p.category] || CATEGORY_META.custom;
              const canRemove = isOrganizer || p.added_by === user?.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.pointChip}
                  onPress={() => setFocusPoint({ lat: p.lat, lng: p.lng })}
                >
                  <Text style={styles.pointEmoji}>{meta.emoji}</Text>
                  <Text style={styles.memberName} numberOfLines={1}>{p.label}</Text>
                  {canRemove && (
                    <TouchableOpacity onPress={() => removePoint(p)} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.35)" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.noLocHint}>No points added yet — long-press anywhere on the map to drop a pin.</Text>
        )}
      </View>

      {/* Destination card */}
      {trip && (
        <View style={styles.destCard}>
          <Ionicons name="location" size={20} color="#8CC63F" />
          <View style={{ flex: 1 }}>
            <Text style={styles.destName}>{trip.destination}</Text>
            <Text style={styles.destDates}>
              {new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' – '}
              {new Date(trip.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={loadData}
            style={styles.refreshBtn}
          >
            <Ionicons name="refresh-outline" size={18} color="#8CC63F" />
          </TouchableOpacity>
        </View>
      )}

      {/* Add custom point modal */}
      <Modal visible={!!addModal} animationType="slide" transparent onRequestClose={() => setAddModal(null)}>
        <View style={styles.editOverlay}>
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Add a Point</Text>
              <TouchableOpacity onPress={() => setAddModal(null)}>
                <Ionicons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.editInput}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="What's here? (e.g. Sunset viewpoint)"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoFocus
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TRIP_POINT_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={styles.categoryChipText}>
                      {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.editSaveBtn, { opacity: newLabel.trim() && !saving ? 1 : 0.5 }]}
              onPress={saveCustomPoint}
              disabled={!newLabel.trim() || saving}
            >
              {saving ? <ActivityIndicator size="small" color="#080C14" /> : <Text style={styles.editSaveBtnText}>Add to Trip</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ trip, onBack }: { trip: any; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={24} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.headerTitle}>{trip?.title || 'Trip Map'}</Text>
        {trip?.destination && <Text style={styles.headerSub}>📍 {trip.destination}</Text>}
      </View>
      <View style={styles.headerBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBtn: { padding: 4, width: 36 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },

  weatherBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(140,198,63,0.07)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(140,198,63,0.15)',
  },
  weatherEmoji: { fontSize: 18 },
  weatherText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  weatherWind: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  weatherStale: { color: '#F59E0B', fontSize: 11, fontWeight: '700' },
  weatherSpacer: { flex: 1 },
  forecastItem: { alignItems: 'center', marginLeft: 10 },
  forecastDay: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' },
  forecastTemp: { color: '#8CC63F', fontSize: 12, fontWeight: '700' },

  membersPanel: {
    backgroundColor: '#0F1724',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 12, paddingBottom: 8,
  },
  membersPanelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8,
  },
  membersPanelTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#8CC63F' },
  liveText: { color: '#8CC63F', fontSize: 11, fontWeight: '600' },
  membersScroll: { paddingHorizontal: 12, gap: 8 },
  memberChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 14,
  },
  memberChipDim: { opacity: 0.45 },
  memberDot: { width: 7, height: 7, borderRadius: 3.5 },
  memberName: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  noLocHint: { color: 'rgba(255,255,255,0.3)', fontSize: 11, paddingHorizontal: 16, marginTop: 6 },

  destCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#080C14', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  destName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  destDates: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  trailViewBtn: {
    position: 'absolute', right: 14, bottom: 100, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  trailViewBtnText: { color: '#080C14', fontWeight: '800', fontSize: 12.5 },
  refreshBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 18,
  },

  pointsHint: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  pointChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 14, maxWidth: 160,
  },
  pointEmoji: { fontSize: 13 },

  editOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  editSheet: { backgroundColor: '#080C14', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  editTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  editInput: {
    color: '#FFF', backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 14, fontSize: 14,
  },
  editSaveBtn: {
    backgroundColor: '#8CC63F', borderRadius: 24,
    paddingVertical: 14, alignItems: 'center',
  },
  editSaveBtnText: { color: '#080C14', fontWeight: '800', fontSize: 15 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryChipActive: { backgroundColor: 'rgba(140,198,63,0.15)', borderColor: '#8CC63F' },
  categoryChipText: { color: '#FFF', fontSize: 12.5, fontWeight: '600' },
});
