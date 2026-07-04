import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  under_review: '#3B82F6',
  approved: '#8CC63F',
  rejected: '#EF4444',
  suspended: '#EF4444',
};

export default function MyPropertiesScreen() {
  const { user } = useAuthStore();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProperties = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, cover_photo_url, city, state, status, room_types(id, max_occupancy, total_units)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProperties(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchProperties(); }, [fetchProperties]));

  const onRefresh = () => { setRefreshing(true); fetchProperties(); };

  const openProperty = (p: any) => {
    if (p.status === 'approved') router.push(`/host/manage?id=${p.id}` as any);
    else router.push(`/host/status?id=${p.id}` as any);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={GREEN} /></View>;
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Properties</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/host/create' as any)}>
          <Ionicons name="add" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
      >
        {properties.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="home-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyText}>No properties listed yet</Text>
            <TouchableOpacity style={s.addPropertyBtn} onPress={() => router.push('/host/create' as any)}>
              <Text style={s.addPropertyBtnText}>Add New Property</Text>
            </TouchableOpacity>
          </View>
        ) : (
          properties.map((p) => {
            const roomCount = p.room_types?.length || 0;
            const totalCapacity = (p.room_types || []).reduce((sum: number, r: any) => sum + (r.max_occupancy || 0) * (r.total_units || 1), 0);
            const color = STATUS_COLORS[p.status] || '#9CA3AF';
            return (
              <TouchableOpacity key={p.id} style={s.card} onPress={() => openProperty(p)} activeOpacity={0.85}>
                {p.cover_photo_url ? (
                  <Image source={{ uri: p.cover_photo_url }} style={s.cardImg} contentFit="cover" />
                ) : (
                  <View style={[s.cardImg, s.cardImgFallback]}>
                    <Ionicons name="home-outline" size={22} color="rgba(255,255,255,0.2)" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.cardSub}>{p.city}, {p.state}</Text>
                  <Text style={s.cardMeta}>{roomCount} room type{roomCount !== 1 ? 's' : ''} · {totalCapacity} guests capacity</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: `${color}20` }]}>
                  <Text style={[s.statusPillText, { color }]}>{p.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            );
          })
        )}
        {properties.length > 0 && (
          <TouchableOpacity style={s.addAnotherBtn} onPress={() => router.push('/host/create' as any)}>
            <Ionicons name="add-circle-outline" size={18} color={GREEN} />
            <Text style={s.addAnotherText}>Add New Property</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardImg: { width: 56, height: 56, borderRadius: 12 },
  cardImgFallback: { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  cardName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  cardSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  cardMeta: { color: GREEN, fontSize: 11, marginTop: 3, fontWeight: '600' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  addPropertyBtn: { backgroundColor: GREEN, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  addPropertyBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  addAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)', borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14, marginTop: 4,
  },
  addAnotherText: { color: GREEN, fontWeight: '700', fontSize: 14 },
});
