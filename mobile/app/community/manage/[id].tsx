import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors } from '@/constants/theme';

const BG = AppColors.background;
const GREEN = AppColors.primary;

type ManageTab = 'requests' | 'members';

interface MemberRow {
  user_id: string;
  status: string;
  role: string;
  joined_at: string;
  users: { id: string; full_name: string; avatar_url: string | null };
}

export default function CommunityManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<ManageTab>('requests');
  const [community, setCommunity] = useState<any>(null);
  const [requests, setRequests] = useState<MemberRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: comm }, { data: allMembers }] = await Promise.all([
        supabase.from('communities').select('*').eq('id', id).single(),
        supabase
          .from('community_members')
          .select('user_id, status, role, joined_at, users:user_id(id, full_name, avatar_url)')
          .eq('community_id', id)
          .order('joined_at', { ascending: false }),
      ]);

      setCommunity(comm);
      setRequests((allMembers || []).filter((m: any) => m.status === 'pending') as unknown as MemberRow[]);
      setMembers((allMembers || []).filter((m: any) => m.status === 'approved') as unknown as MemberRow[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (memberId: string, memberName: string) => {
    const row = requests.find((r) => r.user_id === memberId);
    setRequests((prev) => prev.filter((r) => r.user_id !== memberId));
    if (row) setMembers((prev) => [{ ...row, status: 'approved' }, ...prev]);

    try {
      await supabase
        .from('community_members')
        .update({ status: 'approved' })
        .eq('community_id', id)
        .eq('user_id', memberId);

      // Increment member count
      supabase.rpc('increment_community_members', { community_id: id });

      // Notify the user they were approved — best-effort, doesn't roll back
      // the approval itself if it fails, but logged rather than swallowed.
      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: memberId,
        sender_id: user?.id,
        type: 'community_approved',
        title: 'Request Approved! 🎉',
        message: `You're now a member of "${community?.name}"`,
        related_id: id,
        metadata: { community_id: id },
      });
      if (notifyError) console.error('Failed to notify approved member:', notifyError);
    } catch {
      // Revert
      fetchData();
      Alert.alert('Error', 'Failed to approve request.');
    }
  };

  const rejectRequest = async (memberId: string) => {
    setRequests((prev) => prev.filter((r) => r.user_id !== memberId));
    try {
      await supabase
        .from('community_members')
        .update({ status: 'rejected' })
        .eq('community_id', id)
        .eq('user_id', memberId);

      const { error: notifyError } = await supabase.from('notifications').insert({
        user_id: memberId,
        sender_id: user?.id,
        type: 'community_rejected',
        title: 'Join Request Declined',
        message: `Your request to join "${community?.name}" was not approved.`,
        related_id: id,
        metadata: { community_id: id },
      });
      if (notifyError) console.error('Failed to notify rejected member:', notifyError);
    } catch {
      fetchData();
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (memberId === user?.id) {
      Alert.alert('Error', "You can't remove yourself as the owner.");
      return;
    }
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from the community?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
            await supabase
              .from('community_members')
              .delete()
              .eq('community_id', id)
              .eq('user_id', memberId);
          },
        },
      ]
    );
  };

  const AvatarIcon = ({ member }: { member: MemberRow }) => (
    member.users?.avatar_url ? (
      <Image source={{ uri: member.users.avatar_url }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Text style={styles.avatarInitial}>{member.users?.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
    )
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={GREEN} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{community?.name}</Text>
          <Text style={styles.headerSub}>Community Management</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'requests' && styles.tabBtnActive]}
          onPress={() => setTab('requests')}
        >
          <Text style={[styles.tabLabel, tab === 'requests' && styles.tabLabelActive]}>
            Requests
          </Text>
          {requests.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{requests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'members' && styles.tabBtnActive]}
          onPress={() => setTab('members')}
        >
          <Text style={[styles.tabLabel, tab === 'members' && styles.tabLabelActive]}>
            Members ({members.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
      ) : tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <AvatarIcon member={item} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.users?.full_name || 'Traveler'}</Text>
                <Text style={styles.rowMeta}>
                  Requested {new Date(item.joined_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <View style={styles.actionBtns}>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => rejectRequest(item.user_id)}
                >
                  <Ionicons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveRequest(item.user_id, item.users?.full_name)}
                >
                  <Ionicons name="checkmark" size={18} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No approved members yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isOwner = item.user_id === user?.id;
            return (
              <View style={styles.row}>
                <AvatarIcon member={item} />
                <View style={styles.rowInfo}>
                  <View style={styles.rowNameRow}>
                    <Text style={styles.rowName}>{item.users?.full_name || 'Traveler'}</Text>
                    {isOwner && (
                      <View style={styles.ownerBadge}>
                        <Text style={styles.ownerBadgeText}>Owner</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowMeta}>
                    Joined {new Date(item.joined_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                {!isOwner && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeMember(item.user_id, item.users?.full_name)}
                  >
                    <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  headerSub: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: GREEN },
  tabLabel: { color: 'rgba(255,255,255,0.4)', fontWeight: '700', fontSize: 14 },
  tabLabelActive: { color: GREEN },
  tabBadge: {
    backgroundColor: '#EF4444', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  tabBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: GREEN, fontWeight: '700', fontSize: 18 },
  rowInfo: { flex: 1 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  rowMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 3 },
  ownerBadge: {
    backgroundColor: 'rgba(140,198,63,0.15)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
  },
  ownerBadgeText: { color: GREEN, fontSize: 10, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1.5,
    borderColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
  },
  approveBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 74 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 15 },
});
