import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

// Mirrors TRIP_EMOJI in (tabs)/index.tsx — kept in sync manually.
const TRIP_EMOJI: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒', weekend: '🌄',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  planning: { bg: 'rgba(59,130,246,0.2)', color: '#3B82F6' },
  confirmed: { bg: 'rgba(140,198,63,0.2)', color: GREEN },
  completed: { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
};

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  trip_type: string;
  status: string;
}

export default function UserTripsScreen() {
  const { id: targetId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSelf = user?.id === targetId;

  useEffect(() => { if (targetId) load(); }, [targetId]);

  const load = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const [tripsRes, userRes] = await Promise.all([
        supabase
          .from('trips')
          .select('id, title, destination, start_date, trip_type, status')
          .eq('created_by', targetId)
          .order('start_date', { ascending: false }),
        isSelf ? Promise.resolve({ data: null }) : supabase.from('users').select('full_name').eq('id', targetId).single(),
      ]);
      setTrips(tripsRes.data || []);
      setOwnerName((userRes as any)?.data?.full_name ?? null);
    } finally {
      setLoading(false);
    }
  };

  const title = isSelf ? 'My Trips' : ownerName ? `${ownerName}'s Trips` : 'Trips';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="airplane-outline" size={64} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyText}>{isSelf ? "You haven't created any trips yet" : 'No trips yet'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {trips.map((t) => {
            const statusStyle = STATUS_STYLE[t.status] || STATUS_STYLE.planning;
            const dateLabel = t.start_date
              ? new Date(t.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '';
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(`/trip/${t.id}` as any)}
              >
                <View style={styles.emojiWrap}>
                  <Text style={styles.emoji}>{TRIP_EMOJI[t.trip_type] || '🗺️'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>📍 {t.destination}</Text>
                  {dateLabel ? <Text style={styles.cardMeta}>{dateLabel}</Text> : null}
                </View>
                <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusChipText, { color: statusStyle.color }]}>{t.status}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: BORDER,
  },
  emojiWrap: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(140,198,63,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 2 },
  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusChipText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
});
