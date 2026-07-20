import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, TextInput, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { AppColors } from '@/constants/theme';

const BG = AppColors.background;
const GREEN = AppColors.primary;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🌍' },
  { id: 'trek', label: 'Treks', emoji: '⛰️' },
  { id: 'wildlife', label: 'Wildlife', emoji: '🦁' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { id: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { id: 'photography', label: 'Photography', emoji: '📸' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴' },
];

type MemberStatus = 'none' | 'pending' | 'approved';

interface CommunityItem {
  id: string;
  name: string;
  description: string;
  category: string;
  cover_image: string | null;
  member_count: number;
  created_by: string;
  memberStatus: MemberStatus;
}

export default function CommunityListScreen({ embedded }: { embedded?: boolean } = {}) {
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [canCreate, setCanCreate] = useState(false);

  useFocusEffect(useCallback(() => { fetchData(); }, [user?.id]));

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Check creation eligibility: staff with communities.manage, or a premium approved guide
      const { data: guideData } = await supabase
        .from('guides').select('is_premium, status').eq('user_id', user.id).maybeSingle();
      setCanCreate(
        hasPermission('communities.manage') ||
        (guideData?.status === 'approved' && guideData?.is_premium === true)
      );

      // Fetch communities + user's membership statuses
      const [{ data: comms }, { data: memberRows }] = await Promise.all([
        supabase.from('communities').select('*').order('member_count', { ascending: false }),
        supabase.from('community_members').select('community_id, status').eq('user_id', user.id),
      ]);

      const statusMap: Record<string, MemberStatus> = {};
      (memberRows || []).forEach((m: any) => {
        statusMap[m.community_id] = m.status as MemberStatus;
      });

      setCommunities(
        (comms || []).map((c: any) => ({
          ...c,
          memberStatus: statusMap[c.id] ?? 'none',
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const requestJoin = async (community: CommunityItem) => {
    // Optimistic update
    setCommunities((prev) =>
      prev.map((c) => c.id === community.id ? { ...c, memberStatus: 'pending' } : c)
    );

    try {
      const { error } = await supabase.from('community_members').insert({
        community_id: community.id,
        user_id: user?.id,
        status: 'pending',
      });
      if (error) throw error;

      // Notify community owner — best-effort, doesn't roll back the join
      // request itself if it fails, but logging (rather than swallowing
      // silently) so a broken notification insert doesn't go unnoticed again.
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: community.created_by,
        sender_id: user?.id,
        type: 'community_join_request',
        title: 'New Join Request',
        message: `${user?.user_metadata?.full_name || 'Someone'} wants to join "${community.name}"`,
        related_id: community.id,
        metadata: { community_id: community.id },
      });
      if (notifyError) console.error('Failed to notify community owner:', notifyError);
    } catch {
      // Revert on error
      setCommunities((prev) =>
        prev.map((c) => c.id === community.id ? { ...c, memberStatus: 'none' } : c)
      );
      Alert.alert('Error', 'Failed to send join request.');
    }
  };

  const cancelRequest = async (communityId: string) => {
    setCommunities((prev) =>
      prev.map((c) => c.id === communityId ? { ...c, memberStatus: 'none' } : c)
    );
    await supabase.from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', user?.id);
  };

  const filtered = communities.filter((c) => {
    const matchCat = category === 'all' || c.category === category;
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const JoinButton = ({ item }: { item: CommunityItem }) => {
    const isOwner = item.created_by === user?.id;

    if (isOwner) {
      return (
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => router.push(`/community/manage/${item.id}` as any)}
        >
          <Ionicons name="settings-outline" size={14} color={GREEN} />
          <Text style={styles.manageBtnText}>Manage</Text>
        </TouchableOpacity>
      );
    }

    if (item.memberStatus === 'approved') {
      return (
        <View style={styles.joinedBtn}>
          <Ionicons name="checkmark" size={14} color="#000" />
          <Text style={styles.joinedBtnText}>Joined</Text>
        </View>
      );
    }

    if (item.memberStatus === 'pending') {
      return (
        <TouchableOpacity
          style={styles.pendingBtn}
          onPress={() => {
            Alert.alert('Cancel Request?', 'Withdraw your join request?', [
              { text: 'Keep', style: 'cancel' },
              { text: 'Cancel Request', style: 'destructive', onPress: () => cancelRequest(item.id) },
            ]);
          }}
        >
          <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.pendingBtnText}>Pending</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.requestBtn} onPress={() => requestJoin(item)}>
        <Text style={styles.requestBtnText}>Request</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={embedded ? ['left', 'right', 'bottom'] : undefined}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {!embedded && (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.title}>Communities</Text>
            <Text style={styles.subtitle}>Find your tribe of adventurers</Text>
          </View>
        </View>
        {canCreate && (
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/community/create' as any)}
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.createBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={17} color="rgba(255,255,255,0.35)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.categoryCell, category === item.id && styles.categoryCellActive]}
            onPress={() => setCategory(item.id)}
            activeOpacity={0.75}
          >
            <Text style={styles.categoryEmoji}>{item.emoji}</Text>
            <Text style={[styles.categoryLabel, category === item.id && styles.categoryLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyTitle}>No communities yet</Text>
              {canCreate && (
                <Text style={styles.emptyDesc}>Create the first community for your region or interest.</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/community/${item.id}` as any)}
              activeOpacity={0.8}
            >
              {item.cover_image ? (
                <Image source={{ uri: item.cover_image }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                  <Text style={styles.coverEmoji}>
                    {CATEGORIES.find(c => c.id === item.category)?.emoji ?? '🌍'}
                  </Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardMeta}>
                      {item.member_count} members · {item.category}
                    </Text>
                  </View>
                  <JoinButton item={item} />
                </View>
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GREEN, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  createBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, gap: 8, marginBottom: 14,
  },
  categoryCell: {
    width: (SCREEN_WIDTH - 28 - 24) / 4,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  categoryCellActive: {
    backgroundColor: 'rgba(140,198,63,0.15)',
    borderColor: GREEN,
  },
  categoryEmoji: { fontSize: 26 },
  categoryLabel: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10,
    fontWeight: '700', textAlign: 'center',
  },
  categoryLabelActive: { color: GREEN },
  list: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cover: { width: '100%', height: 110 },
  coverFallback: { backgroundColor: 'rgba(140,198,63,0.08)', alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 40 },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 },
  cardName: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  cardMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  cardDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19 },
  requestBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1.5, borderColor: GREEN,
  },
  requestBtnText: { color: GREEN, fontWeight: '700', fontSize: 13 },
  pendingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pendingBtnText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 12 },
  joinedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: GREEN,
  },
  joinedBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: GREEN,
    backgroundColor: 'rgba(140,198,63,0.08)',
  },
  manageBtnText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600' },
  emptyDesc: { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});
