import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

type Tab = 'homestays' | 'guides' | 'communities' | 'users';

const ROLES = ['user', 'guide', 'homestay_owner', 'admin'] as const;
const CATEGORIES = ['general', 'trekking', 'travel', 'photography', 'gear', 'safety', 'guides', 'homestays'];

interface Stats {
  users: number;
  pendingHomestays: number;
  pendingGuides: number;
  activeTrips: number;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('homestays');
  const [stats, setStats] = useState<Stats>({ users: 0, pendingHomestays: 0, pendingGuides: 0, activeTrips: 0 });
  const [homestays, setHomestays] = useState<any[]>([]);
  const [guides, setGuides] = useState<any[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Moderation state
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectType, setRejectType] = useState<'homestays' | 'guides'>('homestays');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Community creation state
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [communityForm, setCommunityForm] = useState({ name: '', description: '', category: 'general', is_private: false });
  const [communityLoading, setCommunityLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [
        usersRes, pendingHsRes, pendingGRes, tripsRes,
        hsRes, gRes, commRes, usersListRes,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('homestays').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('guides').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('trips').select('id', { count: 'exact', head: true }).in('status', ['planning', 'confirmed']),
        supabase.from('homestays')
          .select('*, owner:users!owner_id(full_name, avatar_url)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase.from('guides')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase.from('communities')
          .select('*, creator:created_by(full_name)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('users')
          .select('id, full_name, email, role, created_at')
          .order('created_at', { ascending: false })
          .limit(60),
      ]);

      setStats({
        users: usersRes.count ?? 0,
        pendingHomestays: pendingHsRes.count ?? 0,
        pendingGuides: pendingGRes.count ?? 0,
        activeTrips: tripsRes.count ?? 0,
      });
      setHomestays(hsRes.data || []);
      setGuides(gRes.data || []);
      setCommunities(commRes.data || []);
      setUsers(usersListRes.data || []);
    } catch (e) {
      console.error('Admin load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Moderation ────────────────────────────────────────────────────────────

  const handleApprove = async (id: string, type: 'homestays' | 'guides') => {
    setActionLoading(id);
    try {
      const table = type === 'homestays' ? 'homestays' : 'guides';
      const { error } = await supabase
        .from(table)
        .update({ status: 'approved', verified_at: new Date().toISOString(), verified_by: user?.id })
        .eq('id', id);
      if (error) throw error;

      const item = type === 'homestays' ? homestays.find(h => h.id === id) : guides.find(g => g.id === id);
      const recipientId = type === 'homestays' ? item?.owner_id : item?.user_id;
      if (recipientId) {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: type === 'homestays' ? 'homestay_approved' : 'guide_approved',
          title: `${type === 'homestays' ? 'Homestay' : 'Guide profile'} Approved!`,
          message: `Your ${type === 'homestays' ? 'homestay' : 'guide profile'} has been verified on TrekRiderz.`,
          related_id: id,
        });
      }

      if (type === 'homestays') setHomestays(prev => prev.filter(h => h.id !== id));
      else setGuides(prev => prev.filter(g => g.id !== id));
      setStats(prev => ({
        ...prev,
        pendingHomestays: type === 'homestays' ? prev.pendingHomestays - 1 : prev.pendingHomestays,
        pendingGuides: type === 'guides' ? prev.pendingGuides - 1 : prev.pendingGuides,
      }));
      Alert.alert('Approved', `${type === 'homestays' ? 'Homestay' : 'Guide'} has been verified successfully.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not approve. Try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (id: string, type: 'homestays' | 'guides') => {
    setRejectModalId(id);
    setRejectType(type);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectModalId) return;
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejection.');
      return;
    }
    setActionLoading(rejectModalId);
    try {
      const table = rejectType === 'homestays' ? 'homestays' : 'guides';
      const { error } = await supabase
        .from(table)
        .update({ status: 'rejected', rejection_reason: rejectReason.trim() })
        .eq('id', rejectModalId);
      if (error) throw error;

      const item = rejectType === 'homestays'
        ? homestays.find(h => h.id === rejectModalId)
        : guides.find(g => g.id === rejectModalId);
      const recipientId = rejectType === 'homestays' ? item?.owner_id : item?.user_id;
      if (recipientId) {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'other',
          title: `${rejectType === 'homestays' ? 'Homestay' : 'Guide profile'} Not Approved`,
          message: rejectReason.trim(),
          related_id: rejectModalId,
        });
      }

      if (rejectType === 'homestays') setHomestays(prev => prev.filter(h => h.id !== rejectModalId));
      else setGuides(prev => prev.filter(g => g.id !== rejectModalId));
      setStats(prev => ({
        ...prev,
        pendingHomestays: rejectType === 'homestays' ? prev.pendingHomestays - 1 : prev.pendingHomestays,
        pendingGuides: rejectType === 'guides' ? prev.pendingGuides - 1 : prev.pendingGuides,
      }));
      setRejectModalId(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not reject.');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Communities ───────────────────────────────────────────────────────────

  const handleCreateCommunity = async () => {
    if (!communityForm.name.trim()) {
      Alert.alert('Required', 'Please enter a community name.');
      return;
    }
    setCommunityLoading(true);
    try {
      const { error } = await supabase.from('communities').insert({
        name: communityForm.name.trim(),
        description: communityForm.description.trim() || null,
        category: communityForm.category,
        is_private: communityForm.is_private,
        created_by: user?.id,
      });
      if (error) throw error;
      setCommunityForm({ name: '', description: '', category: 'general', is_private: false });
      setShowCreateCommunity(false);
      load();
      Alert.alert('Created', `Community "${communityForm.name.trim()}" has been created.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create community.');
    } finally {
      setCommunityLoading(false);
    }
  };

  const handleDeleteCommunity = (id: string, name: string) => {
    Alert.alert(
      'Delete Community',
      `Delete "${name}"? All posts and members will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('communities').delete().eq('id', id);
              setCommunities(prev => prev.filter(c => c.id !== id));
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not delete community.');
            }
          },
        },
      ]
    );
  };

  // ── Users ─────────────────────────────────────────────────────────────────

  const handleRoleChange = (userId: string, currentRole: string) => {
    const options = ROLES.filter(r => r !== currentRole).map(r => ({
      text: r.replace('_', ' '),
      onPress: async () => {
        try {
          await supabase.from('users').update({ role: r }).eq('id', userId);
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: r } : u));
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Could not update role.');
        }
      },
    }));
    Alert.alert(
      'Change Role',
      `Current role: ${currentRole.replace('_', ' ')}`,
      [...options, { text: 'Cancel', style: 'cancel' as const }]
    );
  };

  // ── Tab content ───────────────────────────────────────────────────────────

  const pendingList = tab === 'homestays' ? homestays : guides;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Admin Panel</Text>
            <Text style={styles.headerSub}>TrekRiderz CMS</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/add-guide' as any)}>
              <Ionicons name="person-add-outline" size={18} color={GREEN} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/admin/add-homestay' as any)}>
              <Ionicons name="home-outline" size={18} color={GREEN} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={styles.loadingText}>Loading dashboard…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={GREEN} />
          }
        >
          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard icon="people-outline" label="Users" value={stats.users} color="#3897F0" />
            <StatCard icon="home-outline" label="Pending Stays" value={stats.pendingHomestays} color="#F97316" alert={stats.pendingHomestays > 0} />
            <StatCard icon="ribbon-outline" label="Pending Guides" value={stats.pendingGuides} color="#8B5CF6" alert={stats.pendingGuides > 0} />
            <StatCard icon="map-outline" label="Active Trips" value={stats.activeTrips} color={GREEN} />
          </View>

          {/* Section Tabs — horizontal scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.sectionTabs}>
            {([
              { key: 'homestays', label: 'Homestays', icon: 'home-outline', badge: stats.pendingHomestays },
              { key: 'guides', label: 'Guides', icon: 'ribbon-outline', badge: stats.pendingGuides },
              { key: 'communities', label: 'Communities', icon: 'people-outline', badge: 0 },
              { key: 'users', label: 'Users', icon: 'person-outline', badge: 0 },
            ] as const).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.sectionTab, tab === t.key && styles.sectionTabActive]}
                onPress={() => setTab(t.key)}
              >
                <Ionicons name={t.icon as any} size={15} color={tab === t.key ? GREEN : 'rgba(255,255,255,0.45)'} />
                <Text style={[styles.sectionTabText, tab === t.key && styles.sectionTabTextActive]}>{t.label}</Text>
                {t.badge > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{t.badge}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Homestays / Guides pending ──────────────────────────────── */}
          {(tab === 'homestays' || tab === 'guides') && (
            <>
              <Text style={styles.sectionLabel}>
                {pendingList.length === 0 ? 'No pending items' : `${pendingList.length} pending review`}
              </Text>
              {pendingList.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={GREEN} />
                  <Text style={styles.emptyText}>All caught up!</Text>
                  <Text style={styles.emptySubText}>No {tab} waiting for approval.</Text>
                </View>
              ) : (
                pendingList.map(item => (
                  tab === 'homestays'
                    ? <HomestayPendingCard
                        key={item.id}
                        item={item}
                        loading={actionLoading === item.id}
                        onApprove={() => handleApprove(item.id, 'homestays')}
                        onReject={() => openRejectModal(item.id, 'homestays')}
                      />
                    : <GuidePendingCard
                        key={item.id}
                        item={item}
                        loading={actionLoading === item.id}
                        onApprove={() => handleApprove(item.id, 'guides')}
                        onReject={() => openRejectModal(item.id, 'guides')}
                      />
                ))
              )}
            </>
          )}

          {/* ── Communities ──────────────────────────────────────────────── */}
          {tab === 'communities' && (
            <>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateCommunity(true)}>
                <Ionicons name="add-circle-outline" size={18} color={GREEN} />
                <Text style={styles.createBtnText}>Create Community</Text>
              </TouchableOpacity>

              {communities.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={40} color={GREEN} />
                  <Text style={styles.emptyText}>No communities yet</Text>
                  <Text style={styles.emptySubText}>Create the first TrekRiderz community.</Text>
                </View>
              ) : (
                communities.map(c => (
                  <CommunityCard
                    key={c.id}
                    item={c}
                    onDelete={() => handleDeleteCommunity(c.id, c.name)}
                  />
                ))
              )}
            </>
          )}

          {/* ── Users ────────────────────────────────────────────────────── */}
          {tab === 'users' && (
            <>
              <Text style={styles.sectionLabel}>{users.length} users (latest 60)</Text>
              {users.map(u => (
                <UserRow
                  key={u.id}
                  item={u}
                  onRoleChange={() => handleRoleChange(u.id, u.role || 'user')}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Reject Reason Modal */}
      {rejectModalId && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reason for Rejection</Text>
            <Text style={styles.modalSub}>This will be sent to the applicant.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Photos are unclear, missing contact details…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModalId(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalReject} onPress={handleReject} disabled={!!actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.modalRejectText}>Send Rejection</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Community</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Community name *"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={communityForm.name}
              onChangeText={v => setCommunityForm(f => ({ ...f, name: v }))}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginTop: 10 }]}
              placeholder="Description (optional)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={communityForm.description}
              onChangeText={v => setCommunityForm(f => ({ ...f, description: v }))}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity
              style={styles.categoryRow}
              onPress={() => {
                const idx = CATEGORIES.indexOf(communityForm.category);
                const next = CATEGORIES[(idx + 1) % CATEGORIES.length];
                setCommunityForm(f => ({ ...f, category: next }));
              }}
            >
              <Text style={styles.categoryLabel}>Category</Text>
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{communityForm.category} ›</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Private (invite-only)</Text>
              <Switch
                value={communityForm.is_private}
                onValueChange={v => setCommunityForm(f => ({ ...f, is_private: v }))}
                trackColor={{ false: BORDER, true: `${GREEN}80` }}
                thumbColor={communityForm.is_private ? GREEN : 'rgba(255,255,255,0.4)'}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreateCommunity(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalApprove} onPress={handleCreateCommunity} disabled={communityLoading}>
                {communityLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.approveText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, alert }: {
  icon: any; label: string; value: number; color: string; alert?: boolean;
}) {
  return (
    <View style={[statStyles.card, alert && { borderColor: `${color}44` }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {alert && <View style={[statStyles.alertDot, { backgroundColor: color }]} />}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    width: '47%',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
    position: 'relative',
  },
  iconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  value: { fontSize: 28, fontWeight: '800' },
  label: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  alertDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4 },
});

function CommunityCard({ item, onDelete }: { item: any; onDelete: () => void }) {
  return (
    <View style={communityStyles.card}>
      <View style={communityStyles.body}>
        <View style={communityStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={communityStyles.name} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={communityStyles.desc} numberOfLines={2}>{item.description}</Text>
            ) : null}
          </View>
          <View style={communityStyles.metaCol}>
            <View style={communityStyles.privacyBadge}>
              <Text style={[communityStyles.privacyText, { color: item.is_private ? '#FBBF24' : GREEN }]}>
                {item.is_private ? 'Private' : 'Public'}
              </Text>
            </View>
            <Text style={communityStyles.memberCount}>{item.member_count} members</Text>
          </View>
        </View>
        <View style={communityStyles.footer}>
          <View style={communityStyles.chip}>
            <Text style={communityStyles.chipText}>{item.category}</Text>
          </View>
          {item.creator?.full_name && (
            <Text style={communityStyles.creatorText}>by {item.creator.full_name}</Text>
          )}
          <TouchableOpacity style={communityStyles.deleteBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
            <Text style={communityStyles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const communityStyles = StyleSheet.create({
  card: { backgroundColor: CARD, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  body: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  desc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 18 },
  metaCol: { alignItems: 'flex-end', gap: 4 },
  privacyBadge: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  privacyText: { fontSize: 11, fontWeight: '700' },
  memberCount: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)' },
  chipText: { color: GREEN, fontSize: 11, fontWeight: '600' },
  creatorText: { flex: 1, color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)' },
  deleteText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
});

function UserRow({ item, onRoleChange }: { item: any; onRoleChange: () => void }) {
  const roleColor: Record<string, string> = {
    admin: '#EF4444',
    guide: GREEN,
    homestay_owner: '#F97316',
    user: 'rgba(255,255,255,0.4)',
  };
  return (
    <View style={userStyles.row}>
      <View style={userStyles.avatar}>
        <Text style={userStyles.avatarText}>{(item.full_name || item.email || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={userStyles.name} numberOfLines={1}>{item.full_name || '—'}</Text>
        <Text style={userStyles.email} numberOfLines={1}>{item.email || '—'}</Text>
      </View>
      <TouchableOpacity style={[userStyles.rolePill, { borderColor: `${roleColor[item.role] || 'rgba(255,255,255,0.2)'}44` }]} onPress={onRoleChange}>
        <Text style={[userStyles.roleText, { color: roleColor[item.role] || 'rgba(255,255,255,0.4)' }]}>
          {(item.role || 'user').replace('_', ' ')}
        </Text>
        <Ionicons name="chevron-down" size={10} color={roleColor[item.role] || 'rgba(255,255,255,0.3)'} />
      </TouchableOpacity>
    </View>
  );
}

const userStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(140,198,63,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: GREEN, fontWeight: '800', fontSize: 14 },
  name: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  email: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  roleText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});

function HomestayPendingCard({ item, loading, onApprove, onReject }: any) {
  const daysAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000);
  const photos: string[] = Array.isArray(item.photos) ? item.photos : [];

  return (
    <View style={cardStyles.card}>
      {photos.length > 0 && (
        <Image source={{ uri: photos[0] }} style={cardStyles.photo} contentFit="cover" />
      )}
      <View style={cardStyles.body}>
        <View style={cardStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
            <View style={cardStyles.metaRow}>
              <Ionicons name="location-outline" size={12} color={GREEN} />
              <Text style={cardStyles.meta}>{item.location}</Text>
            </View>
          </View>
          <View style={cardStyles.pricePill}>
            <Text style={cardStyles.priceText}>₹{item.price_per_night?.toLocaleString('en-IN')}/night</Text>
          </View>
        </View>

        <View style={cardStyles.infoRow}>
          {item.owner?.avatar_url ? (
            <Image source={{ uri: item.owner.avatar_url }} style={cardStyles.ownerAvatar} contentFit="cover" />
          ) : (
            <View style={[cardStyles.ownerAvatar, cardStyles.avatarFallback]}>
              <Text style={cardStyles.avatarInitial}>{item.owner?.full_name?.charAt(0) || 'H'}</Text>
            </View>
          )}
          <Text style={cardStyles.ownerName}>{item.owner?.full_name || 'Unknown owner'}</Text>
          <Text style={cardStyles.daysAgo}>· {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</Text>
        </View>

        {item.description && (
          <Text style={cardStyles.desc} numberOfLines={2}>{item.description}</Text>
        )}

        <View style={cardStyles.actions}>
          <TouchableOpacity style={cardStyles.rejectBtn} onPress={onReject} disabled={loading}>
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={cardStyles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cardStyles.approveBtn} onPress={onApprove} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={cardStyles.approveText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function GuidePendingCard({ item, loading, onApprove, onReject }: any) {
  const daysAgo = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000);
  const langs: string[] = Array.isArray(item.languages) ? item.languages : [];
  const certs: string[] = Array.isArray(item.certifications) ? item.certifications : [];

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.body}>
        <View style={cardStyles.row}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={cardStyles.guideAvatar} contentFit="cover" />
          ) : (
            <View style={[cardStyles.guideAvatar, cardStyles.avatarFallback]}>
              <Text style={[cardStyles.avatarInitial, { fontSize: 20 }]}>{item.name?.charAt(0) || 'G'}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.name} numberOfLines={1}>{item.name}</Text>
            <View style={cardStyles.metaRow}>
              <Ionicons name="location-outline" size={12} color={GREEN} />
              <Text style={cardStyles.meta}>{item.location || 'Location not set'}</Text>
            </View>
            <Text style={cardStyles.daysAgo}>Applied {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}</Text>
          </View>
          <View style={cardStyles.pricePill}>
            <Text style={cardStyles.priceText}>₹{item.rate_per_day?.toLocaleString('en-IN')}/day</Text>
          </View>
        </View>

        <View style={cardStyles.chipRow}>
          <View style={cardStyles.chip}>
            <Ionicons name="time-outline" size={11} color={GREEN} />
            <Text style={cardStyles.chipText}>{item.experience_years}yr exp</Text>
          </View>
          {langs.slice(0, 2).map((l, i) => (
            <View key={i} style={cardStyles.chip}>
              <Text style={cardStyles.chipText}>{l}</Text>
            </View>
          ))}
          {certs.length > 0 && (
            <View style={[cardStyles.chip, { borderColor: 'rgba(139,92,246,0.4)', backgroundColor: 'rgba(139,92,246,0.1)' }]}>
              <Ionicons name="ribbon-outline" size={11} color="#8B5CF6" />
              <Text style={[cardStyles.chipText, { color: '#8B5CF6' }]}>{certs.length} cert{certs.length > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {item.bio && (
          <Text style={cardStyles.desc} numberOfLines={2}>{item.bio}</Text>
        )}

        <View style={cardStyles.actions}>
          <TouchableOpacity style={cardStyles.rejectBtn} onPress={onReject} disabled={loading}>
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={cardStyles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cardStyles.approveBtn} onPress={onApprove} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={cardStyles.approveText}>Verify Guide</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: CARD, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  photo: { width: '100%', height: 160 },
  body: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guideAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: GREEN },
  ownerAvatar: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: GREEN, fontSize: 12, fontWeight: '800' },
  name: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  pricePill: { backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)' },
  priceText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownerName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  daysAgo: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)' },
  chipText: { color: GREEN, fontSize: 11, fontWeight: '600' },
  desc: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' },
  rejectText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  approveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: GREEN },
  approveText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

// ── Screen styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
  headerRight: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(140,198,63,0.1)', borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 60 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  tabScroll: { marginBottom: 20, marginHorizontal: -20 },
  sectionTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionTabActive: {
    backgroundColor: 'rgba(140,198,63,0.1)',
    borderColor: 'rgba(140,198,63,0.3)',
  },
  sectionTabText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600' },
  sectionTabTextActive: { color: GREEN },
  badge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 18, alignItems: 'center' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  emptyCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptySubText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(140,198,63,0.08)', borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, marginBottom: 16, alignSelf: 'flex-start' },
  createBtnText: { color: GREEN, fontWeight: '700', fontSize: 14 },
  modalOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, borderTopWidth: 1, borderColor: BORDER },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  modalSub: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  modalInput: { backgroundColor: CARD, borderRadius: 12, padding: 14, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: BORDER, minHeight: 50, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 14 },
  modalReject: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#EF4444' },
  modalRejectText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  modalApprove: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: GREEN },
  approveText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  categoryLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  categoryChip: { backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)' },
  categoryChipText: { color: GREEN, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
});
