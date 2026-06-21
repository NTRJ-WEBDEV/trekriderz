import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import {
  fetchExpeditionBookings,
  fetchExpeditionWaitlist,
  confirmExpeditionBooking,
  GuidedExpedition,
} from '@/lib/expeditions';

type ActiveTab = 'participants' | 'waitlist';

export default function ManageExpeditionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [expedition, setExpedition] = useState<GuidedExpedition | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('participants');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expRes, partsRes, waitRes] = await Promise.all([
        supabase.from('guided_expeditions').select('*').eq('id', id).single(),
        fetchExpeditionBookings(id as string),
        fetchExpeditionWaitlist(id as string),
      ]);

      if (expRes.data) setExpedition(expRes.data as GuidedExpedition);
      if (partsRes.data) setParticipants(partsRes.data);
      if (waitRes.data) setWaitlist(waitRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (bookingId: string) => {
    Alert.alert('Confirm Participant', 'Confirm this participant for the expedition?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          const { error } = await confirmExpeditionBooking(bookingId);
          if (error) Alert.alert('Error', 'Failed to confirm booking');
          else loadData();
        },
      },
    ]);
  };

  const handleChangeStatus = (newStatus: string) => {
    const labels: Record<string, string> = {
      published: 'Publish',
      cancelled: 'Cancel Expedition',
      draft: 'Move to Draft',
    };

    Alert.alert(
      `${labels[newStatus] || 'Change Status'}`,
      newStatus === 'cancelled'
        ? 'Are you sure you want to cancel this expedition? All participants will be notified.'
        : `Set expedition status to "${newStatus}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: newStatus === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            await supabase
              .from('guided_expeditions')
              .update({ status: newStatus })
              .eq('id', id);
            if (newStatus === 'cancelled') {
              router.back();
            } else {
              loadData();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8CC63F" />
      </View>
    );
  }

  if (!expedition) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.notFoundText}>Expedition not found</Text>
        <TouchableOpacity style={styles.backBtnInline} onPress={() => router.back()}>
          <Text style={styles.backBtnInlineText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const revenue = participants
    .filter((p) => p.status === 'confirmed' || p.status === 'pending')
    .reduce((sum, p) => sum + (p.total_price || 0), 0);

  const confirmedCount = participants.filter((p) => p.status === 'confirmed').length;
  const pendingCount = participants.filter((p) => p.status === 'pending').length;

  const statusColor: Record<string, string> = {
    published: '#22C55E',
    draft: '#9CA3AF',
    cancelled: '#EF4444',
    full: '#F59E0B',
    completed: '#3B82F6',
  };

  const currentStatusColor = statusColor[expedition.status] || '#9CA3AF';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {expedition.title}
          </Text>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: currentStatusColor + '20', borderColor: currentStatusColor + '50' },
            ]}
          >
            <Text style={[styles.statusText, { color: currentStatusColor }]}>
              {expedition.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Seats Booked</Text>
            <Text style={styles.statValue}>
              {expedition.booked_seats || 0}
              <Text style={styles.statMuted}>/{expedition.max_seats}</Text>
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Confirmed</Text>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>{confirmedCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{pendingCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Revenue</Text>
            <Text style={[styles.statValue, { color: '#8CC63F' }]}>
              ₹{(revenue / 1000).toFixed(0)}k
            </Text>
          </View>
        </View>

        {/* EXPEDITION INFO */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#8CC63F" />
            <Text style={styles.infoText}>{expedition.destination}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#8CC63F" />
            <Text style={styles.infoText}>
              {new Date(expedition.start_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              –{' '}
              {new Date(expedition.end_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="trending-up-outline" size={16} color="#8CC63F" />
            <Text style={[styles.infoText, { textTransform: 'capitalize' }]}>
              {expedition.difficulty}
            </Text>
          </View>
        </View>

        {/* STATUS ACTIONS */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Manage Status</Text>
          <View style={styles.actionRow}>
            {expedition.status !== 'published' && expedition.status !== 'cancelled' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleChangeStatus('published')}
              >
                <Ionicons name="radio-button-on-outline" size={16} color="#22C55E" />
                <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>Publish</Text>
              </TouchableOpacity>
            )}
            {expedition.status !== 'draft' && expedition.status !== 'cancelled' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleChangeStatus('draft')}
              >
                <Ionicons name="create-outline" size={16} color="#9CA3AF" />
                <Text style={[styles.actionBtnText, { color: '#9CA3AF' }]}>Draft</Text>
              </TouchableOpacity>
            )}
            {expedition.status !== 'cancelled' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.dangerBtn]}
                onPress={() => handleChangeStatus('cancelled')}
              >
                <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* TABS */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'participants' && styles.tabActive]}
            onPress={() => setActiveTab('participants')}
          >
            <Text style={[styles.tabText, activeTab === 'participants' && styles.tabTextActive]}>
              Participants ({participants.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'waitlist' && styles.tabActive]}
            onPress={() => setActiveTab('waitlist')}
          >
            <Text style={[styles.tabText, activeTab === 'waitlist' && styles.tabTextActive]}>
              Waitlist ({waitlist.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* PARTICIPANTS / WAITLIST LIST */}
        {activeTab === 'participants' ? (
          participants.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No participants yet</Text>
            </View>
          ) : (
            participants.map((p) => (
              <View key={p.id} style={styles.participantCard}>
                <View style={styles.participantLeft}>
                  {p.user?.avatar_url ? (
                    <Image
                      source={{ uri: p.user.avatar_url }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitials}>
                        {p.user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.participantName}>
                      {p.user?.full_name || 'Participant'}
                    </Text>
                    <Text style={styles.participantMeta}>
                      {p.package_name || 'Standard'} • ₹{p.total_price?.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
                <View style={styles.participantRight}>
                  {p.status === 'pending' ? (
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => handleConfirm(p.id)}
                    >
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            p.status === 'confirmed'
                              ? 'rgba(34,197,94,0.15)'
                              : 'rgba(156,163,175,0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: p.status === 'confirmed' ? '#22C55E' : '#9CA3AF' },
                        ]}
                      >
                        {p.status}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )
        ) : waitlist.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="list-outline" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>Waitlist is empty</Text>
          </View>
        ) : (
          waitlist.map((w, idx) => (
            <View key={w.id} style={styles.participantCard}>
              <View style={styles.participantLeft}>
                <View style={styles.waitlistPosition}>
                  <Text style={styles.waitlistPositionText}>{idx + 1}</Text>
                </View>
                <View>
                  <Text style={styles.participantName}>
                    {w.user?.full_name || 'User'}
                  </Text>
                  <Text style={styles.participantMeta}>
                    Joined{' '}
                    {new Date(w.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.waitlistBadge}>
                <Text style={styles.waitlistBadgeText}>WAITLISTED</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#080C14',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  notFoundText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 8,
  },
  backBtnInline: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnInlineText: {
    color: '#FFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    gap: 5,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statMuted: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
  },
  actionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dangerBtn: {
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    backgroundColor: 'rgba(140,198,63,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#8CC63F',
    fontSize: 16,
    fontWeight: '800',
  },
  participantName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  participantMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  participantRight: {
    alignItems: 'flex-end',
  },
  confirmBtn: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  confirmBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  waitlistPosition: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  waitlistPositionText: {
    color: '#F59E0B',
    fontWeight: '800',
    fontSize: 14,
  },
  waitlistBadge: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  waitlistBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
