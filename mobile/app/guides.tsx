import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import VerifiedBadge from '@/components/VerifiedBadge';

const SPECIALTY_CHIPS = [
  { id: '', label: 'All', emoji: '🧭' },
  { id: 'trek', label: 'Trekking', emoji: '⛰️' },
  { id: 'bike', label: 'Biking', emoji: '🏍️' },
  { id: 'wildlife', label: 'Wildlife', emoji: '🦁' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { id: 'photography', label: 'Photography', emoji: '📸' },
  { id: 'camping', label: 'Camping', emoji: '⛺' },
];

interface Guide {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  regions: string[];
  languages: string[];
  rate_per_day: number;
  rating: number;
  experience_years: number;
  photo_url: string;
  is_premium: boolean;
}

export default function GuidesScreen() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');

  useEffect(() => { fetchGuides(); }, []);

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('guides')
        .select('*')
        .eq('status', 'approved')
        .order('is_premium', { ascending: false })
        .limit(40);
      setGuides(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = guides.filter((g) => {
    const specs = Array.isArray(g.specialties) ? g.specialties.join(' ') : '';
    const regions = Array.isArray(g.regions) ? g.regions.join(' ') : '';
    const matchSpecialty = !specialty || specs.toLowerCase().includes(specialty.toLowerCase());
    const matchSearch = !search ||
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      regions.toLowerCase().includes(search.toLowerCase()) ||
      specs.toLowerCase().includes(search.toLowerCase());
    return matchSpecialty && matchSearch;
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(30,136,229,0.2)', '#080C14']}
        style={styles.bgGradient}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Local Guides</Text>
            <Text style={styles.headerSub}>Verified trek & travel experts</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or region..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          horizontal
          data={SPECIALTY_CHIPS}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={{ flexGrow: 0, marginBottom: 14 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, specialty === item.id && styles.chipActive]}
              onPress={() => setSpecialty(item.id)}
            >
              <Text style={styles.chipEmoji}>{item.emoji}</Text>
              <Text style={[styles.chipLabel, specialty === item.id && styles.chipLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {loading ? (
          <ActivityIndicator color="#8CC63F" style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGuides(); }} tintColor="#8CC63F" />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="person-outline" size={52} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>No guides found</Text>
              </View>
            }
            renderItem={({ item }) => <GuideCard guide={item} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function GuideCard({ guide }: { guide: Guide }) {
  const specialties = Array.isArray(guide.specialties) ? guide.specialties.slice(0, 2) : [];
  const regions = Array.isArray(guide.regions) ? guide.regions.slice(0, 2).join(', ') : '';

  return (
    <TouchableOpacity
      style={card.wrap}
      onPress={() => router.push(`/guide/${guide.id}` as any)}
      activeOpacity={0.88}
    >
      {guide.photo_url ? (
        <Image source={{ uri: guide.photo_url }} style={card.image} contentFit="cover" />
      ) : (
        <View style={[card.image, card.imageFallback]}>
          <Ionicons name="person-outline" size={40} color="rgba(255,255,255,0.2)" />
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.92)']} style={card.overlay} />
      <View style={card.info}>
        <View style={card.topRow}>
          <View style={card.badge}>
            <Text style={card.badgeText}>GUIDE</Text>
          </View>
          <VerifiedBadge isPremium={guide.is_premium} size="sm" />
        </View>
        <Text style={card.name} numberOfLines={1}>{guide.name}</Text>
        {regions ? (
          <View style={card.metaRow}>
            <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={card.meta} numberOfLines={1}>{regions}</Text>
          </View>
        ) : null}
        {specialties.length > 0 && (
          <View style={card.tagsRow}>
            {specialties.map((s: string) => (
              <View key={s} style={card.tag}>
                <Text style={card.tagText}>{s}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={card.footer}>
          <Text style={card.price}>₹{guide.rate_per_day?.toLocaleString()}<Text style={card.perUnit}>/day</Text></Text>
          <View style={card.statRow}>
            {guide.rating ? (
              <View style={card.rating}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={card.ratingText}>{guide.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <Text style={card.exp}>{guide.experience_years}yr exp</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: { marginBottom: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  image: { width: '100%', height: 240 },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#1E88E5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
  },
  premiumText: { fontSize: 9, fontWeight: '800', color: '#FFD700', letterSpacing: 0.8 },
  name: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1 },
  tagsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tag: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 10, fontWeight: '600', color: '#FFF' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 15, fontWeight: '800', color: '#8CC63F' },
  perUnit: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.5)' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  exp: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: { backgroundColor: '#1E88E5', borderColor: '#1E88E5' },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  chipLabelActive: { color: '#FFF' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
});
