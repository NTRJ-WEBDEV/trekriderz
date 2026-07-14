import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { fetchWeatherOpenMeteo, formatWeatherAge } from '@/lib/weather';
import { searchPlaces, reverseGeocode } from '@/lib/geocoding';
import PostCard from '@/components/PostCard';

// ── Weather Strip ────────────────────────────────────────────────────────────

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
  isStale?: boolean;
  fetchedAt?: number;
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
      {card.isStale && card.fetchedAt && (
        <Text style={weatherStyles.staleText} numberOfLines={1}>
          {formatWeatherAge(card.fetchedAt)}
        </Text>
      )}
    </View>
  );
}

function WeatherStrip({ userId, colors }: { userId?: string; colors: any }) {
  const [cards, setCards] = useState<WeatherCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const result: WeatherCardData[] = [];
      let attemptedAny = false;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          attemptedAny = true;
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const [w, placeName] = await Promise.all([
            fetchWeatherOpenMeteo(loc.coords.latitude, loc.coords.longitude),
            reverseGeocode(loc.coords.longitude, loc.coords.latitude),
          ]);
          if (w && active) {
            result.push({
              id: 'current',
              label: placeName?.split(',')[0] || 'My Location',
              temp: w.currentTemp,
              condition: w.condition,
              icon: w.icon,
              isCurrentLocation: true,
              isStale: w.isStale,
              fetchedAt: w.fetchedAt,
            });
          }
        }
      } catch (_) {}

      if (userId) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const { data: trips } = await supabase
            .from('trips')
            .select('id, title, destination, trip_type, start_date')
            .eq('created_by', userId)
            .in('status', ['planning', 'confirmed'])
            .gte('end_date', today)
            .order('start_date', { ascending: true })
            .limit(4);

          if (trips && trips.length > 0) attemptedAny = true;

          for (const trip of trips || []) {
            try {
              const places = await searchPlaces(trip.destination);
              if (places.length > 0) {
                const [lng, lat] = places[0].center;
                const w = await fetchWeatherOpenMeteo(lat, lng);
                if (w && active) {
                  result.push({
                    id: trip.id,
                    label: trip.destination.split(',')[0],
                    sublabel: trip.title,
                    temp: w.currentTemp,
                    condition: w.condition,
                    icon: w.icon,
                    tripEmoji: TRIP_EMOJI[trip.trip_type] || '🗺️',
                    isStale: w.isStale,
                    fetchedAt: w.fetchedAt,
                  });
                }
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (active) {
        setCards(result);
        setAttempted(attemptedAny);
        setLoading(false);
      }
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

  if (cards.length === 0 && !attempted) return null;

  return (
    <View style={[weatherStyles.strip, { borderBottomColor: colors.border }]}>
      <View style={weatherStyles.stripHeader}>
        <Ionicons name="partly-sunny-outline" size={14} color={colors.subtext} />
        <Text style={[weatherStyles.stripTitle, { color: colors.subtext }]}>Live Weather</Text>
      </View>
      {cards.length === 0 ? (
        <Text style={[weatherStyles.noDataText, { color: colors.subtext }]}>No weather data available</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={weatherStyles.scrollRow}>
          {cards.map(card => (
            <WeatherCard key={card.id} card={card} colors={colors} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const weatherStyles = StyleSheet.create({
  strip: {
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  stripTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scrollRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  card: {
    width: 100,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    width: '100%',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  emoji: {
    fontSize: 28,
    marginVertical: 2,
  },
  temp: {
    fontSize: 18,
    fontWeight: '800',
  },
  condition: {
    fontSize: 10,
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  staleText: {
    fontSize: 8.5,
    marginTop: 3,
    textAlign: 'center',
    fontWeight: '700',
    color: '#F59E0B',
  },
  noDataText: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});

// ── Feed Screen ──────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#000',
    subtext: isDark ? '#A8A8A8' : '#737373',
    border: isDark ? '#262626' : '#DBDBDB',
    headerBg: isDark ? '#000' : '#fff',
    weatherCard: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    weatherBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  };

  const { user } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users(full_name, avatar_url, id)')
        .eq('visibility', 'public')
        .or('post_type.is.null,post_type.neq.trip_story')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!data || data.length === 0) return;

      // Fetch likes
      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user?.id || '');
      const likedIds = new Set((likes || []).map((l: any) => l.post_id));

      // Batch-fetch linked trips
      const tripIds = [...new Set(data.filter((p: any) => p.trip_id).map((p: any) => p.trip_id))];
      let tripsMap: Record<string, any> = {};
      if (tripIds.length > 0) {
        const { data: tripsData } = await supabase
          .from('trips')
          .select('id, status, trip_type, destination, title')
          .in('id', tripIds);
        tripsMap = Object.fromEntries((tripsData || []).map((t: any) => [t.id, t]));
      }

      const formatted = data.map((p: any) => ({
        id: p.id,
        user: {
          name: p.users?.full_name || 'Traveler',
          avatar: p.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.users?.full_name}`,
          id: p.user_id, // use raw FK column — auth.users.id === public.users.id
        },
        images: Array.isArray(p.media) ? p.media : [],
        content: p.content || '',
        youtube_url: p.youtube_url,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        timestamp: new Date(p.created_at).toLocaleDateString(),
        location: p.location,
        liked: likedIds.has(p.id),
        trip_id: p.trip_id,
        trip: p.trip_id ? tripsMap[p.trip_id] || undefined : undefined,
      }));

      setPosts(formatted);
    } catch (error) {
      console.error('Feed error:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const HeaderComponent = () => (
    <>
      <WeatherStrip userId={user?.id} colors={colors} />
      {/* Stories strip */}
      <View style={[styles.storiesSection, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: 'add', name: 'Your Story', isAdd: true },
            ...posts.map((p: any) => ({ id: p.id, name: p.user?.name, avatar: p.user?.avatar, isAdd: false })),
          ]}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.storiesList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.storyItem}>
              <View style={[styles.storyRing, { borderColor: item.isAdd ? 'transparent' : '#C13584' }]}>
                {item.isAdd ? (
                  <View style={[styles.addStoryBtn, { backgroundColor: colors.border }]}>
                    <Ionicons name="add" size={24} color="#3897F0" />
                  </View>
                ) : (
                  <Image source={{ uri: (item as any).avatar }} style={styles.storyAvatar} />
                )}
              </View>
              <Text style={[styles.storyName, { color: colors.text }]} numberOfLines={1}>
                {item.isAdd ? 'Your Story' : item.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>TrekRiderz</Text>
        <TouchableOpacity onPress={() => router.push('/post/create' as any)}>
          <Ionicons name="create-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<HeaderComponent />}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  storiesSection: { paddingVertical: 12, borderBottomWidth: 0.5 },
  storiesList: { paddingHorizontal: 12, gap: 12 },
  storyItem: { alignItems: 'center', width: 68 },
  storyRing: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 2, padding: 2, marginBottom: 4,
  },
  storyAvatar: { width: 52, height: 52, borderRadius: 26 },
  addStoryBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  storyName: { fontSize: 11, textAlign: 'center' },
});
