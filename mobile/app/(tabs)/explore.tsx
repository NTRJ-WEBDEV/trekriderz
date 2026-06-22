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
import { searchPlaces } from '@/lib/geocoding';
import PostCard from '@/components/PostCard';

const MOCK_POSTS = [
  {
    id: 'mock1',
    user: { name: 'Arun Kumar', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Arun', id: 'u1' },
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    ],
    content: 'Just completed Triund Trek! The view from the top is absolutely breathtaking 🏔️ #Triund #HimachalPradesh',
    likes_count: 142,
    comments_count: 23,
    timestamp: '2 hours ago',
    location: 'Triund, Himachal Pradesh',
    liked: false,
    trip: { status: 'completed', trip_type: 'trek', destination: 'Triund, HP', title: 'Triund Trek' },
  },
  {
    id: 'mock2',
    user: { name: 'Priya Sharma', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya', id: 'u2' },
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'],
    content: 'Solo bike trip to Spiti Valley complete! 900km in 5 days. India is beautiful 🏍️',
    likes_count: 89,
    comments_count: 15,
    timestamp: '5 hours ago',
    location: 'Spiti Valley, HP',
    liked: true,
    trip: { status: 'completed', trip_type: 'bike', destination: 'Spiti Valley', title: 'Spiti Ride' },
  },
  {
    id: 'mock3',
    user: { name: 'Rahul Nair', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul', id: 'u3' },
    images: ['https://images.unsplash.com/photo-1587502537745-84b86da1204f?w=800'],
    content: 'Kedarkantha summit done ✅ -10°C but worth every step. Tip: start at 2am for sunrise views!',
    likes_count: 203,
    comments_count: 41,
    timestamp: '1 day ago',
    location: 'Kedarkantha, Uttarakhand',
    liked: false,
    trip: { status: 'completed', trip_type: 'trek', destination: 'Kedarkantha', title: 'Winter Summit' },
  },
];

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

export default function ExploreScreen() {
  const isDark = true; // App is always dark-themed
  const colors = {
    bg: '#000',
    text: '#fff',
    subtext: '#A8A8A8',
    border: '#262626',
    headerBg: '#000',
    weatherCard: 'rgba(255,255,255,0.06)',
    weatherBorder: 'rgba(255,255,255,0.1)',
  };

  const { user } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, users:user_id(id, full_name, avatar_url)')
        .eq('visibility', 'public')
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
          name: p.users?.full_name || 'Traveler',
          avatar: p.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.users?.full_name}`,
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

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const HeaderComponent = () => (
    <>
      <WeatherStrip userId={user?.id} colors={colors} />
      <View style={[styles.storiesSection, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: 'add', name: 'Your Story', isAdd: true },
            ...posts.map((p: any) => ({ id: p.id, name: p.user?.name, avatar: p.user?.avatar, isAdd: false })),
          ]}
          keyExtractor={(item) => item.id}
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
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>TrekRiderz</Text>
        <TouchableOpacity onPress={() => router.push('/post/create' as any)}>
          <Ionicons name="create-outline" size={26} color={colors.text} />
        </TouchableOpacity>
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
  headerTitle: { fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  storiesSection: { paddingVertical: 12, borderBottomWidth: 0.5 },
  storiesList: { paddingHorizontal: 12, gap: 12 },
  storyItem: { alignItems: 'center', width: 68 },
  storyRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, padding: 2, marginBottom: 4 },
  storyAvatar: { width: 52, height: 52, borderRadius: 26 },
  addStoryBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  storyName: { fontSize: 11, textAlign: 'center' },
});
