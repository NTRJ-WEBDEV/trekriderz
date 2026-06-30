import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { searchPlaces } from '@/lib/geocoding';
import { fetchWeatherOpenMeteo, WeatherData } from '@/lib/weather';
import { Ionicons } from '@expo/vector-icons';
import ExploreMapView, { MapMarker } from '@/components/ExploreMapView';

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
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

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
        }
      }

      const { data: membersData } = await supabase
        .from('trip_members')
        .select('user_id, users:user_id(id, full_name, avatar_url, last_latitude, last_longitude, last_location_update)')
        .eq('trip_id', tripId)
        .eq('status', 'accepted');

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

  const membersWithLocation = members.filter((m) => m.latitude && m.longitude);
  const membersNoLocation = members.filter((m) => !m.latitude || !m.longitude);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header trip={null} onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Loading trip map…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header trip={trip} onBack={() => router.back()} />

      {/* Weather bar for destination */}
      {weather && (
        <View style={styles.weatherBar}>
          <Text style={styles.weatherEmoji}>{WEATHER_EMOJI[weather.icon] || '🌤️'}</Text>
          <Text style={styles.weatherText}>
            {weather.currentTemp}°C · {weather.condition}
          </Text>
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
        centerLat={destLat ?? undefined}
        centerLng={destLng ?? undefined}
        zoom={destLat ? 10 : 5}
        onMarkerTap={() => {}}
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
  refreshBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 18,
  },
});
