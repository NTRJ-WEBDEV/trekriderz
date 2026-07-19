import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
  Linking,
} from 'react-native';

const WHATSAPP_NUMBER = process.env.EXPO_PUBLIC_BUSINESS_WHATSAPP || '917339231537';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useExpeditionStore } from '@/stores/expeditionStore';
import { useAuthStore } from '@/stores/authStore';
import PackageTierCard from '@/components/PackageTierCard';
import ItineraryTimeline from '@/components/ItineraryTimeline';
import { ExpeditionPackage } from '@/lib/expeditions';
import { AppColors } from '@/constants/theme';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80';

export default function ExpeditionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeExpedition: expedition, loading, error, fetchExpeditionById, joinExpedition } =
    useExpeditionStore();
  const { user } = useAuthStore();
  const [selectedPackage, setSelectedPackage] = useState<ExpeditionPackage | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (id) {
      fetchExpeditionById(id);
    }
  }, [id]);

  useEffect(() => {
    if (expedition?.packages && expedition.packages.length > 0 && !selectedPackage) {
      setSelectedPackage(expedition.packages[0]);
    }
  }, [expedition?.packages]);

  if (loading && !expedition) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8CC63F" />
      </View>
    );
  }

  if (error || !expedition) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error || 'Expedition not found'}</Text>
        <TouchableOpacity style={styles.backBtnInline} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverPhoto = expedition.cover_photos?.[0] || FALLBACK_IMAGE;
  const seatsLeft = (expedition.max_seats ?? 0) - (expedition.booked_seats ?? 0);
  const isWaitlist = expedition.status === 'full' || seatsLeft <= 0;

  const startDateObj = new Date(expedition.start_date);
  const endDateObj = new Date(expedition.end_date);
  const dateRangeStr = `${startDateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })} – ${endDateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
  const durationDays =
    Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this expedition: ${expedition.title} on TrekRiderz!`,
      });
    } catch (err) {}
  };

  const handleJoin = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to join an expedition.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }

    if (!isWaitlist && !selectedPackage) {
      Alert.alert('Package Required', 'Please select a package tier to join.');
      return;
    }

    const title = isWaitlist ? 'Join Waitlist' : 'Confirm Booking';
    const message = isWaitlist
      ? 'This expedition is currently full. Would you like to join the waitlist? You will be notified if a spot opens up.'
      : `You are booking 1 seat for the "${selectedPackage?.name}" package at ₹${selectedPackage?.price_per_person.toLocaleString(
          'en-IN'
        )}.\n\nPayment will be collected by the guide directly.`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: executeJoin },
    ]);
  };

  const executeJoin = async () => {
    if (!user || !expedition) return;

    setJoining(true);
    const result = await joinExpedition(expedition.id, selectedPackage?.id || '', 1);
    setJoining(false);

    if (result.success) {
      if (result.waitlisted) {
        Alert.alert(
          'Waitlist Joined',
          "You've been added to the waitlist. We'll notify you if a spot opens up!"
        );
      } else {
        Alert.alert(
          'Booking Requested!',
          'Your spot has been reserved. The guide will review and confirm your booking.',
          [
            { text: 'View My Bookings', onPress: () => router.push('/(tabs)/profile') },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    } else {
      Alert.alert(
        'Error',
        result.error?.message || 'Failed to join expedition. Please try again.'
      );
    }
  };

  const difficultyColor = {
    easy: '#22C55E',
    moderate: '#F59E0B',
    challenging: '#EF4444',
    expert: '#8B5CF6',
  }[expedition.difficulty] || '#9CA3AF';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: coverPhoto }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <LinearGradient
            colors={[
              'rgba(8,12,20,0.6)',
              'transparent',
              'rgba(8,12,20,0.9)',
              '#080C14',
            ]}
            style={StyleSheet.absoluteFillObject}
            locations={[0, 0.3, 0.75, 1]}
          />

          <SafeAreaView edges={['top']} style={styles.heroActions}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Hero Content */}
          <View style={styles.heroContent}>
            {/* Status Badges */}
            <View style={styles.heroBadgeRow}>
              <View style={[styles.diffBadge, { backgroundColor: difficultyColor + '25', borderColor: difficultyColor + '60' }]}>
                <Text style={[styles.diffBadgeText, { color: difficultyColor }]}>
                  {expedition.difficulty?.toUpperCase()}
                </Text>
              </View>
              {isWaitlist ? (
                <View style={styles.waitlistBadge}>
                  <Text style={styles.waitlistBadgeText}>WAITLIST</Text>
                </View>
              ) : seatsLeft <= 3 ? (
                <View style={styles.urgencyBadge}>
                  <Text style={styles.urgencyBadgeText}>
                    {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.heroTitle}>{expedition.title}</Text>

            <View style={styles.heroMeta}>
              <View style={styles.heroMetaItem}>
                <Ionicons name="location-outline" size={14} color="#8CC63F" />
                <Text style={styles.heroMetaText}>{expedition.destination}</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#8CC63F" />
                <Text style={styles.heroMetaText}>{dateRangeStr}</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Ionicons name="time-outline" size={14} color="#8CC63F" />
                <Text style={styles.heroMetaText}>{durationDays} days</Text>
              </View>
            </View>
          </View>
        </View>

        {/* BODY */}
        <View style={styles.body}>
          {/* Seats Progress */}
          <View style={styles.seatsCard}>
            <View style={styles.seatsRow}>
              <Text style={styles.seatsLabel}>Seats Available</Text>
              <Text style={styles.seatsCount}>
                <Text style={{ color: '#8CC63F', fontWeight: '800' }}>
                  {Math.max(0, seatsLeft)}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {' '}/ {expedition.max_seats}
                </Text>
              </Text>
            </View>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      100,
                      ((expedition.booked_seats || 0) / (expedition.max_seats || 1)) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Description */}
          {expedition.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About This Expedition</Text>
              <Text style={styles.description}>{expedition.description}</Text>
            </View>
          )}

          {/* Packages */}
          {expedition.packages && expedition.packages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Your Package</Text>
              <View style={styles.packagesContainer}>
                {expedition.packages.map((pkg) => (
                  <PackageTierCard
                    key={pkg.id}
                    pkg={pkg}
                    isSelected={selectedPackage?.id === pkg.id}
                    onSelect={() => setSelectedPackage(pkg)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Itinerary */}
          {expedition.itinerary_days && expedition.itinerary_days.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Itinerary</Text>
              <ItineraryTimeline days={expedition.itinerary_days} />
            </View>
          )}

          {/* Guide Info */}
          {expedition.guide && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Guide</Text>
              <TouchableOpacity
                style={styles.guideCard}
                onPress={() => router.push(`/guide/${expedition.guide_id}` as any)}
                activeOpacity={0.8}
              >
                {expedition.guide.photo_url ? (
                  <Image
                    source={{ uri: expedition.guide.photo_url }}
                    style={styles.guideAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.guideAvatar, styles.guideAvatarFallback]}>
                    <Text style={styles.guideAvatarInitials}>
                      {expedition.guide.name?.charAt(0)?.toUpperCase() || 'G'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideName}>{expedition.guide.name}</Text>
                  <Text style={styles.guideSpec}>
                    {expedition.guide.location || 'Adventure Guide'}
                  </Text>
                  {expedition.guide.rating && (
                    <View style={styles.guideRatingRow}>
                      <Ionicons name="star" size={12} color="#FBBF24" />
                      <Text style={styles.guideRating}>{expedition.guide.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyFooter}>
        {selectedPackage && !isWaitlist ? (
          <View style={styles.footerPriceRow}>
            <Text style={styles.footerPriceLabel}>{selectedPackage.name}</Text>
            <Text style={styles.footerPrice}>
              ₹{selectedPackage.price_per_person.toLocaleString('en-IN')}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.joinBtn, joining && { opacity: 0.6 }]}
          onPress={handleJoin}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.joinBtnText}>
              {isWaitlist ? 'Join Waitlist' : 'Book My Spot'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.waBtn}
          onPress={() => {
            const msg = encodeURIComponent(
              `Hi TrekRiderz! I'm interested in the expedition:\n\n` +
              `*${expedition?.title || 'Expedition'}*\n` +
              (selectedPackage ? `*Package:* ${selectedPackage.name} — ₹${selectedPackage.price_per_person.toLocaleString('en-IN')}/person\n` : '') +
              `\nPlease share more details.`
            );
            Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`);
          }}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 6 }} />
          <Text style={styles.waBtnText}>Enquire on WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  errorText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  backBtnInline: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  backBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroSection: {
    height: 400,
    justifyContent: 'flex-end',
  },
  heroActions: {
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  waitlistBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  waitlistBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  urgencyBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  urgencyBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 14,
  },
  heroMeta: {
    gap: 8,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  body: {
    paddingHorizontal: 20,
  },
  seatsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  seatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seatsLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  seatsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8CC63F',
    borderRadius: 3,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  description: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
  },
  packagesContainer: {
    gap: 12,
  },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  guideAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#8CC63F',
  },
  guideAvatarFallback: {
    backgroundColor: 'rgba(140,198,63,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideAvatarInitials: {
    color: '#8CC63F',
    fontSize: 20,
    fontWeight: '800',
  },
  guideName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  guideSpec: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginBottom: 4,
  },
  guideRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guideRating: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '700',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(8,12,20,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  footerPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  footerPrice: {
    color: '#8CC63F',
    fontSize: 18,
    fontWeight: '800',
  },
  joinBtn: {
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  waBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.whatsapp,
  },
  waBtnText: {
    color: AppColors.whatsapp,
    fontSize: 14,
    fontWeight: '600',
  },
});
