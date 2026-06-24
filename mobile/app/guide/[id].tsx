import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  Linking,
  ActivityIndicator,
  Alert,
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

export default function GuideProfileScreen() {
  const { id } = useLocalSearchParams();
  const [guide, setGuide] = useState<any>(null);
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
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setGuide(data);
        const { data: expData } = await supabase
          .from('guided_expeditions')
          .select('*, packages:expedition_packages(price_per_person)')
          .eq('guide_id', id)
          .eq('status', 'published')
          .limit(5);
        setExpeditions(expData || []);
      }
    } catch (error) {
      console.error('Error fetching guide:', error);
      Alert.alert('Error', 'Failed to load guide details');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${guide.name}, a professional guide on TrekRiderz!`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleContactWhatsApp = () => {
    if (guide?.contact_phone) {
      const url = `whatsapp://send?phone=${guide.contact_phone}&text=Hi ${guide.name}, I found your profile on TrekRiderz and would like to hire you for a trip.`;
      Linking.openURL(url).catch(() => {
        Alert.alert('WhatsApp Not Found', 'WhatsApp is not installed on this device.');
      });
    }
  };

  const handleHireNow = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to book a guide.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }

    router.push({
      pathname: `/booking/${id}` as any,
      params: {
        id,
        name: guide.name,
        price: guide.rate_per_day?.toString() || '0',
        type: 'guide',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8CC63F" />
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

  const languages: string[] = Array.isArray(guide.languages) ? guide.languages : [];
  const certifications: string[] = Array.isArray(guide.certifications) ? guide.certifications : [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cover / Profile Header */}
        <View style={styles.headerCover}>
          {guide.cover_photo_url ? (
            <Image source={{ uri: guide.cover_photo_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#1a2a1a', '#080C14']}
              style={StyleSheet.absoluteFillObject}
            />
          )}
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
              {guide.photo_url ? (
                <Image source={{ uri: guide.photo_url }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>
                    {guide.name?.charAt(0)?.toUpperCase() || 'G'}
                  </Text>
                </View>
              )}
              {guide.status === 'approved' && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFF" />
                </View>
              )}
            </View>

            <Text style={styles.guideName}>{guide.name}</Text>

            {/* Badges row */}
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

            <Text style={styles.guideSpecialization}>{guide.specialization || 'Adventure Guide'}</Text>

            <View style={styles.statRow}>
              {guide.rating && (
                <View style={styles.statItem}>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.statValue}>{guide.rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              )}
              {guide.experience_years && (
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={14} color="#8CC63F" />
                  <Text style={styles.statValue}>{guide.experience_years}yr</Text>
                  <Text style={styles.statLabel}>Exp.</Text>
                </View>
              )}
              {guide.total_trips && (
                <View style={styles.statItem}>
                  <Ionicons name="map-outline" size={14} color="#8CC63F" />
                  <Text style={styles.statValue}>{guide.total_trips}</Text>
                  <Text style={styles.statLabel}>Trips</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>

          {/* Rate Card */}
          <View style={styles.rateCard}>
            <View>
              <Text style={styles.rateAmount}>₹{guide.rate_per_day?.toLocaleString('en-IN') || '—'}</Text>
              <Text style={styles.rateLabel}>per day</Text>
            </View>
            <View style={styles.rateActions}>
              {guide.contact_phone && (
                <TouchableOpacity style={styles.whatsappBtn} onPress={handleContactWhatsApp}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.hireBtn} onPress={handleHireNow}>
                <Text style={styles.hireBtnText}>Hire Guide</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location */}
          {guide.location && (
            <View style={styles.infoChipRow}>
              <Ionicons name="location-outline" size={16} color="#8CC63F" />
              <Text style={styles.infoChipText}>{guide.location}</Text>
            </View>
          )}

          {/* About */}
          {guide.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{guide.bio}</Text>
            </View>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Languages</Text>
              <View style={styles.chipRow}>
                {languages.map((lang, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Certifications</Text>
              {certifications.map((cert, i) => (
                <View key={i} style={styles.certRow}>
                  <Ionicons name="ribbon-outline" size={16} color="#8CC63F" />
                  <Text style={styles.certText}>{cert}</Text>
                </View>
              ))}
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
                      <Text style={styles.expMeta}>
                        {exp.destination} • {exp.difficulty}
                      </Text>
                    </View>
                    {minPrice !== null && (
                      <Text style={styles.expPrice}>
                        from ₹{minPrice.toLocaleString('en-IN')}
                      </Text>
                    )}
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Write a Review */}
          {user && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowReview(true)}>
                <Ionicons name="star-outline" size={18} color="#FFD700" />
                <Text style={styles.reviewBtnText}>Write a Review</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Hire Button */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.stickyHireBtn} onPress={handleHireNow}>
          <Text style={styles.stickyHireBtnText}>
            Hire {guide.name?.split(' ')[0]} — ₹{guide.rate_per_day?.toLocaleString('en-IN')}/day
          </Text>
        </TouchableOpacity>
      </View>

      <ReviewSheet
        visible={showReview}
        targetId={String(id)}
        targetType="guide"
        targetName={guide.name}
        reviewerId={user?.id || ''}
        onClose={() => setShowReview(false)}
        onSubmitted={() => setShowReview(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#080C14',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 8,
  },
  backBtnInline: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  backBtnInlineText: {
    color: '#FFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerCover: {
    height: 360,
    justifyContent: 'flex-end',
  },
  headerActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfoOverlay: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#8CC63F',
  },
  avatarFallback: {
    backgroundColor: 'rgba(140,198,63,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#8CC63F',
    fontSize: 36,
    fontWeight: '800',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8CC63F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#080C14',
  },
  guideName: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  verifiedGuideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56,151,240,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(56,151,240,0.3)',
  },
  verifiedGuideText: {
    color: '#3897F0',
    fontSize: 11,
    fontWeight: '700',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  premiumText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  guideSpecialization: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },
  body: {
    paddingHorizontal: 20,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rateAmount: {
    color: '#8CC63F',
    fontSize: 24,
    fontWeight: '800',
  },
  rateLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  rateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whatsappBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(37,211,102,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37,211,102,0.3)',
  },
  hireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8CC63F',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  hireBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  infoChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  infoChipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  bioText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.25)',
  },
  chipText: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '600',
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  certText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
  },
  expeditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  expInfo: {
    flex: 1,
  },
  expTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  expMeta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  expPrice: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  reviewBtnText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(8,12,20,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  stickyHireBtn: {
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stickyHireBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
