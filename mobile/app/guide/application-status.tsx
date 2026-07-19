import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors } from '@/constants/theme';

const GREEN = AppColors.primary;
const BG = AppColors.background;

type GuideApplication = {
  id: string;
  full_name: string | null;
  name: string | null;
  profile_photo_url: string | null;
  photo_url: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  specializations: string[];
  locations: { name: string; radius_km: number; rate_per_day: number }[];
  location: string | null;
  experience: string | null;
  created_at: string;
  approved_at: string | null;
};

const STEPS = [
  { key: 'received', label: 'Application received' },
  { key: 'docs', label: 'Document verification' },
  { key: 'background', label: 'Background check' },
  { key: 'approval', label: 'Approval' },
];

function getCompletedSteps(status: string): number {
  switch (status) {
    case 'pending': return 1;
    case 'under_review': return 2;
    case 'approved': return 4;
    case 'rejected': return 1;
    default: return 1;
  }
}

export default function ApplicationStatusScreen() {
  const { user } = useAuthStore();
  const [guide, setGuide] = useState<GuideApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [resubmitting, setResubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guides')
        .select('id, full_name, name, profile_photo_url, photo_url, status, rejection_reason, specializations, locations, location, experience, created_at, approved_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setGuide(data as GuideApplication | null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchStatus(); }, [fetchStatus]));

  const handleResubmit = async () => {
    if (!guide) return;
    Alert.alert(
      'Resubmit Application?',
      'This will reset your application to pending review. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resubmit',
          onPress: async () => {
            setResubmitting(true);
            const { error } = await supabase
              .from('guides')
              .update({ status: 'pending', rejection_reason: null, updated_at: new Date().toISOString() })
              .eq('id', guide.id);
            setResubmitting(false);
            if (error) { Alert.alert('Error', error.message); return; }
            fetchStatus();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  // No application — redirect to register
  if (!guide) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Guide Application</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="ribbon-outline" size={56} color="rgba(255,255,255,0.15)" />
          <Text style={s.emptyTitle}>No application found</Text>
          <Text style={s.emptySubtitle}>Start your guide application today</Text>
          <TouchableOpacity style={s.applyBtn} onPress={() => router.replace('/guide/register' as any)}>
            <Text style={s.applyBtnText}>Apply Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = guide.full_name || guide.name || 'Guide';
  const photoUrl = guide.profile_photo_url || guide.photo_url;
  const completedSteps = getCompletedSteps(guide.status);
  const submittedDate = new Date(guide.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const appId = `#GD-${guide.id.slice(-5).toUpperCase()}`;

  // ─── Approved View ────────────────────────────────────────────────────────
  if (guide.status === 'approved') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Guide Profile</Text>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.approvedCard}>
            <View style={s.approvedBadge}>
              <Ionicons name="checkmark-circle" size={32} color={GREEN} />
              <Text style={s.approvedBadgeText}>CERTIFIED GUIDE</Text>
            </View>

            <View style={s.avatarWrap}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={s.avatar} contentFit="cover" />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{displayName.charAt(0)}</Text>
                </View>
              )}
              <View style={s.verifiedDot}>
                <Ionicons name="checkmark" size={10} color="#000" />
              </View>
            </View>

            <Text style={s.approvedName}>{displayName}</Text>
            <View style={s.verifiedBadgeRow}>
              <Ionicons name="shield-checkmark" size={14} color="#3897F0" />
              <Text style={s.verifiedText}>TrekRiderz Verified Guide</Text>
            </View>

            <Text style={s.approvedSubtitle}>Your guide profile is now live on TrekRiderz!</Text>

            {guide.approved_at && (
              <Text style={s.approvedDate}>
                Approved on {new Date(guide.approved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}

            <TouchableOpacity
              style={s.viewProfileBtn}
              onPress={() => router.push(`/guide/${guide.id}` as any)}
            >
              <Ionicons name="person-circle-outline" size={18} color="#000" />
              <Text style={s.viewProfileBtnText}>View My Guide Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.editProfileBtn}
              onPress={() => router.push('/guide/register' as any)}
            >
              <Ionicons name="pencil-outline" size={16} color={GREEN} />
              <Text style={s.editProfileBtnText}>Edit Profile</Text>
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
  }[guide.status] || { color: '#F59E0B', label: 'UNDER REVIEW', icon: 'time-outline' as const };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Guide Application</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Profile row */}
        <View style={s.profileRow}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={s.statusAvatar} contentFit="cover" />
          ) : (
            <View style={[s.statusAvatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{displayName.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.statusName}>{displayName}</Text>
            <View style={[s.statusPill, { backgroundColor: `${statusConfig.color}20`, borderColor: `${statusConfig.color}50` }]}>
              <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
              <Text style={[s.statusPillText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
          </View>
        </View>

        {/* Meta */}
        <View style={s.metaCard}>
          <MetaRow icon="barcode-outline" label="Application ID" value={appId} />
          <MetaRow icon="calendar-outline" label="Submitted" value={submittedDate} />
          {guide.status !== 'rejected' && (
            <MetaRow icon="hourglass-outline" label="Expected" value="2-3 business days" />
          )}
        </View>

        {/* Progress steps */}
        {guide.status !== 'rejected' && (
          <View style={s.stepsCard}>
            <Text style={s.stepsTitle}>Review Progress</Text>
            {STEPS.map((step, idx) => {
              const done = idx < completedSteps;
              const current = idx === completedSteps - 1 && guide.status !== 'approved';
              return (
                <View key={step.key} style={s.stepRow}>
                  <View style={[
                    s.stepDot,
                    done && s.stepDotDone,
                    current && s.stepDotCurrent,
                  ]}>
                    {done && !current
                      ? <Ionicons name="checkmark" size={12} color="#000" />
                      : current
                        ? <ActivityIndicator size="small" color={GREEN} style={{ transform: [{ scale: 0.6 }] }} />
                        : <View style={s.stepDotEmpty} />
                    }
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View style={[s.stepLine, done && idx < completedSteps - 1 && s.stepLineDone]} />
                  )}
                  <Text style={[s.stepLabel, done && s.stepLabelDone]}>{step.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Rejection block */}
        {guide.status === 'rejected' && (
          <View style={s.rejectedCard}>
            <View style={s.rejectedHeader}>
              <Ionicons name="close-circle" size={22} color="#EF4444" />
              <Text style={s.rejectedTitle}>Application Not Approved</Text>
            </View>
            {guide.rejection_reason ? (
              <Text style={s.rejectedReason}>{guide.rejection_reason}</Text>
            ) : (
              <Text style={s.rejectedReason}>Your application did not meet our current requirements.</Text>
            )}
            <TouchableOpacity
              style={[s.resubmitBtn, resubmitting && { opacity: 0.6 }]}
              onPress={handleResubmit}
              disabled={resubmitting}
            >
              {resubmitting
                ? <ActivityIndicator color="#000" />
                : <>
                    <Ionicons name="refresh-outline" size={16} color="#000" />
                    <Text style={s.resubmitBtnText}>Resubmit Application</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Contact note */}
        {guide.status !== 'rejected' && (
          <View style={s.contactNote}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={s.contactNoteText}>
              Our team will contact you on your registered number to confirm approval.
            </Text>
          </View>
        )}

        {/* Edit Application */}
        <TouchableOpacity
          style={s.editAppBtn}
          onPress={() => router.push('/guide/register' as any)}
        >
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
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },

  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  applyBtn: { backgroundColor: GREEN, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 8 },
  applyBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // Profile row
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  statusAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: GREEN },
  statusName: { color: '#FFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Meta card
  metaCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  metaLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, flex: 1 },
  metaValue: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Steps
  stepsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16,
  },
  stepsTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4, position: 'relative' },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  stepDotDone: { backgroundColor: GREEN, borderColor: GREEN },
  stepDotCurrent: { backgroundColor: 'rgba(140,198,63,0.2)', borderColor: GREEN },
  stepDotEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  stepLine: {
    position: 'absolute', left: 12, top: 26,
    width: 2, height: 20, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepLineDone: { backgroundColor: GREEN },
  stepLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 14, flex: 1 },
  stepLabelDone: { color: '#FFF', fontWeight: '600' },

  // Rejection
  rejectedCard: {
    backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', marginBottom: 16,
  },
  rejectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  rejectedTitle: { color: '#EF4444', fontSize: 15, fontWeight: '800' },
  rejectedReason: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  resubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13,
  },
  resubmitBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },

  // Contact note
  contactNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 16,
  },
  contactNoteText: { flex: 1, color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18 },

  // Edit button
  editAppBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)',
  },
  editAppBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },

  // Approved view
  approvedCard: {
    backgroundColor: 'rgba(140,198,63,0.05)', borderRadius: 20, padding: 28,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)', alignItems: 'center', gap: 12,
  },
  approvedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approvedBadgeText: { color: GREEN, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: GREEN },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: GREEN, fontSize: 36, fontWeight: '800' },
  verifiedDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BG,
  },
  approvedName: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  verifiedBadgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(56,151,240,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(56,151,240,0.3)',
  },
  verifiedText: { color: '#3897F0', fontSize: 12, fontWeight: '700' },
  approvedSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center' },
  approvedDate: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  viewProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, width: '100%',
  },
  viewProfileBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28,
    width: '100%', borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
  },
  editProfileBtnText: { color: GREEN, fontSize: 14, fontWeight: '700' },
});
