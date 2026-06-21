import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
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

type Tab = 'homestays' | 'guides';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectType, setRejectType] = useState<Tab>('homestays');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [usersRes, pendingHsRes, pendingGRes, tripsRes, hsRes, gRes] = await Promise.all([
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
      ]);

      setStats({
        users: usersRes.count ?? 0,
        pendingHomestays: pendingHsRes.count ?? 0,
        pendingGuides: pendingGRes.count ?? 0,
        activeTrips: tripsRes.count ?? 0,
      });
      setHomestays(hsRes.data || []);
      setGuides(gRes.data || []);
    } catch (e) {
      console.error('Admin load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string, type: Tab) => {
    setActionLoading(id);
    try {
      const table = type === 'homestays' ? 'homestays' : 'guides';
      const { error } = await supabase
        .from(table)
        .update({ status: 'approved', verified_at: new Date().toISOString(), verified_by: user?.id })
        .eq('id', id);
      if (error) throw error;

      // Send notification to owner/user
      const item = type === 'homestays'
        ? homestays.find(h => h.id === id)
        : guides.find(g => g.id === id);
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

  const openRejectModal = (id: string, type: Tab) => {
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

  const pendingList = tab === 'homestays' ? homestays : guides;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        {/* Header */}
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

          {/* Section Tabs */}
          <View style={styles.sectionTabs}>
            <TouchableOpacity
              style={[styles.sectionTab, tab === 'homestays' && styles.sectionTabActive]}
              onPress={() => setTab('homestays')}
            >
              <Ionicons name="home-outline" size={15} color={tab === 'homestays' ? GREEN : 'rgba(255,255,255,0.45)'} />
              <Text style={[styles.sectionTabText, tab === 'homestays' && styles.sectionTabTextActive]}>
                Homestays
              </Text>
              {stats.pendingHomestays > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{stats.pendingHomestays}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sectionTab, tab === 'guides' && styles.sectionTabActive]}
              onPress={() => setTab('guides')}
            >
              <Ionicons name="ribbon-outline" size={15} color={tab === 'guides' ? GREEN : 'rgba(255,255,255,0.45)'} />
              <Text style={[styles.sectionTabText, tab === 'guides' && styles.sectionTabTextActive]}>
                Guides
              </Text>
              {stats.pendingGuides > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{stats.pendingGuides}</Text></View>
              )}
            </TouchableOpacity>
          </View>

          {/* Pending Items */}
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
              <TouchableOpacity
                style={styles.modalReject}
                onPress={handleReject}
                disabled={!!actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalRejectText}>Send Rejection</Text>
                )}
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
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
  },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  alertDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
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
          <TouchableOpacity
            style={cardStyles.rejectBtn}
            onPress={onReject}
            disabled={loading}
          >
            <Ionicons name="close" size={16} color="#EF4444" />
            <Text style={cardStyles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={cardStyles.approveBtn}
            onPress={onApprove}
            disabled={loading}
          >
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
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 160,
  },
  body: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guideAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: GREEN,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarFallback: {
    backgroundColor: 'rgba(140,198,63,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '800',
  },
  name: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  pricePill: {
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.25)',
  },
  priceText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  daysAgo: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.2)',
  },
  chipText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '600',
  },
  desc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rejectText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GREEN,
  },
  approveText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 },
  headerRight: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(140,198,63,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { padding: 20, paddingBottom: 60 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sectionTabActive: {
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.25)',
  },
  sectionTabText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTabTextActive: { color: GREEN },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptySubText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  modalOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  modalSub: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  modalInput: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 14 },
  modalReject: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  modalRejectText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
