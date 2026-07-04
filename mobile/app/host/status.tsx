import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';

type Property = {
  id: string;
  name: string;
  cover_photo_url: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
  room_types: { id: string; max_occupancy: number; total_units: number }[];
};

const STEPS = [
  { key: 'received', label: 'Application received' },
  { key: 'docs', label: 'Document verification' },
  { key: 'review', label: 'Property review' },
  { key: 'approval', label: 'Approval' },
];

function getCompletedSteps(status: string): number {
  switch (status) {
    case 'pending': return 1;
    case 'under_review': return 3;
    case 'approved': return 4;
    case 'rejected': return 1;
    default: return 1;
  }
}

export default function PropertyStatusScreen() {
  const { user } = useAuthStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('properties')
        .select('id, name, cover_photo_url, status, rejection_reason, created_at, approved_at, room_types(id, max_occupancy, total_units)')
        .eq('owner_id', user.id);

      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      setProperty(data as unknown as Property | null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useFocusEffect(useCallback(() => { fetchStatus(); }, [fetchStatus]));

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={GREEN} /></View>;
  }

  if (!property) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Property Application</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="home-outline" size={56} color="rgba(255,255,255,0.15)" />
          <Text style={s.emptyTitle}>No application found</Text>
          <Text style={s.emptySubtitle}>List your property on TrekRiderz today</Text>
          <TouchableOpacity style={s.applyBtn} onPress={() => router.replace('/host/create' as any)}>
            <Text style={s.applyBtnText}>List Your Property</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const roomCount = property.room_types?.length || 0;
  const totalCapacity = (property.room_types || []).reduce((sum, r) => sum + (r.max_occupancy || 0) * (r.total_units || 1), 0);
  const completedSteps = getCompletedSteps(property.status);
  const submittedDate = new Date(property.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const refId = `#HS-${property.id.slice(-5).toUpperCase()}`;

  // ─── Approved View ────────────────────────────────────────────────────────
  if (property.status === 'approved') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Property Status</Text>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.approvedCard}>
            <View style={s.approvedBadge}>
              <Ionicons name="checkmark-circle" size={32} color={GREEN} />
              <Text style={s.approvedBadgeText}>LIVE ON TREKRIDERZ</Text>
            </View>

            {property.cover_photo_url ? (
              <Image source={{ uri: property.cover_photo_url }} style={s.coverImg} contentFit="cover" />
            ) : (
              <View style={[s.coverImg, s.coverFallback]}>
                <Ionicons name="home-outline" size={32} color="rgba(255,255,255,0.2)" />
              </View>
            )}

            <Text style={s.approvedName}>{property.name}</Text>
            <Text style={s.roomSummary}>{roomCount} room type{roomCount !== 1 ? 's' : ''} · Total capacity {totalCapacity} guests</Text>

            {property.approved_at && (
              <Text style={s.approvedDate}>
                Approved on {new Date(property.approved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}

            <TouchableOpacity style={s.viewProfileBtn} onPress={() => router.push(`/host/manage?id=${property.id}` as any)}>
              <Ionicons name="settings-outline" size={18} color="#000" />
              <Text style={s.viewProfileBtnText}>Manage Property</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.editProfileBtn} onPress={() => router.push(`/homestay/${property.id}` as any)}>
              <Ionicons name="eye-outline" size={16} color={GREEN} />
              <Text style={s.editProfileBtnText}>View Public Listing</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Pending / Under Review / Rejected View ───────────────────────────────

  const statusConfig = {
    pending: { color: '#F59E0B', label: 'UNDER REVIEW', icon: 'time-outline' as const },
    under_review: { color: '#3B82F6', label: 'UNDER REVIEW', icon: 'search-outline' as const },
    rejected: { color: '#EF4444', label: 'NOT APPROVED', icon: 'close-circle-outline' as const },
    suspended: { color: '#EF4444', label: 'SUSPENDED', icon: 'pause-circle-outline' as const },
  }[property.status] || { color: '#F59E0B', label: 'UNDER REVIEW', icon: 'time-outline' as const };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Property Application</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.profileRow}>
          {property.cover_photo_url ? (
            <Image source={{ uri: property.cover_photo_url }} style={s.statusAvatar} contentFit="cover" />
          ) : (
            <View style={[s.statusAvatar, s.coverFallback]}>
              <Ionicons name="home-outline" size={24} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.statusName}>{property.name}</Text>
            <View style={[s.statusPill, { backgroundColor: `${statusConfig.color}20`, borderColor: `${statusConfig.color}50` }]}>
              <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[s.statusPillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>
        </View>

        <View style={s.metaCard}>
          <MetaRow icon="barcode-outline" label="Reference" value={refId} />
          <MetaRow icon="calendar-outline" label="Submitted" value={submittedDate} />
          {property.status !== 'rejected' && <MetaRow icon="hourglass-outline" label="Expected" value="3-5 business days" />}
          <MetaRow icon="bed-outline" label="Room Types" value={`${roomCount} added`} />
          <MetaRow icon="people-outline" label="Total Capacity" value={`${totalCapacity} guests`} />
        </View>

        {property.status !== 'rejected' && (
          <View style={s.stepsCard}>
            <Text style={s.stepsTitle}>Review Progress</Text>
            {STEPS.map((step, idx) => {
              const done = idx < completedSteps;
              const current = idx === completedSteps - 1 && property.status !== 'approved';
              return (
                <View key={step.key} style={s.stepRow}>
                  <View style={[s.stepDot, done && s.stepDotDone, current && s.stepDotCurrent]}>
                    {done && !current
                      ? <Ionicons name="checkmark" size={12} color="#000" />
                      : current
                        ? <ActivityIndicator size="small" color={GREEN} style={{ transform: [{ scale: 0.6 }] }} />
                        : <View style={s.stepDotEmpty} />}
                  </View>
                  {idx < STEPS.length - 1 && <View style={[s.stepLine, done && idx < completedSteps - 1 && s.stepLineDone]} />}
                  <Text style={[s.stepLabel, done && s.stepLabelDone]}>{step.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {property.status === 'rejected' && (
          <View style={s.rejectedCard}>
            <View style={s.rejectedHeader}>
              <Ionicons name="close-circle" size={22} color="#EF4444" />
              <Text style={s.rejectedTitle}>Application Not Approved</Text>
            </View>
            <Text style={s.rejectedReason}>{property.rejection_reason || 'Your application did not meet our current requirements.'}</Text>
          </View>
        )}

        {property.status !== 'rejected' && (
          <View style={s.contactNote}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={s.contactNoteText}>Our team will contact you on your registered number to confirm approval.</Text>
          </View>
        )}

        <TouchableOpacity style={s.editAppBtn} onPress={() => router.push('/host/create' as any)}>
          <Ionicons name="pencil-outline" size={16} color={GREEN} />
          <Text style={s.editAppBtnText}>Edit Application</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Ionicons name={icon} size={14} color={GREEN} />
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },

  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  applyBtn: { backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  applyBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  statusAvatar: { width: 60, height: 60, borderRadius: 14, borderWidth: 2, borderColor: GREEN },
  coverFallback: { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  statusName: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  metaCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  metaLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, flex: 1 },
  metaValue: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  stepsCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  stepsTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4, position: 'relative' },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepDotDone: { backgroundColor: GREEN, borderColor: GREEN },
  stepDotCurrent: { backgroundColor: 'rgba(140,198,63,0.2)', borderColor: GREEN },
  stepDotEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepLine: { position: 'absolute', left: 12, top: 26, width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  stepLineDone: { backgroundColor: GREEN },
  stepLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 14, flex: 1 },
  stepLabelDone: { color: '#FFF', fontWeight: '600' },

  rejectedCard: { backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', marginBottom: 16 },
  rejectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  rejectedTitle: { color: '#EF4444', fontSize: 15, fontWeight: '800' },
  rejectedReason: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20 },

  contactNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  contactNoteText: { flex: 1, color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18 },

  editAppBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)' },
  editAppBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },

  approvedCard: { backgroundColor: 'rgba(140,198,63,0.05)', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)', alignItems: 'center', gap: 12 },
  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvedBadgeText: { color: GREEN, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  coverImg: { width: 100, height: 100, borderRadius: 16, borderWidth: 3, borderColor: GREEN },
  approvedName: { color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  roomSummary: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  approvedDate: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, width: '100%' },
  viewProfileBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, width: '100%', borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)' },
  editProfileBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },
});
