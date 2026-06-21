import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { reverseGeocode } from '@/lib/geocoding';

// react-native-maps requires native modules not bundled in Expo Go SDK 53+.
// Lazy-require so the module still loads and exports a default component.
let MapView: any = null;
let Marker: any = null;
let PROVIDER_DEFAULT: any = null;
try {
  const RNMaps = require('react-native-maps');
  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
  PROVIDER_DEFAULT = RNMaps.PROVIDER_DEFAULT;
} catch (_) {}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INITIAL_REGION = {
  latitude: 28.6139,
  longitude: 77.2090,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

export default function TripMapScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(INITIAL_REGION);
  const [markers, setMarkers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    loadTripData();
    const membersSubscription = subscribeToMembers();
    return () => {
      membersSubscription?.unsubscribe();
    };
  }, [tripId]);

  const loadTripData = async () => {
    try {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;
      setTrip(tripData);

      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id, users:user_id (id, full_name, avatar_url, last_latitude, last_longitude, last_location_update)')
        .eq('trip_id', tripId)
        .eq('status', 'accepted');

      if (membersError) throw membersError;

      const activeMembers = (membersData || []).map((m: any) => ({
        id: m.users?.id,
        name: m.users?.full_name,
        avatar: m.users?.avatar_url,
        latitude: m.users?.last_latitude,
        longitude: m.users?.last_longitude,
        lastUpdate: m.users?.last_location_update,
      })).filter((m: any) => m.latitude && m.longitude);

      setMembers(activeMembers);
      calculateMarkers(tripData, activeMembers);
    } catch (error) {
      console.error('Error loading trip map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMarkers = (tripData: any, activeMembers: any[]) => {
    const newMarkers: any[] = [];
    if (tripData.lat && tripData.lng) {
      newMarkers.push({
        id: 'destination',
        type: 'destination',
        latitude: Number(tripData.lat),
        longitude: Number(tripData.lng),
        title: 'Destination',
        description: tripData.destination,
        pinColor: '#8CC63F',
      });
    }

    const allPoints = [
      ...newMarkers,
      ...activeMembers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
    ];

    if (allPoints.length > 0) {
      const lats = allPoints.map((p) => p.latitude);
      const lngs = allPoints.map((p) => p.longitude);
      setRegion({
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * 1.5, 0.1),
        longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.5, 0.1),
      });
    }
    setMarkers(newMarkers);
  };

  const subscribeToMembers = () => {
    return supabase
      .channel(`map-locations-${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
        loadTripData();
      })
      .subscribe();
  };

  const centerOnDestination = () => {
    const dest = markers.find((m) => m.type === 'destination');
    if (dest && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: dest.latitude,
        longitude: dest.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      }, 500);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header trip={null} onBack={() => router.back()} onCenter={centerOnDestination} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header trip={trip} onBack={() => router.back()} onCenter={centerOnDestination} />

      {/* Map or fallback */}
      <View style={styles.mapContainer}>
        {MapView ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={region}
            region={region}
            onLongPress={async (e: any) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              const place = await reverseGeocode(longitude, latitude);
              if (place) Alert.alert('Location', `${place}\n${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {markers.map((m) => (
              <Marker key={m.id} coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                title={m.title} description={m.description} pinColor={m.pinColor} />
            ))}
            {members.map((m) => (
              <Marker key={`member-${m.id}`} coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                title={m.name} description="Trip member" pinColor="#3B82F6" />
            ))}
          </MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={60} color="rgba(255,255,255,0.12)" />
            <Text style={styles.mapFallbackTitle}>Map not available in Expo Go</Text>
            <Text style={styles.mapFallbackSub}>
              Use a development build to view live maps and member locations.
            </Text>
            {trip?.destination && (
              <View style={styles.destInfo}>
                <Ionicons name="location-outline" size={16} color="#8CC63F" />
                <Text style={styles.destInfoText}>{trip.destination}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Members */}
      {members.length > 0 && (
        <View style={styles.membersPanel}>
          <Text style={styles.membersPanelTitle}>Live Locations ({members.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {members.map((m) => (
              <View key={m.id} style={styles.memberChip}>
                <View style={styles.memberDot} />
                <Text style={styles.memberChipName}>{m.name?.split(' ')[0]}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

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
        </View>
      )}
    </SafeAreaView>
  );
}

function Header({ trip, onBack, onCenter }: { trip: any; onBack: () => void; onCenter: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={24} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.headerTitle}>Trip Map</Text>
        {trip?.destination && <Text style={styles.headerSub}>📍 {trip.destination}</Text>}
      </View>
      <TouchableOpacity onPress={onCenter} style={styles.headerBtn}>
        <Ionicons name="locate" size={22} color="#8CC63F" />
      </TouchableOpacity>
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
  mapContainer: { flex: 1 },
  map: { width: '100%', height: '100%' },
  mapFallback: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 40,
  },
  mapFallbackTitle: { fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  mapFallbackSub: { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 18 },
  destInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8, backgroundColor: 'rgba(140,198,63,0.1)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)',
  },
  destInfoText: { color: '#8CC63F', fontWeight: '600', fontSize: 14 },
  membersPanel: {
    backgroundColor: '#080C14', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  membersPanelTitle: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  memberChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, gap: 6,
  },
  memberDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  memberChipName: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  destCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F1724', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  destName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  destDates: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
});
