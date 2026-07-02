import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { haptic } from '@/lib/haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const SECTIONS = [
  {
    id: 'treks',
    label: 'Treks',
    emoji: '⛰️',
    description: 'Mountain & trail adventures',
    route: '/discover?type=trek',
    color: '#8CC63F',
    iconName: 'walk-outline',
  },
  {
    id: 'stories',
    label: 'Stories',
    emoji: '📖',
    description: 'Trek & travel journeys',
    route: '/stories',
    color: '#EC4899',
    iconName: 'book-outline',
  },
  {
    id: 'guides',
    label: 'Guides',
    emoji: '🧭',
    description: 'Verified local experts',
    route: '/guides',
    color: '#1E88E5',
    iconName: 'compass-outline',
  },
  {
    id: 'homestays',
    label: 'Homestays',
    emoji: '🏡',
    description: 'Cozy stays across India',
    route: '/homestays',
    color: '#F59E0B',
    iconName: 'home-outline',
  },
  {
    id: 'community',
    label: 'Community',
    emoji: '👥',
    description: 'Find your tribe',
    route: '/community',
    color: '#8B5CF6',
    iconName: 'people-outline',
  },
  {
    id: 'expeditions',
    label: 'Expeditions',
    emoji: '🏔️',
    description: 'Guide-led expeditions',
    route: '/expeditions',
    color: '#EF4444',
    iconName: 'flag-outline',
  },
  {
    id: 'rentals',
    label: 'Rentals',
    emoji: '🏍️',
    description: 'Bikes, cars & more',
    route: '/rentals',
    color: '#F97316',
    iconName: 'car-outline',
  },
] as const;

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const [trips, setTrips] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchTrips();
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', user?.id)
      .single();
    if (data) setProfile(data);
  };

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('id, title, destination, start_date, trip_type, status')
      .eq('created_by', user?.id)
      .in('status', ['planning', 'confirmed'])
      .order('start_date', { ascending: true })
      .limit(3);
    setTrips(data || []);
    setRefreshing(false);
  };

  const firstName = (profile?.full_name || user?.user_metadata?.full_name)?.split(' ')[0] || 'Adventurer';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}&background=8CC63F&color=fff`;

  const TRIP_EMOJI: Record<string, string> = {
    trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒', weekend: '🌄',
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTrips(); fetchProfile(); }} tintColor="#8CC63F" />
        }
      >
        {/* ── HERO ── */}
        <ImageBackground
          source={require('@/assets/images/background-2.png')}
          style={styles.hero}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(8,12,20,0.45)', 'rgba(8,12,20,0.55)', 'rgba(8,12,20,1)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <View style={styles.logoRow}>
                <Ionicons name="triangle" size={16} color="#8CC63F" />
                <Text style={styles.logoText}>TREK<Text style={styles.logoGreen}>RIDERZ</Text></Text>
              </View>
              <View style={styles.topRight}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/notifications' as any)}>
                  <Ionicons name="notifications-outline" size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)}>
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroContent}>
              <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
              <Text style={styles.heroTitle}>
                Where are you{'\n'}
                <Text style={styles.heroGreen}>going next?</Text>
              </Text>
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={styles.body}>

          {/* ── NAVIGATION GRID ── */}
          <Text style={styles.sectionTitle}>Explore</Text>
          <View style={styles.grid}>
            {SECTIONS.map((section) => (
              <TouchableOpacity
                key={section.id}
                style={styles.gridCard}
                onPress={() => { haptic.light(); router.push(section.route as any); }}
                activeOpacity={1}
              >
                <View style={[styles.cardIconWrap, { backgroundColor: section.color + '22' }]}>
                  <Text style={styles.cardEmoji}>{section.emoji}</Text>
                </View>
                <Text style={styles.cardLabel}>{section.label}</Text>
                <Text style={styles.cardDesc} numberOfLines={1}>{section.description}</Text>
                <View style={[styles.cardArrow, { backgroundColor: section.color + '22' }]}>
                  <Ionicons name="arrow-forward" size={12} color={section.color} />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── AI PLANNER BANNER ── */}
          <TouchableOpacity
            style={styles.aiBanner}
            onPress={() => { haptic.medium(); router.push('/ai-planner' as any); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(140,198,63,0.25)', 'rgba(30,136,229,0.2)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
            <View style={styles.aiBannerLeft}>
              <View style={styles.aiBannerBadge}>
                <Ionicons name="sparkles" size={11} color={GREEN} />
                <Text style={styles.aiBannerBadgeText}>AI POWERED</Text>
              </View>
              <Text style={styles.aiBannerTitle}>Plan Your Dream Trip</Text>
              <Text style={styles.aiBannerSub}>
                Birthday · Anniversary · Women Trek · Custom
              </Text>
            </View>
            <View style={styles.aiBannerRight}>
              <Text style={styles.aiBannerEmoji}>✨</Text>
              <Ionicons name="arrow-forward" size={20} color={GREEN} />
            </View>
          </TouchableOpacity>

          {/* ── YOUR UPCOMING TRIPS ── */}
          {trips.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <View style={styles.rowHeader}>
                <Text style={styles.sectionTitle}>Your Trips</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/create' as any)}>
                  <Text style={styles.seeAll}>+ New</Text>
                </TouchableOpacity>
              </View>
              {trips.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.tripRow}
                  onPress={() => router.push(`/trip/${t.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.tripEmojiWrap}>
                    <Text style={styles.tripEmoji}>{TRIP_EMOJI[t.trip_type] || '🗺️'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.tripMeta} numberOfLines={1}>📍 {t.destination}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#8CC63F" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── FOOTER ── */}
          <View style={styles.footer}>
            <Text style={styles.footerBold}>ALL YOU NEED.</Text>
            <Text style={styles.footerSub}>ONE APP.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const GREEN = '#8CC63F';
const BG = '#080C14';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  hero: { width: '100%', height: 340 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { fontSize: 17, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  logoGreen: { color: GREEN },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  heroContent: { marginTop: 'auto', paddingHorizontal: 20, paddingBottom: 28 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginBottom: 6 },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', lineHeight: 40 },
  heroGreen: { color: GREEN },

  body: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 18, fontWeight: '800', color: '#FFF',
    marginTop: 24, marginBottom: 14,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 13, color: GREEN, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 6,
  },
  cardIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  cardEmoji: { fontSize: 24 },
  cardLabel: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  cardDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 15 },
  cardArrow: {
    alignSelf: 'flex-start',
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },

  tripRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tripEmojiWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  tripEmoji: { fontSize: 20 },
  tripTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 3 },
  tripMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  aiBanner: {
    marginTop: 24,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GREEN + '40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: 'rgba(140,198,63,0.06)',
  },
  aiBannerLeft: { flex: 1, gap: 4 },
  aiBannerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN + '18', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
    marginBottom: 4,
  },
  aiBannerBadgeText: { fontSize: 9, fontWeight: '900', color: GREEN, letterSpacing: 1 },
  aiBannerTitle: { fontSize: 17, fontWeight: '900', color: '#FFF' },
  aiBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  aiBannerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 12 },
  aiBannerEmoji: { fontSize: 32 },

  footer: { alignItems: 'center', marginTop: 48, gap: 2 },
  footerBold: { fontSize: 20, fontWeight: '900', color: '#FFF', letterSpacing: 3 },
  footerSub: { fontSize: 12, color: GREEN, fontWeight: '700', letterSpacing: 2 },
});
