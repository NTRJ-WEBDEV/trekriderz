import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Image, ScrollView,
  Modal, Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fetchWeatherOpenMeteo } from '@/lib/weather';
import { searchPlaces } from '@/lib/geocoding';
import PostCard from '@/components/PostCard';

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
          const w = await fetchWeatherOpenMeteo(loc.coords.latitude, loc.coords.longitude);
          if (w && active) {
            result.push({ id: 'current', label: 'My Location', temp: w.currentTemp, condition: w.condition, icon: w.icon, isCurrentLocation: true });
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  const [posts, setPosts] = useState<any[]>([]);
  const [storyCircles, setStoryCircles] = useState<any[]>([]);
  const [storyViewer, setStoryViewer] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users:user_id(id, full_name, avatar_url, email)')
        .eq('visibility', 'public')
        .or('post_type.is.null,post_type.neq.trip_story')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!data || data.length === 0) return;

      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user?.id || '');
      const likedIds = new Set((likes || []).map((l: any) => l.post_id));

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
        trip_id: p.trip_id,
        trip: p.trip_id ? tripsMap[p.trip_id] || undefined : undefined,
      })));
    } catch (error) {
      console.error('Feed error:', error);
    }
  }, [user?.id]);

  // Fetch 24h story circles — separate from the main feed
  const fetchStoryCircles = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      const { data } = await supabase
        .from('posts')
        .select('id, media, content, user_id, created_at, users:user_id(id, full_name, avatar_url, email)')
        .eq('visibility', 'public')
        .or('post_type.is.null,post_type.neq.trip_story')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(30);

      // One circle per user, only posts that have media or content
      const seen = new Set<string>();
      const circles: any[] = [];
      for (const p of data || []) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          const u = p.users as any;
          const name = u?.full_name || u?.email?.split('@')[0] || 'User';
          circles.push({
            postId: p.id,
            userId: p.user_id,
            name,
            avatar: u?.avatar_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8CC63F&color=fff`,
            image: Array.isArray(p.media) && p.media.length > 0 ? p.media[0] : null,
            content: p.content,
          });
        }
      }
      setStoryCircles(circles);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchPosts(); fetchStoryCircles(); }, [fetchPosts, fetchStoryCircles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPosts(), fetchStoryCircles()]);
    setRefreshing(false);
  };

  const myName = (user as any)?.user_metadata?.full_name?.split(' ')[0] || 'You';
  const myAvatar = (user as any)?.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=8CC63F&color=fff`;

  const HeaderComponent = () => (
    <>
      <WeatherStrip userId={user?.id} colors={colors} />
      <View style={[styles.storiesSection, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesList}>
          {/* "Your Story" add button */}
          <TouchableOpacity style={styles.storyItem} onPress={() => router.push('/post/create' as any)}>
            <View style={styles.storyRing}>
              <Image source={{ uri: myAvatar }} style={styles.storyAvatar} />
              <View style={styles.addBadge}>
                <Ionicons name="add" size={12} color="#FFF" />
              </View>
            </View>
            <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>Your Story</Text>
          </TouchableOpacity>

          {/* 24h story circles — other users */}
          {storyCircles.map((item) => (
            <TouchableOpacity
              key={item.postId}
              style={styles.storyItem}
              onPress={() => setStoryViewer(item)}
            >
              <View style={[styles.storyRing, styles.storyRingActive]}>
                <Image source={{ uri: item.avatar }} style={styles.storyAvatar} />
              </View>
              <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
                {item.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* ── Full-screen story viewer ── */}
      <Modal visible={!!storyViewer} transparent animationType="fade" onRequestClose={() => setStoryViewer(null)}>
        <TouchableWithoutFeedback onPress={() => setStoryViewer(null)}>
          <View style={storyStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={storyStyles.card}>
                {storyViewer?.image ? (
                  <Image source={{ uri: storyViewer.image }} style={storyStyles.image} resizeMode="cover" />
                ) : (
                  <View style={storyStyles.textOnly}>
                    <Text style={storyStyles.textContent}>{storyViewer?.content}</Text>
                  </View>
                )}
                {/* User badge */}
                <View style={storyStyles.userRow}>
                  <Image source={{ uri: storyViewer?.avatar }} style={storyStyles.userAvatar} />
                  <Text style={storyStyles.userName}>{storyViewer?.name}</Text>
                  <Text style={storyStyles.timer}>• 24h</Text>
                </View>
                {/* Close */}
                <TouchableOpacity style={storyStyles.closeBtn} onPress={() => setStoryViewer(null)}>
                  <Ionicons name="close" size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  storyAvatar: { width: 55, height: 55, borderRadius: 28 },
  addBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#3897F0', borderWidth: 1.5, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  storyName: { fontSize: 11, textAlign: 'center' },
});

const storyStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center',
  },
  card: {
    width: SCREEN_W - 32, maxHeight: SCREEN_H * 0.82,
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#111',
  },
  image: { width: '100%', aspectRatio: 9 / 16 },
  textOnly: {
    padding: 28, minHeight: 300, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1C1C2E',
  },
  textContent: { color: '#FFF', fontSize: 18, lineHeight: 28, textAlign: 'center', fontWeight: '500' },
  userRow: {
    position: 'absolute', top: 16, left: 16, right: 48,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  userAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#FFF' },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 14, flex: 1 },
  timer: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
});
