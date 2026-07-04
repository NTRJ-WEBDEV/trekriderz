import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Share, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import ReviewSheet from '@/components/ReviewSheet';

const { width } = Dimensions.get('window');
const GREEN = '#8CC63F';

type GuideData = {
  id: string;
  full_name: string | null;
  name: string | null;
  profile_photo_url: string | null;
  photo_url: string | null;
  status: string;
  is_premium: boolean;
  rating: number | null;
  specializations: string[];
  locations: { name: string; lat: number; lng: number; radius_km: number; rate_per_day: number }[];
  location: string | null;
  rate_per_day: number | null;
  experience: string | null;
  experience_years: number | null;
  languages: string[];
  about: string | null;
  bio: string | null;
};

export default function GuideProfileScreen() {
  const { id } = useLocalSearchParams();
  const [guide, setGuide] = useState<GuideData | null>(null);
  const [expeditions, setExpeditions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchGuide();
  }, [id]);

  const fetchGuide = async () => {
    try {
      const { data, error } = await supabase
        .from('guides')
        .select('id, full_name, name, profile_photo_url, photo_url, status, is_premium, rating, specializations, locations, location, rate_per_day, experience, experience_years, languages, about, bio')
        .eq('id', id)
        .single();

      if (data) {
        setGuide(data as GuideData);
        const { data: expData } = await supabase
          .from('guided_expeditions')
          .select('*, packages:expedition_packages(price_per_person)')
          .eq('guide_id', id)
          .eq('status', 'published')
          .limit(5);
        setExpeditions(expData || []);
      } else {
        Alert.alert('Error', error?.message || 'Guide not found');
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load guide profile');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!guide) return;
    await Share.share({ message: `Check out ${displayName}, a professional guide on TrekRiderz!` });
  };

  const handleHireNow = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to hire a guide.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }
    router.push({
      pathname: `/hire/${id}` as any,
      params: { id, name: displayName, price: String(primaryRate), type: 'guide' },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (!guide) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.errorText}>Guide not found</Text>
        <TouchableOpacity style={styles.backBtnInline} onPress={() => router.back()}>
          <Text style={styles.backBtnInlineText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = guide.full_name || guide.name || 'Guide';
  const photoUrl = guide.profile_photo_url || guide.photo_url;
  const aboutText = guide.about || guide.bio;
  const languages: string[] = Array.isArray(guide.languages) ? guide.languages : [];
  const specializations: string[] = Array.isArray(guide.specializations) ? guide.specializations : [];
  const locations: GuideData['locations'] = Array.isArray(guide.locations) && guide.locations.length > 0
    ? guide.locations
    : guide.location ? [{ name: guide.location, lat: 0, lng: 0, radius_km: 50, rate_per_day: guide.rate_per_day || 0 }]
    : [];
  const experienceLabel = guide.experience || (guide.experience_years ? `${guide.experience_years} years` : null);
  const primaryRate = locations[0]?.rate_per_day || guide.rate_per_day || 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cover header */}
        <View style={styles.headerCover}>
          <LinearGradient
            colors={['#1a2a1a', '#080C14']}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(8,12,20,0.6)', 'transparent', 'rgba(8,12,20,0.95)', '#080C14']}
            style={StyleSheet.absoluteFillObject}
            locations={[0, 0.25, 0.75, 1]}
          />

          <SafeAreaView edges={['top']} style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.circleBtn}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.profileInfoOverlay}>
            <View style={styles.avatarWrapper}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {guide.status === 'approved' && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFF" />
                </View>
              )}
            </View>

            <Text style={styles.guideName}>{displayName}</Text>

            <View style={styles.badgeRow}>
              {guide.status === 'approved' && (
                <View style={styles.verifiedGuideBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#3897F0" />
                  <Text style={styles.verifiedGuideText}>TrekRiderz Verified</Text>
                </View>
              )}
              {guide.is_premium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={12} color="#FBBF24" />
                  <Text style={styles.premiumText}>Premium Guide</Text>
                </View>
              )}
            </View>

            {specializations.length > 0 && (
              <Text style={styles.guideSpecialization}>
                {specializations.slice(0, 2).join(' · ')}
              </Text>
            )}

            <View style={styles.statRow}>
              {guide.rating && (
                <View style={styles.statItem}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.statValue}>{guide.rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              )}
              {experienceLabel && (
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={14} color={GREEN} />
                  <Text style={styles.statValue}>{experienceLabel}</Text>
                  <Text style={styles.statLabel}>Exp.</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Rate & Hire */}
          <View style={styles.rateCard}>
            <View>
              <Text style={styles.rateAmount}>
                {locations.length > 1
                  ? `₹${Math.min(...locations.map(l => l.rate_per_day)).toLocaleString('en-IN')}+`
                  : `₹${primaryRate.toLocaleString('en-IN')}`}
              </Text>
              <Text style={styles.rateLabel}>per day</Text>
            </View>
            <TouchableOpacity style={styles.hireBtn} onPress={handleHireNow}>
              <Text style={styles.hireBtnText}>Hire Guide</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Operating Locations */}
          {locations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Operating Locations</Text>
              {locations.map((loc, i) => (
                <View key={i} style={styles.locationRow}>
                  <View style={styles.locationDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationName}>{loc.name}</Text>
                    <Text style={styles.locationMeta}>
                      {loc.radius_km}km radius · ₹{loc.rate_per_day.toLocaleString('en-IN')}/day
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Specializations */}
          {specializations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specializations</Text>
              <View style={styles.chipRow}>
                {specializations.map((sp, i) => (
                  <View key={i} style={styles.specChip}>
                    <Text style={styles.specChipText}>{sp.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* About */}
          {aboutText ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{aboutText}</Text>
            </View>
          ) : null}

          {/* Languages */}
          {languages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Languages</Text>
              <View style={styles.chipRow}>
                {languages.map((lang, i) => (
                  <View key={i} style={styles.langChip}>
                    <Text style={styles.langChipText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Expeditions */}
          {expeditions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Expeditions</Text>
              {expeditions.map((exp) => {
                const minPrice = exp.packages?.length > 0
                  ? Math.min(...exp.packages.map((p: any) => p.price_per_person || 0))
                  : null;
                return (
                  <TouchableOpacity
                    key={exp.id}
                    style={styles.expeditionCard}
                    onPress={() => router.push(`/expeditions/${exp.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.expInfo}>
                      <Text style={styles.expTitle} numberOfLines={1}>{exp.title}</Text>
                      <Text style={styles.expMeta}>{exp.destination} · {exp.difficulty}</Text>
                    </View>
                    {minPrice !== null && (
                      <Text style={styles.expPrice}>from ₹{minPrice.toLocaleString('en-IN')}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Reviews */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            {user ? (
              <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowReview(true)}>
                <Ionicons name="star-outline" size={18} color="#FFD700" />
                <Text style={styles.reviewBtnText}>Write a Review</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet. Be the first!</Text>
            )}
          </View>

          {/* Report */}
          <TouchableOpacity style={styles.reportBtn} onPress={() => Alert.alert('Report Guide', 'To report this guide, please contact support@trekriderz.com')}>
            <Ionicons name="flag-outline" size={14} color="rgba(255,255,255,0.25)" />
            <Text style={styles.reportText}>Report Guide</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky hire */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.stickyHireBtn} onPress={handleHireNow}>
          <Text style={styles.stickyHireBtnText}>
            HIRE THIS GUIDE — from ₹{primaryRate.toLocaleString('en-IN')}/day
          </Text>
        </TouchableOpacity>
      </View>

      <ReviewSheet
        visible={showReview}
        targetId={String(id)}
        targetType="guide"
        targetName={displayName}
        reviewerId={user?.id || ''}
        onClose={() => setShowReview(false)}
        onSubmitted={() => setShowReview(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  loadingContainer: { flex: 1, backgroundColor: '#080C14', justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 8 },
  backBtnInline: { backgroundColor: GREEN, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnInlineText: { color: '#FFF', fontWeight: '700' },
  scrollContent: { paddingBottom: 100 },
  headerCover: { height: 340, justifyContent: 'flex-end' },
  headerActions: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4,
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  profileInfoOverlay: { paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' },
  avatarWrapper: { position: 'relative', marginBottom: 14 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: GREEN },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: GREEN, fontSize: 36, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11, backgroundColor: GREEN,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#080C14',
  },
  guideName: { color: '#FFF', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' },
  verifiedGuideBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(56,151,240,0.12)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(56,151,240,0.3)',
  },
  verifiedGuideText: { color: '#3897F0', fontSize: 11, fontWeight: '700' },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  premiumText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  guideSpecialization: { color: GREEN, fontSize: 13, fontWeight: '600', marginBottom: 14, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 24 },
  statItem: { alignItems: 'center', gap: 3 },
  statValue: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  body: { paddingHorizontal: 20 },
  rateCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  rateAmount: { color: GREEN, fontSize: 24, fontWeight: '800' },
  rateLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  hireBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: GREEN, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
  },
  hireBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', marginBottom: 12 },

  // Locations
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginTop: 6 },
  locationName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  locationMeta: { color: GREEN, fontSize: 12, marginTop: 2 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)',
  },
  specChipText: { color: GREEN, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  langChip: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  langChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },

  bioText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22 },
  expeditionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 10,
  },
  expInfo: { flex: 1 },
  expTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  expMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textTransform: 'capitalize' },
  expPrice: { color: GREEN, fontSize: 13, fontWeight: '700' },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  reviewBtnText: { color: '#FFD700', fontSize: 14, fontWeight: '700' },
  noReviewsText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },

  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  reportText: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },

  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, paddingBottom: 32,
    backgroundColor: 'rgba(8,12,20,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  stickyHireBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  stickyHireBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
