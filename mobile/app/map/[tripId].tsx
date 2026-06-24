import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function TripMapScreen() {
  const { tripId } = useLocalSearchParams();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);

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
    } catch (error) {
      console.error('Error loading trip map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMembers = () => {
    return supabase
      .channel(`map-locations-${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
        loadTripData();
      })
      .subscribe();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header trip={null} onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Loading trip...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header trip={trip} onBack={() => router.back()} />

      {/* Map placeholder — native maps coming in a future update */}
      <View style={styles.mapContainer}>
        <View style={styles.mapFallback}>
          <Ionicons name="map-outline" size={60} color="rgba(255,255,255,0.12)" />
          <Text style={styles.mapFallbackTitle}>Live Map Coming Soon</Text>
          <Text style={styles.mapFallbackSub}>
            Member locations and destination pins will appear here in the next update.
          </Text>
          {trip?.destination && (
            <View style={styles.destInfo}>
              <Ionicons name="location-outline" size={16} color="#8CC63F" />
              <Text style={styles.destInfoText}>{trip.destination}</Text>
            </View>
          )}
        </View>
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

function Header({ trip, onBack }: { trip: any; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={24} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.headerTitle}>Trip Map</Text>
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
  mapContainer: { flex: 1 },
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
