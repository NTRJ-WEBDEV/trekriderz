import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Swiper from 'react-native-swiper';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const { width } = Dimensions.get('window');

const AMENITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  WiFi: 'wifi-outline',
  Kitchen: 'restaurant-outline',
  Heater: 'thermometer-outline',
  Parking: 'car-outline',
  'Mountain View': 'telescope-outline',
  'Hot Water': 'water-outline',
  'Power Backup': 'flash-outline',
  'Pets Allowed': 'paw-outline',
  TV: 'tv-outline',
  'Air Conditioning': 'snow-outline',
};

export default function HomestayDetailScreen() {
  const { id } = useLocalSearchParams();
  const [homestay, setHomestay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchHomestay();
  }, [id]);

  const fetchHomestay = async () => {
    try {
      const { data, error } = await supabase
        .from('homestays')
        .select(`
          *,
          owner:users!owner_id(full_name, avatar_url, bio)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setHomestay(data);
    } catch (error) {
      console.error('Error fetching homestay:', error);
      Alert.alert('Error', 'Failed to load homestay details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${homestay.name} in ${homestay.location} on TrekRiderz!`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleContactWhatsApp = () => {
    if (homestay?.contact_whatsapp) {
      const url = `whatsapp://send?phone=${homestay.contact_whatsapp}&text=Hi, I'm interested in booking ${homestay.name} on TrekRiderz.`;
      Linking.openURL(url).catch(() => {
        Alert.alert('WhatsApp Not Found', 'WhatsApp is not installed on this device');
      });
    } else {
      Alert.alert('Info', 'WhatsApp contact not available for this host');
    }
  };

  const handleBookNow = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to book a homestay.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }

    router.push({
      pathname: `/booking/${id}` as any,
      params: {
        id,
        name: homestay.name,
        price: homestay.price_per_night?.toString() || '0',
        type: 'homestay',
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

  if (!homestay) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.errorText}>Homestay not found</Text>
        <TouchableOpacity style={styles.backBtnSmall} onPress={() => router.back()}>
          <Text style={styles.backBtnTextSmall}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const photos =
    Array.isArray(homestay.photos) && homestay.photos.length > 0
      ? homestay.photos
      : ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'];

  const amenities: string[] = Array.isArray(homestay.amenities) ? homestay.amenities : [];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Image Swiper */}
        <View style={styles.imageContainer}>
          <Swiper
            activeDotColor="#8CC63F"
            dotColor="rgba(255,255,255,0.4)"
            height={360}
            loop={false}
          >
            {photos.map((photo: string, index: number) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={styles.heroImage}
                contentFit="cover"
              />
            ))}
          </Swiper>

          {/* Overlay gradient */}
          <LinearGradient
            colors={['rgba(8,12,20,0.55)', 'transparent']}
            style={styles.topGradient}
          />

          {/* Header Actions */}
          <SafeAreaView edges={['top']} style={styles.headerActions}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Rating badge */}
          {homestay.rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color="#FBBF24" />
              <Text style={styles.ratingText}>{homestay.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Details Body */}
        <View style={styles.body}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{homestay.name}</Text>
                {homestay.status === 'approved' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#8CC63F" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#8CC63F" />
                <Text style={styles.location}>{homestay.location}</Text>
              </View>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.price}>₹{homestay.price_per_night?.toLocaleString('en-IN')}</Text>
              <Text style={styles.priceLabel}>/ night</Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            {homestay.rooms && (
              <View style={styles.statChip}>
                <Ionicons name="bed-outline" size={16} color="#8CC63F" />
                <Text style={styles.statChipText}>{homestay.rooms} Rooms</Text>
              </View>
            )}
            {homestay.max_guests && (
              <View style={styles.statChip}>
                <Ionicons name="people-outline" size={16} color="#8CC63F" />
                <Text style={styles.statChipText}>Up to {homestay.max_guests} guests</Text>
              </View>
            )}
            {homestay.rating && (
              <View style={styles.statChip}>
                <Ionicons name="star-outline" size={16} color="#8CC63F" />
                <Text style={styles.statChipText}>{homestay.rating.toFixed(1)} rated</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {homestay.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this place</Text>
              <Text style={styles.description}>{homestay.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {amenities.map((amenity, index) => {
                  const iconName = AMENITY_ICONS[amenity] || 'checkmark-circle-outline';
                  return (
                    <View key={index} style={styles.amenityItem}>
                      <View style={styles.amenityIconWrap}>
                        <Ionicons name={iconName} size={20} color="#8CC63F" />
                      </View>
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Host Info */}
          {homestay.owner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Host</Text>
              <View style={styles.hostCard}>
                {homestay.owner.avatar_url ? (
                  <Image
                    source={{ uri: homestay.owner.avatar_url }}
                    style={styles.hostAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.hostAvatar, styles.hostAvatarFallback]}>
                    <Text style={styles.hostAvatarInitials}>
                      {homestay.owner.full_name?.charAt(0)?.toUpperCase() || 'H'}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.hostName}>{homestay.owner.full_name}</Text>
                  {homestay.owner.bio && (
                    <Text style={styles.hostBio} numberOfLines={2}>
                      {homestay.owner.bio}
                    </Text>
                  )}
                </View>
                {homestay.contact_whatsapp && (
                  <TouchableOpacity style={styles.whatsappBtn} onPress={handleContactWhatsApp}>
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Book Button */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceAmount}>
            ₹{homestay.price_per_night?.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.footerPriceLabel}>/night</Text>
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBookNow}>
          <Text style={styles.bookBtnText}>Book Now</Text>
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
  backBtnSmall: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  backBtnTextSmall: {
    color: '#FFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    height: 360,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 360,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 1,
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
    zIndex: 2,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 2,
  },
  ratingText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.3)',
  },
  verifiedText: {
    color: '#8CC63F',
    fontSize: 11,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  name: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#8CC63F',
    fontSize: 22,
    fontWeight: '800',
  },
  priceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(140,198,63,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.2)',
  },
  statChipText: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '600',
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
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityItem: {
    width: (width - 60) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  amenityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(140,198,63,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  hostAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#8CC63F',
  },
  hostAvatarFallback: {
    backgroundColor: 'rgba(140,198,63,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostAvatarInitials: {
    color: '#8CC63F',
    fontSize: 20,
    fontWeight: '800',
  },
  hostName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  hostBio: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    lineHeight: 18,
  },
  whatsappBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(37,211,102,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37,211,102,0.25)',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(8,12,20,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 16,
  },
  footerPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  footerPriceAmount: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  footerPriceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  bookBtn: {
    flex: 1,
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
