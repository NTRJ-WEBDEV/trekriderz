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

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  planning: { bg: 'rgba(59,130,246,0.2)', color: '#3B82F6', label: 'planning' },
  confirmed: { bg: 'rgba(140,198,63,0.2)', color: GREEN, label: 'confirmed' },
  completed: { bg: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', label: 'completed' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444', label: 'cancelled' },
  pending_confirmation: { bg: 'rgba(245,166,35,0.2)', color: '#F5A623', label: 'awaiting confirmation' },
};

type TabType = 'upcoming' | 'completed';

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  trip_type: string;
  status: string;
}

export default function UserTripsScreen() {
  const { id: targetId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  const isSelf = user?.id === targetId;

  useEffect(() => { if (targetId) load(); }, [targetId]);

  const load = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const tripFields = 'id, title, destination, start_date, end_date, trip_type, status';

      const [createdRes, userRes, memberRes] = await Promise.all([
        supabase.from('trips').select(tripFields).eq('created_by', targetId),
        isSelf ? Promise.resolve({ data: null }) : supabase.from('users').select('full_name').eq('id', targetId).single(),
        // Joined trips are only unioned in for your own profile — seeing
        // which trips someone ELSE has joined (as opposed to organized)
        // isn't something this screen needs to support, and trip_members
        // RLS wouldn't reliably expose another user's membership rows anyway.
        isSelf
          ? supabase.from('trip_members').select(`trip:trips(${tripFields})`).eq('user_id', targetId).eq('status', 'accepted')
          : Promise.resolve({ data: [] }),
      ]);

      const created = createdRes.data || [];
      const joined = ((memberRes as any)?.data || []).map((r: any) => r.trip).filter(Boolean);
      const merged = new Map<string, Trip>();
      [...created, ...joined].forEach((t: Trip) => merged.set(t.id, t));

      setTrips(Array.from(merged.values()));
      setOwnerName((userRes as any)?.data?.full_name ?? null);
    } finally {
      setLoading(false);
    }
  };

  const title = isSelf ? 'My Trips' : ownerName ? `${ownerName}'s Trips` : 'Trips';

  const today = new Date().toISOString().split('T')[0];
  const upcoming = trips
    .filter((t) => ['planning', 'confirmed'].includes(t.status) && t.end_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const completed = trips
    .filter((t) => ['completed', 'cancelled', 'pending_confirmation'].includes(t.status) || t.end_date < today)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const shown = activeTab === 'upcoming' ? upcoming : completed;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        {(['upcoming', 'completed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `Completed (${completed.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="airplane-outline" size={64} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyText}>
            {activeTab === 'upcoming'
              ? (isSelf ? "No upcoming trips — go plan one!" : 'No upcoming trips')
              : (isSelf ? "No past trips yet" : 'No past trips yet')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {shown.map((t) => {
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
                  <Text style={[styles.statusChipText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
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
  tabs: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: GREEN },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: GREEN },
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
