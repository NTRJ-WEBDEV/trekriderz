import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const TYPE_FILTERS = [
  { id: 'all',         label: 'All',         emoji: '🗺️' },
  { id: 'partner',     label: 'Find Partner', emoji: '🤝' },
  { id: 'trek',        label: 'Trek',         emoji: '⛰️' },
  { id: 'bike',        label: 'Bike',         emoji: '🏍️' },
  { id: 'car_ride',    label: 'Car Ride',     emoji: '🚗' },
  { id: 'backpacking', label: 'Backpack',     emoji: '🎒' },
  { id: 'weekend',     label: 'Weekend',      emoji: '🌄' },
  { id: 'spiritual',   label: 'Spiritual',    emoji: '🙏' },
  { id: 'temple',      label: 'Temple',       emoji: '🛕' },
  { id: 'wildlife',    label: 'Wildlife',     emoji: '🦁' },
];

const PARTNER_ROLE_LABEL: Record<string, string> = {
  rider: '🏍️ Rider needs pillion',
  pillion: '🪑 Pillion needs rider',
  any: '🤝 Open to all',
};

const GENDER_LABEL: Record<string, string> = {
  male: '👨 Male partner',
  female: '👩 Female partner',
  any: '🤝 Any partner',
};

const EMOJI_MAP: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', car_ride: '🚗',
  temple: '🛕', spiritual: '🙏', backpacking: '🎒', weekend: '🌄', trip: '🗺️',
};

const ROLE_COLORS: Record<string, { label: string; color: string }> = {
  admin: { label: 'OFFICIAL', color: '#EF4444' },
  guide: { label: 'GUIDE', color: '#1E88E5' },
  homestay_owner: { label: 'HOMESTAY', color: '#F59E0B' },
  user: { label: 'COMMUNITY', color: '#8CC63F' },
};

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]}`;
}

function daysUntil(dateStr: string): string | null {
  const d = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return 'Starts Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7) return `In ${diff} days`;
  if (diff <= 30) return `In ${Math.ceil(diff / 7)} weeks`;
  return `In ${Math.ceil(diff / 30)} months`;
}

interface TripPublic {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  trip_type: string;
  group_size: number;
  status: string;
  description?: string;
  created_by: string;
  creator: { id: string; full_name: string; avatar_url: string | null; role: string } | null;
  // Partner matching fields
  looking_for_partner?: boolean;
  partner_gender?: string;
  partner_role?: string;
  slots_available?: number;
  contact_whatsapp?: string;
  experience_level?: string;
  meeting_point?: string;
}

export default function DiscoverScreen() {
  const user = useAuthStore((state) => state.user);
  const { type } = useLocalSearchParams<{ type?: string }>();

  const [activeType, setActiveType] = useState(type || 'all');
  const [locationQuery, setLocationQuery] = useState('');
  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [myTripIds, setMyTripIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTrips();
  }, [activeType]);

  useEffect(() => {
    if (user) fetchMyMemberships();
  }, [user]);

  const fetchMyMemberships = async () => {
    if (!user) return;
    const { data } = await supabase.from('trip_members').select('trip_id').eq('user_id', user.id);
    if (data) setMyTripIds(new Set(data.map((m: any) => m.trip_id)));
  };

  const fetchTrips = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('trips')
        .select('*, creator:users!created_by(id, full_name, avatar_url, role)')
        .eq('is_public', true)
        .in('status', ['planning', 'confirmed'])
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date', { ascending: true })
        .limit(50);

      if (activeType === 'partner') {
        query = query.eq('looking_for_partner', true);
      } else if (activeType !== 'all') {
        query = query.eq('trip_type', activeType);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTrips((data || []) as any);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleJoin = async (trip: TripPublic) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please log in to join trips.', [
        { text: 'Log In', onPress: () => router.push('/login') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (trip.created_by === user.id) {
      Alert.alert("That's your trip!", 'You are the organizer of this trip.');
      return;
    }
    if (myTripIds.has(trip.id)) {
      Alert.alert('Already Requested', "You've already sent a join request for this trip.");
      return;
    }

    setJoiningId(trip.id);
    try {
      const { error } = await supabase.from('trip_members').insert({
        trip_id: trip.id,
        user_id: user.id,
        role: 'member',
        status: 'invited',
      });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: trip.created_by,
        title: 'New Join Request',
        message: `Someone wants to join your trip: ${trip.title}`,
        type: 'trip_invite',
        data: { trip_id: trip.id },
      });

      setMyTripIds((prev) => new Set([...prev, trip.id]));
      Alert.alert('Request Sent! 🎉', 'The organizer will review your join request.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send request. Try again.');
    } finally {
      setJoiningId(null);
    }
  };

  const filtered = trips.filter(
    (t) => !locationQuery || t.destination.toLowerCase().includes(locationQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(140,198,63,0.22)', '#080C14']}
        style={styles.bgGradient}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Discover Trips</Text>
            <Text style={styles.headerSub}>Find adventures to join</Text>
          </View>
        </View>

        {/* Location search */}
        <View style={styles.searchWrap}>
          <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.45)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by destination..."
            placeholderTextColor="rgba(255,255,255,0.28)"
            value={locationQuery}
            onChangeText={setLocationQuery}
          />
          {locationQuery.length > 0 && (
            <TouchableOpacity onPress={() => setLocationQuery('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Type filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScroll}
        >
          {TYPE_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.pill, activeType === f.id && styles.pillActive]}
              onPress={() => setActiveType(f.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.pillEmoji}>{f.emoji}</Text>
              <Text style={[styles.pillLabel, activeType === f.id && styles.pillLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Trip count */}
        {!loading && (
          <Text style={styles.resultsCount}>
            {filtered.length} {filtered.length === 1 ? 'trip' : 'trips'} available
          </Text>
        )}

        {/* Trip list */}
        {loading ? (
          <ActivityIndicator size="large" color="#8CC63F" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchTrips(); }}
                tintColor="#8CC63F"
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🌍</Text>
                <Text style={styles.emptyTitle}>No trips yet</Text>
                <Text style={styles.emptySubtitle}>
                  {activeType === 'partner'
                    ? 'No one is looking for a travel partner right now. Create a trip and enable partner matching!'
                    : 'No public trips here yet. Check back soon for new adventures!'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TripCard
                trip={item}
                isJoined={myTripIds.has(item.id)}
                isOwner={item.created_by === user?.id}
                isJoining={joiningId === item.id}
                onJoin={() => handleJoin(item)}
                onPress={() => router.push(`/trip/${item.id}` as any)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function TripCard({
  trip, isJoined, isOwner, isJoining, onJoin, onPress,
}: {
  trip: TripPublic;
  isJoined: boolean;
  isOwner: boolean;
  isJoining: boolean;
  onJoin: () => void;
  onPress: () => void;
}) {
  const roleInfo = ROLE_COLORS[trip.creator?.role || 'user'] || ROLE_COLORS.user;
  const countdown = daysUntil(trip.start_date);
  const emoji = EMOJI_MAP[trip.trip_type] || '🗺️';
  const hasPartner = !!trip.looking_for_partner;

  const handleWhatsApp = () => {
    if (!trip.contact_whatsapp) return;
    const msg = encodeURIComponent(
      `Hi! I saw your trip "${trip.title}" to ${trip.destination} on TrekRiderz and I'm interested in joining as a travel partner. Are spots still available?`
    );
    import('react-native').then(({ Linking }) =>
      Linking.openURL(`whatsapp://send?phone=${trip.contact_whatsapp}&text=${msg}`)
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, hasPartner && styles.cardPartner]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Top row: type + countdown */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardTypeRow}>
          <Text style={styles.cardEmoji}>{emoji}</Text>
          <Text style={styles.cardTypeLabel}>
            {trip.trip_type?.replace('_', ' ').toUpperCase() || 'TRIP'}
          </Text>
        </View>
        <View style={styles.cardTopRight}>
          {hasPartner && (
            <View style={styles.partnerBadge}>
              <Text style={styles.partnerBadgeText}>🤝 Partner Wanted</Text>
            </View>
          )}
          {countdown && (
            <View style={styles.countdown}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{trip.title}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={13} color="#8CC63F" />
        <Text style={styles.metaDest} numberOfLines={1}>{trip.destination}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.4)" />
        <Text style={styles.metaDate}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
      </View>

      {/* Partner details row */}
      {hasPartner && (
        <View style={styles.partnerInfoRow}>
          <View style={styles.partnerTag}>
            <Text style={styles.partnerTagText}>
              {trip.partner_role ? PARTNER_ROLE_LABEL[trip.partner_role] ?? '🤝 Partner wanted'
                : GENDER_LABEL[trip.partner_gender ?? 'any']}
            </Text>
          </View>
          {trip.slots_available && trip.slots_available > 0 && (
            <View style={styles.slotsTag}>
              <Ionicons name="person-add-outline" size={11} color="#A78BFA" />
              <Text style={styles.slotsTagText}>{trip.slots_available} spot{trip.slots_available > 1 ? 's' : ''} open</Text>
            </View>
          )}
          {trip.experience_level && (
            <View style={styles.expTag}>
              <Text style={styles.expTagText}>⛰️ {trip.experience_level}</Text>
            </View>
          )}
        </View>
      )}

      {trip.meeting_point && (
        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={styles.meetText} numberOfLines={1}>Meet: {trip.meeting_point}</Text>
        </View>
      )}

      {!!trip.description && (
        <Text style={styles.cardDesc} numberOfLines={2}>{trip.description}</Text>
      )}

      <View style={styles.divider} />

      {/* Organizer */}
      <View style={styles.organizerRow}>
        {trip.creator?.avatar_url ? (
          <Image source={{ uri: trip.creator.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {trip.creator?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.organizerName} numberOfLines={1}>
            {trip.creator?.full_name || 'Organizer'}
          </Text>
          <View style={[
            styles.roleBadge,
            { backgroundColor: roleInfo.color + '22', borderColor: roleInfo.color + '55' },
          ]}>
            <Text style={[styles.roleBadgeText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
          </View>
        </View>
        <View style={styles.spotsChip}>
          <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.55)" />
          <Text style={styles.spotsText}>{trip.group_size} people</Text>
        </View>
      </View>

      {/* Action buttons */}
      {isOwner ? (
        <View style={[styles.joinBtn, styles.joinBtnMuted]}>
          <Ionicons name="shield-checkmark-outline" size={15} color="#8CC63F" />
          <Text style={[styles.joinBtnTxt, { color: '#8CC63F' }]}>Your Trip</Text>
        </View>
      ) : isJoined ? (
        <View style={[styles.joinBtn, styles.joinBtnMuted]}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#8CC63F" />
          <Text style={[styles.joinBtnTxt, { color: '#8CC63F' }]}>Request Sent</Text>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.joinBtn, { flex: 1 }]}
            onPress={onJoin}
            disabled={isJoining}
            activeOpacity={0.8}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={15} color="#000" />
                <Text style={styles.joinBtnTxt}>
                  {hasPartner ? 'Connect' : 'Request to Join'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {hasPartner && trip.contact_whatsapp && (
            <TouchableOpacity style={styles.waBtn} onPress={handleWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 10, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },

  pillsScroll: { height: 46, marginBottom: 10 },
  pillsRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: { backgroundColor: '#8CC63F', borderColor: '#8CC63F' },
  pillEmoji: { fontSize: 15 },
  pillLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  pillLabelActive: { color: '#000' },

  resultsCount: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 20, marginBottom: 10, letterSpacing: 0.3,
  },

  list: { paddingHorizontal: 16, paddingBottom: 110 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: 20, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  cardPartner: {
    borderColor: 'rgba(167,139,250,0.3)',
    backgroundColor: 'rgba(167,139,250,0.04)',
  },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10, gap: 8,
  },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  cardTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardEmoji: { fontSize: 20 },
  cardTypeLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5 },
  partnerBadge: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
  },
  partnerBadgeText: { fontSize: 10, fontWeight: '800', color: '#A78BFA' },
  countdown: {
    backgroundColor: 'rgba(140,198,63,0.14)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
  },
  countdownText: { fontSize: 11, fontWeight: '700', color: '#8CC63F' },
  partnerInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 4 },
  partnerTag: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
  },
  partnerTagText: { fontSize: 11, fontWeight: '700', color: '#A78BFA' },
  slotsTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(167,139,250,0.1)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)',
  },
  slotsTagText: { fontSize: 11, fontWeight: '600', color: '#A78BFA' },
  expTag: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  expTagText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  meetText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8 },
  waBtn: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: 'rgba(37,211,102,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(37,211,102,0.25)',
  },

  cardTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 8, lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaDest: { fontSize: 13, color: '#8CC63F', fontWeight: '600', flex: 1 },
  metaDate: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  cardDesc: {
    fontSize: 13, color: 'rgba(255,255,255,0.48)',
    marginTop: 8, lineHeight: 18,
  },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },

  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(140,198,63,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 15, fontWeight: '700', color: '#8CC63F' },
  organizerName: { fontSize: 13, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 5, borderWidth: 1,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  spotsChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spotsText: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#8CC63F',
    paddingVertical: 13, borderRadius: 15,
  },
  joinBtnMuted: {
    backgroundColor: 'rgba(140,198,63,0.1)',
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
  },
  joinBtnTxt: { fontSize: 14, fontWeight: '800', color: '#000' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#FFF' },
  emptySubtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.38)',
    textAlign: 'center', paddingHorizontal: 40, lineHeight: 19,
  },
});

