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

const LOCATION_CHIPS = [
  { id: '', label: 'All India', emoji: '🇮🇳' },
  { id: 'Himachal', label: 'Himachal', emoji: '⛰️' },
  { id: 'Uttarakhand', label: 'Uttarakhand', emoji: '🏔️' },
  { id: 'Kerala', label: 'Kerala', emoji: '🌴' },
  { id: 'Ladakh', label: 'Ladakh', emoji: '🏜️' },
  { id: 'Goa', label: 'Goa', emoji: '🏖️' },
  { id: 'Sikkim', label: 'Sikkim', emoji: '🌸' },
  { id: 'Karnataka', label: 'Karnataka', emoji: '🌿' },
  { id: 'Rajasthan', label: 'Rajasthan', emoji: '🏰' },
];

interface Homestay {
  id: string;
  name: string;
  location: string;
  price_per_night: number;
  rating: number;
  photos: string[];
  amenities: string[];
  rooms: number;
  capacity: number;
}

export default function HomestaysScreen() {
  const [homestays, setHomestays] = useState<Homestay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');

  useEffect(() => { fetchHomestays(); }, []);

  const fetchHomestays = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('homestays')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40);
      setHomestays(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = homestays.filter((h) => {
    const matchRegion = !region || h.location?.toLowerCase().includes(region.toLowerCase());
    const matchSearch = !search ||
      h.name?.toLowerCase().includes(search.toLowerCase()) ||
      h.location?.toLowerCase().includes(search.toLowerCase());
    return matchRegion && matchSearch;
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(140,198,63,0.2)', '#080C14']}
        style={styles.bgGradient}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Homestays</Text>
            <Text style={styles.headerSub}>Verified stays across India</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or location..."
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
          data={LOCATION_CHIPS}
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={{ flexGrow: 0, marginBottom: 14 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, region === item.id && styles.chipActive]}
              onPress={() => setRegion(item.id)}
            >
              <Text style={styles.chipEmoji}>{item.emoji}</Text>
              <Text style={[styles.chipLabel, region === item.id && styles.chipLabelActive]}>
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
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHomestays(); }} tintColor="#8CC63F" />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="home-outline" size={52} color="rgba(255,255,255,0.1)" />
                <Text style={styles.emptyText}>No homestays found</Text>
              </View>
            }
            renderItem={({ item }) => <HomestayCard homestay={item} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function HomestayCard({ homestay }: { homestay: Homestay }) {
  return (
    <TouchableOpacity
      style={card.wrap}
      onPress={() => router.push(`/homestay/${homestay.id}` as any)}
      activeOpacity={0.88}
    >
      {homestay.photos?.[0] ? (
        <Image source={{ uri: homestay.photos[0] }} style={card.image} contentFit="cover" />
      ) : (
        <View style={[card.image, card.imageFallback]}>
          <Ionicons name="home-outline" size={40} color="rgba(255,255,255,0.2)" />
        </View>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={card.overlay} />
      <View style={card.info}>
        <View style={card.badge}>
          <Text style={card.badgeText}>HOMESTAY</Text>
        </View>
        <Text style={card.name} numberOfLines={1}>{homestay.name}</Text>
        <View style={card.metaRow}>
          <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={card.location} numberOfLines={1}>{homestay.location}</Text>
        </View>
        <View style={card.footer}>
          <Text style={card.price}>₹{homestay.price_per_night?.toLocaleString()}<Text style={card.perUnit}>/night</Text></Text>
          {homestay.rating ? (
            <View style={card.rating}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={card.ratingText}>{homestay.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: { marginBottom: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)' },
  image: { width: '100%', height: 220 },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
  info: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#8CC63F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 1 },
  name: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  location: { fontSize: 12, color: 'rgba(255,255,255,0.6)', flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 15, fontWeight: '800', color: '#8CC63F' },
  perUnit: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.55)' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
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
  chipActive: { backgroundColor: '#8CC63F', borderColor: '#8CC63F' },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  chipLabelActive: { color: '#000' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
});
