import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fetchWeatherOpenMeteo } from '@/lib/weather';
import { searchPlaces, reverseGeocode } from '@/lib/geocoding';
import PostCard from '@/components/PostCard';

type FeedTab = 'following' | 'explore';

interface StoryCircle {
  userId: string;
  name: string;
  avatar: string;
  hasUnseen: boolean;
}

const TRIP_EMOJI: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒', weekend: '🌄',
};

const WEATHER_ICON_EMOJI: Record<string, string> = {
  sunny: '☀️', 'partly-sunny': '⛅', cloudy: '☁️', 'cloud-outline': '🌫️',
  rainy: '🌧️', snow: '❄️', thunderstorm: '⛈️', moon: '🌙',
};

interface WeatherCardData {
  id: string;
  label: string;
  sublabel?: string;
  temp: number;
  condition: string;
  icon: string;
  isCurrentLocation?: boolean;
  tripEmoji?: string;
}

function WeatherCard({ card, colors }: { card: WeatherCardData; colors: any }) {
  const emoji = WEATHER_ICON_EMOJI[card.icon] || '🌤️';
  return (
    <View style={[weatherStyles.card, { backgroundColor: colors.weatherCard, borderColor: colors.weatherBorder }]}>
      <View style={weatherStyles.cardTop}>
        {card.isCurrentLocation ? (
          <Ionicons name="location" size={11} color="#8CC63F" />
        ) : (
          <Text style={{ fontSize: 11 }}>{card.tripEmoji || '📍'}</Text>
        )}
        <Text style={[weatherStyles.cardLabel, { color: colors.subtext }]} numberOfLines={1}>
          {card.label}
        </Text>
      </View>
      <Text style={weatherStyles.emoji}>{emoji}</Text>
      <Text style={[weatherStyles.temp, { color: colors.text }]}>{card.temp}°C</Text>
      <Text style={[weatherStyles.condition, { color: colors.subtext }]} numberOfLines={1}>
        {card.condition}
      </Text>
      {card.sublabel && (
        <Text style={[weatherStyles.sublabel, { color: colors.subtext }]} numberOfLines={1}>
          {card.sublabel}
        </Text>
      )}
    </View>
  );
}

function WeatherStrip({ userId, colors }: { userId?: string; colors: any }) {
  const [cards, setCards] = useState<WeatherCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const result: WeatherCardData[] = [];
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const [w, placeName] = await Promise.all([
            fetchWeatherOpenMeteo(loc.coords.latitude, loc.coords.longitude),
            reverseGeocode(loc.coords.longitude, loc.coords.latitude),
          ]);
          if (w && active) {
            result.push({
              id: 'current',
              label: placeName?.split(',')[0] || 'My Location',
              temp: w.currentTemp, condition: w.condition, icon: w.icon, isCurrentLocation: true,
            });
          }
        }
      } catch (_) {}

      if (userId) {
        try {
          const { data: trips } = await supabase
            .from('trips')
            .select('id, title, destination, trip_type, start_date')
            .eq('created_by', userId)
            .in('status', ['planning', 'confirmed'])
            .order('start_date', { ascending: true })
            .limit(4);

          for (const trip of trips || []) {
            try {
              const places = await searchPlaces(trip.destination);
              if (places.length > 0) {
                const [lng, lat] = places[0].center;
                const w = await fetchWeatherOpenMeteo(lat, lng);
                if (w && active) {
                  result.push({
                    id: trip.id, label: trip.destination.split(',')[0], sublabel: trip.title,
                    temp: w.currentTemp, condition: w.condition, icon: w.icon,
                    tripEmoji: TRIP_EMOJI[trip.trip_type] || '🗺️',
                  });
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (active) { setCards(result); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [userId]);

  if (loading) {
    return (
      <View style={[weatherStyles.strip, { borderBottomColor: colors.border }]}>
        <View style={weatherStyles.stripHeader}>
          <Ionicons name="partly-sunny-outline" size={14} color={colors.subtext} />
          <Text style={[weatherStyles.stripTitle, { color: colors.subtext }]}>Live Weather</Text>
        </View>
        <ActivityIndicator size="small" color="#8CC63F" style={{ marginLeft: 12, marginBottom: 12 }} />
      </View>
    );
  }

  if (cards.length === 0) return null;

  return (
    <View style={[weatherStyles.strip, { borderBottomColor: colors.border }]}>
      <View style={weatherStyles.stripHeader}>
        <Ionicons name="partly-sunny-outline" size={14} color={colors.subtext} />
        <Text style={[weatherStyles.stripTitle, { color: colors.subtext }]}>Live Weather</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={weatherStyles.scrollRow}>
        {cards.map((card) => <WeatherCard key={card.id} card={card} colors={colors} />)}
      </ScrollView>
    </View>
  );
}

const weatherStyles = StyleSheet.create({
  strip: { paddingTop: 12, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  stripHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, marginBottom: 10 },
  stripTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  scrollRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  card: { width: 100, borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 3, width: '100%', marginBottom: 4 },
  cardLabel: { fontSize: 10, fontWeight: '600', flex: 1 },
  emoji: { fontSize: 28, marginVertical: 2 },
  temp: { fontSize: 18, fontWeight: '800' },
  condition: { fontSize: 10, textAlign: 'center' },
  sublabel: { fontSize: 9, marginTop: 2, textAlign: 'center', fontStyle: 'italic' },
});

export default function ExploreScreen() {
  const colors = {
    bg: '#000',
    text: '#fff',
    subtext: '#A8A8A8',
    border: '#262626',
    weatherCard: 'rgba(255,255,255,0.06)',
    weatherBorder: 'rgba(255,255,255,0.1)',
  };

  const { user } = useAuthStore();
  const [tab, setTab] = useState<FeedTab>('following');
  const [posts, setPosts] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [storyCircles, setStoryCircles] = useState<StoryCircle[]>([]);
  const [myHasStory, setMyHasStory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFollowing = useCallback(async () => {
    if (!user?.id) return [] as string[];
    const { data } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted');
    const ids = (data || []).map((f: any) => f.following_id);
    setFollowingIds(ids);
    return ids;
  }, [user?.id]);

  const fetchPosts = useCallback(async (feedTab: FeedTab, following: string[]) => {
    try {
      let query = supabase
        .from('posts')
        .select('*, users:user_id(id, full_name, avatar_url, email)')
        .eq('visibility', 'public')
        .or('post_type.is.null,post_type.neq.trip_story')
        .order('created_at', { ascending: false })
        .limit(30);

      if (feedTab === 'following') {
        const authorIds = [...following, user?.id].filter(Boolean) as string[];
        if (authorIds.length === 0) { setPosts([]); return; }
        query = query.in('user_id', authorIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) { setPosts([]); return; }

      const [{ data: likes }, { data: saves }] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user?.id || ''),
        supabase.from('post_saves').select('post_id').eq('user_id', user?.id || ''),
      ]);
      const likedIds = new Set((likes || []).map((l: any) => l.post_id));
      const savedIds = new Set((saves || []).map((s: any) => s.post_id));

      const tripIds = [...new Set(data.filter((p: any) => p.trip_id).map((p: any) => p.trip_id))];
      let tripsMap: Record<string, any> = {};
      if (tripIds.length > 0) {
        const { data: tripsData } = await supabase
          .from('trips').select('id, status, trip_type, destination, title').in('id', tripIds);
        tripsMap = Object.fromEntries((tripsData || []).map((t: any) => [t.id, t]));
      }

      setPosts(data.map((p: any) => ({
        id: p.id,
        user: {
          name: p.users?.full_name || p.users?.email?.split('@')[0] || 'Rider',
          avatar: p.users?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(p.users?.full_name || 'R')}&background=8CC63F&color=fff`,
          id: p.user_id,
        },
        images: Array.isArray(p.media) ? p.media : [],
        content: p.content || '',
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        timestamp: new Date(p.created_at).toLocaleDateString(),
        location: p.location,
        liked: likedIds.has(p.id),
        saved: savedIds.has(p.id),
        trip_id: p.trip_id,
        trip: p.trip_id ? tripsMap[p.trip_id] || undefined : undefined,
      })));
    } catch (error) {
      console.error('Feed error:', error);
    }
  }, [user?.id]);

  // Fetch real 24hr stories — one circle per author (self excluded, shown separately)
  const fetchStoryCircles = useCallback(async (following: string[]) => {
    if (!user?.id) return;
    try {
      const authorIds = [...following, user.id];
      const { data } = await supabase
        .from('stories_24h')
        .select('id, user_id, created_at, users:user_id(id, full_name, avatar_url, email)')
        .in('user_id', authorIds)
        .eq('is_hidden', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      const { data: viewedRows } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id);
      const viewedIds = new Set((viewedRows || []).map((v: any) => v.story_id));

      const byUser = new Map<string, { name: string; avatar: string; anyUnseen: boolean }>();
      for (const s of data || []) {
        const u = s.users as any;
        const name = u?.full_name || u?.email?.split('@')[0] || 'User';
        const existing = byUser.get(s.user_id);
        const unseen = !viewedIds.has(s.id);
        if (existing) {
          existing.anyUnseen = existing.anyUnseen || unseen;
        } else {
          byUser.set(s.user_id, {
            name,
            avatar: u?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8CC63F&color=fff`,
            anyUnseen: unseen,
          });
        }
      }

      setMyHasStory(byUser.has(user.id));
      const circles: StoryCircle[] = [];
      byUser.forEach((v, userId) => {
        if (userId === user.id) return;
        circles.push({ userId, name: v.name, avatar: v.avatar, hasUnseen: v.anyUnseen });
      });
      setStoryCircles(circles);
    } catch (_) {}
  }, [user?.id]);

  const loadAll = useCallback(async (feedTab: FeedTab) => {
    const following = await fetchFollowing();
    await Promise.all([fetchPosts(feedTab, following), fetchStoryCircles(following)]);
  }, [fetchFollowing, fetchPosts, fetchStoryCircles]);

  useEffect(() => { loadAll(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll(tab);
    setRefreshing(false);
  };

  const openStory = (userId: string, name: string, avatar: string) => {
    router.push({ pathname: '/story/view', params: { userId, name, avatar } } as any);
  };

  const myName = (user as any)?.user_metadata?.full_name?.split(' ')[0] || 'You';
  const myAvatar = (user as any)?.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=8CC63F&color=fff`;

  const HeaderComponent = () => (
    <>
      <WeatherStrip userId={user?.id} colors={colors} />
      <View style={[styles.storiesSection, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesList}>
          {/* "Your Story" — view own active story, or create a new one */}
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => myHasStory ? openStory(user!.id, 'Your Story', myAvatar) : router.push('/story/create' as any)}
          >
            <View style={[styles.storyRing, myHasStory && styles.storyRingActive]}>
              <Image source={{ uri: myAvatar }} style={styles.storyAvatar} />
              <TouchableOpacity
                style={styles.addBadge}
                onPress={(e) => { e.stopPropagation(); router.push('/story/create' as any); }}
              >
                <Ionicons name="add" size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>Your Story</Text>
          </TouchableOpacity>

          {/* 24hr story circles — followed users with an active story */}
          {storyCircles.map((item) => (
            <TouchableOpacity
              key={item.userId}
              style={styles.storyItem}
              onPress={() => openStory(item.userId, item.name, item.avatar)}
            >
              <View style={[styles.storyRing, item.hasUnseen ? styles.storyRingActive : styles.storyRingSeen]}>
                <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
              </View>
              <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
                {item.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('following')}>
          <Text style={[styles.tabLabel, { color: tab === 'following' ? colors.text : colors.subtext }]}>Following</Text>
          {tab === 'following' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('explore')}>
          <Text style={[styles.tabLabel, { color: tab === 'explore' ? colors.text : colors.subtext }]}>Explore</Text>
          {tab === 'explore' && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {tab === 'following' && posts.length === 0 && (
        <View style={styles.emptyFollowing}>
          <Ionicons name="people-outline" size={40} color={colors.subtext} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Follow some trekkers to see their posts here!</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/discover' as any)}>
            <Text style={styles.emptyBtnText}>Explore Discover</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>TrekRiderz</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/map' as any)}
            style={styles.mapBtn}
          >
            <Ionicons name="map-outline" size={18} color="#8CC63F" />
            <Text style={styles.mapBtnText}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/post/create' as any)}>
            <Ionicons name="create-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<HeaderComponent />}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3897F0" />
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(140,198,63,0.12)', borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
  },
  mapBtnText: { color: '#8CC63F', fontSize: 13, fontWeight: '700' },
  headerTitle: { fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  storiesSection: { paddingVertical: 12, borderBottomWidth: 0.5 },
  storiesList: { paddingHorizontal: 12, gap: 12 },
  storyItem: { alignItems: 'center', width: 68 },
  storyRing: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.15)', padding: 2, marginBottom: 5, position: 'relative',
  },
  storyRingActive: { borderColor: '#C13584' },
  storyRingSeen: { borderColor: 'rgba(255,255,255,0.15)' },
  storyAvatar: { width: 55, height: 55, borderRadius: 28 },
  addBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#3897F0', borderWidth: 1.5, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  storyName: { fontSize: 11, textAlign: 'center' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 13.5, fontWeight: '700' },
  tabUnderline: { marginTop: 8, height: 2, width: 28, borderRadius: 1, backgroundColor: '#8CC63F' },
  emptyFollowing: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 14, textAlign: 'center', fontWeight: '600' },
  emptyBtn: { backgroundColor: '#8CC63F', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
});
