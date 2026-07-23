import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors, Spacing } from '@/constants/theme';
import ConnectHeader from '@/components/connect/ConnectHeader';
import SectionHeader from '@/components/ui/SectionHeader';
import FilterChip from '@/components/ui/FilterChip';
import SearchBar from '@/components/ui/SearchBar';
import EmptyState from '@/components/EmptyState';
import SkeletonLoader from '@/components/SkeletonLoader';
import UpcomingTripCard from '@/components/connect/UpcomingTripCard';
import TravelPartnerCard from '@/components/connect/TravelPartnerCard';
import RideCard from '@/components/connect/RideCard';
import OrganizerCard, { OrganizerCardData } from '@/components/connect/OrganizerCard';
import GroupCard, { GroupCardData } from '@/components/connect/GroupCard';
import EventCard, { EventCardItem } from '@/components/connect/EventCard';
import PeopleCard, { PeopleCardData } from '@/components/connect/PeopleCard';

const QUICK_FILTERS = [
  'All', 'This Weekend', 'Treks', 'Bike Rides', 'Camping', 'Backpacking',
  'Road Trips', 'Women Only', 'Family', 'Solo', 'Beginner', 'Advanced', 'Nearby',
];

const TRIP_TYPE_FILTERS: Record<string, string> = {
  'Treks': 'trek', 'Bike Rides': 'bike', 'Camping': 'weekend',
  'Backpacking': 'backpacking', 'Road Trips': 'car_ride',
};
const GENDER_FILTERS: Record<string, string> = { 'Women Only': 'female', 'Family': 'family', 'Solo': 'any' };
const DIFFICULTY_FILTERS: Record<string, string> = { 'Beginner': 'beginner', 'Advanced': 'advanced' };

const TREKRIDERZ_EVENTS: EventCardItem[] = [
  { icon: 'flag-outline', title: 'Founder Ride' },
  { icon: 'people-outline', title: 'Community Meetup' },
  { icon: 'leaf-outline', title: 'Cleanup Drive' },
  { icon: 'camera-outline', title: 'Photography Walk' },
  { icon: 'moon-outline', title: 'Night Trek' },
  { icon: 'sunny-outline', title: 'Tree Plantation' },
  { icon: 'gift-outline', title: 'Birthday Ride' },
];

function perPersonBudgetOf(trip: { budget?: number | null; budget_type?: string; group_size?: number | null }) {
  const budget = trip.budget || 0;
  if (trip.budget_type === 'per_person') return budget;
  return Math.round(budget / (trip.group_size || 1));
}
function dateRangeLabel(start: string, end: string) {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(start)} — ${fmt(end)}`;
}
function isThisWeekend(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = (d.getTime() - now.getTime()) / 86400000;
  return diffDays >= 0 && diffDays <= 7 && (d.getDay() === 0 || d.getDay() === 6);
}

export default function ConnectScreen() {
  const { user } = useAuthStore();
  const searchRef = useRef<TextInput>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [trips, setTrips] = useState<any[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [myTripStatus, setMyTripStatus] = useState<Record<string, 'pending' | 'accepted'>>({});
  const [groups, setGroups] = useState<GroupCardData[]>([]);
  const [people, setPeople] = useState<PeopleCardData[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [tripsRes, communitiesRes, myCommMembersRes, usersRes, myFollowsRes] = await Promise.all([
        supabase.from('trips')
          .select('id, title, destination, cover_photo_url, photos, start_date, end_date, experience_level, slots_available, budget, budget_type, group_size, looking_for_partner, partner_gender, trip_type, meeting_point, created_by, creator:users!created_by(id, full_name, avatar_url, is_verified)')
          .eq('is_public', true).in('status', ['planning', 'confirmed']).gte('end_date', today)
          .order('start_date', { ascending: true }).limit(40),
        supabase.from('communities').select('*').order('member_count', { ascending: false }).limit(10),
        supabase.from('community_members').select('community_id, status').eq('user_id', user.id),
        supabase.from('users').select('id, full_name, avatar_url, location, is_verified').neq('id', user.id).order('created_at', { ascending: false }).limit(15),
        supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
      ]);

      const tripsData = tripsRes.data || [];
      setTrips(tripsData);

      const tripIds = tripsData.map((t: any) => t.id);
      if (tripIds.length > 0) {
        const { data: members } = await supabase.from('trip_members').select('trip_id, user_id, status').in('trip_id', tripIds);
        const counts: Record<string, number> = {};
        const mine: Record<string, 'pending' | 'accepted'> = {};
        (members || []).forEach((m: any) => {
          if (m.status === 'accepted') counts[m.trip_id] = (counts[m.trip_id] || 0) + 1;
          if (m.user_id === user.id) mine[m.trip_id] = m.status;
        });
        setMemberCounts(counts);
        setMyTripStatus(mine);
      }

      const myCommStatus: Record<string, 'none' | 'pending' | 'approved'> = {};
      (myCommMembersRes.data || []).forEach((m: any) => { myCommStatus[m.community_id] = m.status; });
      setGroups((communitiesRes.data || []).map((c: any) => ({
        id: c.id, name: c.name, image: c.cover_image, memberCount: c.member_count || 0,
        joinState: myCommStatus[c.id] || 'none',
      })));

      const followingSet = new Set((myFollowsRes.data || []).map((f: any) => f.following_id));
      setPeople((usersRes.data || []).map((u: any) => ({
        id: u.id, name: u.full_name || 'Adventurer', avatar: u.avatar_url, location: u.location,
        verified: !!u.is_verified, following: followingSet.has(u.id),
      })));
    } catch (e) {
      console.error('Connect load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const joinTrip = async (tripId: string) => {
    if (!user?.id) return;
    setMyTripStatus((prev) => ({ ...prev, [tripId]: 'pending' }));
    try {
      const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: user.id, role: 'member', status: 'pending' });
      if (error) throw error;
    } catch (e) {
      setMyTripStatus((prev) => { const next = { ...prev }; delete next[tripId]; return next; });
    }
  };

  const joinGroup = async (group: GroupCardData) => {
    if (!user?.id) return;
    setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, joinState: 'pending' } : g));
    try {
      const { error } = await supabase.from('community_members').insert({ community_id: group.id, user_id: user.id, status: 'pending' });
      if (error) throw error;
    } catch (e) {
      setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, joinState: 'none' } : g));
    }
  };

  const toggleFollow = async (targetId: string, next: boolean) => {
    if (!user?.id) return;
    try {
      if (next) {
        await supabase.from('user_follows').upsert({ follower_id: user.id, following_id: targetId, status: 'accepted' }, { onConflict: 'follower_id,following_id' });
      } else {
        await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      }
    } catch (e) { /* optimistic UI already applied by the card */ }
  };

  const q = search.toLowerCase();
  const searchedTrips = trips.filter((t: any) =>
    !q || t.title?.toLowerCase().includes(q) || t.destination?.toLowerCase().includes(q) ||
    t.creator?.full_name?.toLowerCase().includes(q)
  );

  const filteredTrips = searchedTrips.filter((t: any) => {
    switch (activeFilter) {
      case 'All': return true;
      case 'This Weekend': return isThisWeekend(t.start_date);
      case 'Treks': case 'Bike Rides': case 'Camping': case 'Backpacking': case 'Road Trips':
        return t.trip_type === TRIP_TYPE_FILTERS[activeFilter];
      case 'Women Only': case 'Family': case 'Solo':
        return t.partner_gender === GENDER_FILTERS[activeFilter];
      case 'Beginner': case 'Advanced':
        return (t.experience_level || '').toLowerCase() === DIFFICULTY_FILTERS[activeFilter];
      case 'Nearby': return true; // no geolocation query yet — see report
      default: return true;
    }
  });

  const upcomingTrips = filteredTrips.filter((t: any) => t.trip_type !== 'bike');
  const bikeRides = filteredTrips.filter((t: any) => t.trip_type === 'bike');
  const travelPartners = filteredTrips.filter((t: any) => t.looking_for_partner);

  // Organizers: derived client-side from the currently-fetched public-trips
  // sample (trip count = trips conducted *within this sample*, not a true
  // global all-time count — no aggregate query/view exists for that).
  const organizerMap = new Map<string, OrganizerCardData>();
  trips.forEach((t: any) => {
    const c = t.creator;
    if (!c) return;
    const existing = organizerMap.get(c.id);
    if (existing) existing.tripsConducted += 1;
    else organizerMap.set(c.id, { id: c.id, name: c.full_name || 'Organizer', avatar: c.avatar_url, tripsConducted: 1, followers: 0, verified: !!c.is_verified, rating: null });
  });
  const organizers = Array.from(organizerMap.values()).sort((a, b) => b.tripsConducted - a.tripsConducted).slice(0, 10);

  const joinStateOf = (trip: any): 'none' | 'pending' | 'joined' | 'own' => {
    if (trip.created_by === user?.id) return 'own';
    const s = myTripStatus[trip.id];
    if (s === 'accepted') return 'joined';
    if (s === 'pending') return 'pending';
    return 'none';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ConnectHeader onSearchPress={() => searchRef.current?.focus()} onFilterPress={() => searchRef.current?.focus()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchSection}>
          <SearchBar
            ref={searchRef}
            value={search}
            onChangeText={setSearch}
            placeholder="Search trips, organizers, people…"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {QUICK_FILTERS.map((f) => (
              <FilterChip key={f} label={f} selected={activeFilter === f} onPress={() => setActiveFilter(f)} />
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <SkeletonSections />
        ) : (
          <>
            {/* Section 1: Upcoming Adventures */}
            <View style={styles.section}>
              <SectionHeader title="Upcoming Adventures" subtitle="Public trips open to join" onSeeAll={() => router.push('/discover?type=trek' as any)} />
              {upcomingTrips.length === 0 ? (
                <EmptyState icon="map-outline" title="No trips match yet" subtitle="Try a different search or filter." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {upcomingTrips.map((t: any) => (
                    <UpcomingTripCard
                      key={t.id}
                      item={{
                        id: t.id,
                        image: t.cover_photo_url || (Array.isArray(t.photos) ? t.photos[0] : null),
                        title: t.title,
                        destination: t.destination,
                        dateLabel: dateRangeLabel(t.start_date, t.end_date),
                        organizerName: t.creator?.full_name || 'Organizer',
                        organizerAvatar: t.creator?.avatar_url,
                        membersJoined: memberCounts[t.id] || 0,
                        difficulty: t.experience_level,
                        seatsLeft: t.slots_available,
                        price: perPersonBudgetOf(t) || null,
                        joinState: joinStateOf(t),
                      }}
                      onPress={() => router.push(`/trip/${t.id}` as any)}
                      onJoin={() => joinTrip(t.id)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Section 2: Find Travel Partners */}
            <View style={styles.section}>
              <SectionHeader title="Find Travel Partners" subtitle="Trips looking for company" />
              {travelPartners.length === 0 ? (
                <EmptyState icon="person-add-outline" title="No travel partners right now" subtitle="Check back soon, or plan a trip and look for one yourself." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {travelPartners.map((t: any) => (
                    <TravelPartnerCard
                      key={t.id}
                      item={{
                        id: t.id,
                        userName: t.creator?.full_name || 'Traveler',
                        userAvatar: t.creator?.avatar_url,
                        verified: !!t.creator?.is_verified,
                        destination: t.destination,
                        dateLabel: dateRangeLabel(t.start_date, t.end_date),
                        lookingFor: (t.trip_type || 'trip').replace(/_/g, ' '),
                        genderPreference: t.partner_gender,
                        ageRange: null,
                      }}
                      onPress={() => router.push(`/trip/${t.id}` as any)}
                      onConnect={() => router.push(`/dm/${t.created_by}` as any)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Section 3: Bike Ride Calendar */}
            <View style={styles.section}>
              <SectionHeader title="Bike Ride Calendar" subtitle="Weekend, morning & hill rides" />
              {bikeRides.length === 0 ? (
                <EmptyState icon="bicycle-outline" title="No rides scheduled yet" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {bikeRides.map((t: any) => (
                    <RideCard
                      key={t.id}
                      item={{
                        id: t.id,
                        title: t.title,
                        rideTimeLabel: dateRangeLabel(t.start_date, t.end_date),
                        meetupPoint: t.meeting_point,
                        distanceKm: null,
                        captainName: t.creator?.full_name || 'Ride Captain',
                        captainAvatar: t.creator?.avatar_url,
                        participants: memberCounts[t.id] || 0,
                        joinState: joinStateOf(t),
                      }}
                      onPress={() => router.push(`/trip/${t.id}` as any)}
                      onJoin={() => joinTrip(t.id)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Section 4: Featured Organizers */}
            <View style={styles.section}>
              <SectionHeader title="Featured Organizers" subtitle="Behind today's trips" />
              {organizers.length === 0 ? (
                <EmptyState icon="ribbon-outline" title="No organizers yet" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {organizers.map((o) => (
                    <OrganizerCard key={o.id} item={o} onPress={() => router.push(`/user/${o.id}` as any)} onFollow={toggleFollow} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Section 5: Active Trekking Groups */}
            <View style={styles.section}>
              <SectionHeader title="Active Trekking Groups" onSeeAll={() => router.push('/community' as any)} />
              {groups.length === 0 ? (
                <EmptyState icon="people-circle-outline" title="No groups yet" subtitle="Be the first to start one." />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {groups.map((g) => (
                    <GroupCard key={g.id} item={g} onPress={() => router.push(`/community/${g.id}` as any)} onJoin={() => joinGroup(g)} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Section 6: TrekRiderz Events */}
            <View style={styles.section}>
              <SectionHeader title="TrekRiderz Events" subtitle="Run by the team" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                {TREKRIDERZ_EVENTS.map((e) => (
                  <EventCard key={e.title} item={e} />
                ))}
              </ScrollView>
            </View>

            {/* Section 7: Suggested People */}
            <View style={styles.section}>
              <SectionHeader title="Suggested People" subtitle="Travelers, riders & explorers" />
              {people.length === 0 ? (
                <EmptyState icon="person-outline" title="No suggestions yet" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
                  {people.map((p) => (
                    <PeopleCard key={p.id} item={p} onPress={() => router.push(`/user/${p.id}` as any)} onFollow={toggleFollow} />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Section 8: Near You — placeholder, needs a location-distance query */}
            <View style={styles.section}>
              <SectionHeader title="Near You" subtitle="Rides, events & treks nearby" />
              <EmptyState icon="navigate-outline" title="Nearby discovery is coming soon" subtitle="We'll show rides, treks and events close to you here." />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SkeletonSections() {
  return (
    <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.xl }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ gap: Spacing.sm }}>
          <SkeletonLoader width="45%" height={16} />
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <SkeletonLoader width={220} height={180} borderRadius={16} />
            <SkeletonLoader width={220} height={180} borderRadius={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  scrollContent: { paddingBottom: 48 },
  searchSection: { marginTop: Spacing.lg, gap: Spacing.md },
  chipsRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  section: { marginTop: Spacing.xl },
  cardRow: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
});
