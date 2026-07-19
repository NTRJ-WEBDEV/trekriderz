import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Share, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Swiper from 'react-native-swiper';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { cacheHomestayRoute } from '@/lib/offline-safety';
import { AppColors } from '@/constants/theme';

const { width } = Dimensions.get('window');
const GREEN = AppColors.primary;

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  private_room: 'Private Room', entire_home: 'Entire Home', villa: 'Villa / Bungalow',
  dormitory: 'Dormitory / Hostel', tent_camping: 'Tent / Camping', treehouse: 'Treehouse',
  farmstay: 'Farmstay', heritage_home: 'Heritage Home',
};
const AMENITY_LABELS: Record<string, string> = {
  wifi: 'WiFi', parking: 'Parking', pool: 'Swimming Pool', kitchen: 'Kitchen Access',
  restaurant: 'Restaurant/Meals', hot_water: 'Hot Water', ac: 'Air Conditioning', heater: 'Heater',
  laundry: 'Laundry', garden: 'Garden', bonfire: 'Bonfire Area', trekking_access: 'Trekking Access',
  pet_friendly: 'Pet Friendly', airport_pickup: 'Airport Pickup', ev_charging: 'EV Charging', first_aid: 'First Aid Kit',
};
const AMENITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  wifi: 'wifi-outline', parking: 'car-outline', pool: 'water-outline', kitchen: 'restaurant-outline',
  restaurant: 'restaurant-outline', hot_water: 'water-outline', ac: 'snow-outline', heater: 'thermometer-outline',
  laundry: 'shirt-outline', garden: 'leaf-outline', bonfire: 'flame-outline', trekking_access: 'trail-sign-outline',
  pet_friendly: 'paw-outline', airport_pickup: 'car-sport-outline', ev_charging: 'flash-outline', first_aid: 'medkit-outline',
};
const BED_TYPE_LABELS: Record<string, string> = { single: 'Single', double: 'Double', queen: 'Queen', king: 'King', bunk: 'Bunk', sofa_bed: 'Sofa Bed' };
const CANCELLATION_LABELS: Record<string, string> = {
  flexible: 'Flexible — full refund 24h before check-in',
  moderate: 'Moderate — full refund 5 days before check-in',
  strict: 'Strict — 50% refund 7 days before check-in',
  non_refundable: 'Non-refundable',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nightsBetween(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const diff = Math.round((e - s) / 86400000);
  return diff > 0 ? diff : 0;
}

function effectivePriceForDate(room: any, dateStr: string) {
  const dow = new Date(dateStr).getDay();
  const isWeekend = dow === 5 || dow === 6;
  if (room.peak_season_enabled && (room.peak_seasons || []).some((p: any) => dateStr >= p.start && dateStr <= p.end)) {
    return room.peak_price || room.base_price;
  }
  if (room.off_season_enabled && (room.off_season_periods || []).some((p: any) => dateStr >= p.start && dateStr <= p.end)) {
    return room.off_season_price || room.base_price;
  }
  if (room.weekend_price_enabled && isWeekend) {
    return room.weekend_price || room.base_price;
  }
  return room.base_price;
}

export default function HomestayDetailScreen() {
  const { id } = useLocalSearchParams();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const [calcRoom, setCalcRoom] = useState<any | null>(null);
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [guests, setGuests] = useState(2);
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);

  useEffect(() => { fetchProperty(); }, [id]);

  const fetchProperty = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, room_types(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      setProperty(data);

      // Cache a straight-line "route to shelter" while we're online and know
      // where the user is — this is what the offline safety view falls back
      // to if signal drops before they reach it.
      if (data?.lat && data?.lng) {
        cacheRouteToShelter(data).catch(() => {});
      }
    } catch (error) {
      console.error('Error fetching property:', error);
      Alert.alert('Error', 'Failed to load property details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cacheRouteToShelter = async (homestay: any) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await cacheHomestayRoute({
        homestayId: homestay.id,
        homestayName: homestay.name,
        homestayLat: parseFloat(homestay.lat),
        homestayLng: parseFloat(homestay.lng),
        fromLat: loc.coords.latitude,
        fromLng: loc.coords.longitude,
      });
    } catch (_) {
      // No GPS fix / permission denied — nothing to cache, not fatal.
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${property.name} in ${property.city}, ${property.state} on TrekRiderz!` });
    } catch (error) {
      console.error(error);
    }
  };

  const openCalculator = (room: any) => {
    setCalcRoom(room);
    setCheckin('');
    setCheckout('');
    setGuests(room.base_occupancy || 2);
    setEnquiryMessage('');
    setEnquiryPhone('');
  };

  const nights = checkin && checkout && DATE_RE.test(checkin) && DATE_RE.test(checkout) ? nightsBetween(checkin, checkout) : 0;

  let roomTotal = 0;
  let extraGuestTotal = 0;
  if (calcRoom && nights > 0) {
    const start = new Date(checkin);
    for (let i = 0; i < nights; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      roomTotal += effectivePriceForDate(calcRoom, dateStr);
    }
    const extraGuests = Math.max(0, guests - (calcRoom.base_occupancy || 0));
    extraGuestTotal = extraGuests * (calcRoom.extra_guest_charge || 0) * nights;
  }
  const total = roomTotal + extraGuestTotal;

  const submitEnquiry = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to send an enquiry.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }
    if (!DATE_RE.test(checkin) || !DATE_RE.test(checkout) || nights <= 0) {
      Alert.alert('Required', 'Enter valid check-in and check-out dates (YYYY-MM-DD).');
      return;
    }
    if (nights < (calcRoom.min_nights || 1)) {
      Alert.alert('Minimum Stay', `This room requires a minimum stay of ${calcRoom.min_nights} night(s).`);
      return;
    }
    setSubmittingEnquiry(true);
    try {
      const { data: hasOverlap, error: overlapError } = await supabase.rpc('check_property_inquiry_overlap', {
        p_room_type_id: calcRoom.id,
        p_checkin: checkin,
        p_checkout: checkout,
      });
      if (overlapError) throw overlapError;
      if (hasOverlap) {
        Alert.alert('Dates Unavailable', 'These dates are already requested or booked for this room. Please choose different dates.');
        setSubmittingEnquiry(false);
        return;
      }

      const { error } = await supabase.from('property_inquiries').insert({
        property_id: property.id,
        room_type_id: calcRoom.id,
        user_id: user.id,
        checkin_date: checkin,
        checkout_date: checkout,
        guests,
        message: enquiryMessage.trim() || null,
        contact_phone: enquiryPhone.trim() || null,
        total_estimate: total,
        status: 'new',
      });
      if (error) throw error;
      setCalcRoom(null);
      Alert.alert('Enquiry Sent! 🏠', 'Our team will confirm within 24 hours.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send enquiry. Please try again.');
    } finally {
      setSubmittingEnquiry(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.errorText}>Property not found</Text>
        <TouchableOpacity style={styles.backBtnSmall} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Text style={styles.backBtnTextSmall}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const photos = Array.isArray(property.photos) && property.photos.length > 0
    ? property.photos
    : ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'];
  const amenities: string[] = Array.isArray(property.amenities) ? property.amenities : [];
  const propertyTypes: string[] = Array.isArray(property.property_type) ? property.property_type : [];
  const roomTypes: any[] = property.room_types || [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          <Swiper activeDotColor={GREEN} dotColor="rgba(255,255,255,0.4)" height={360} loop={false}>
            {photos.map((photo: string, index: number) => (
              <Image key={index} source={{ uri: photo }} style={styles.heroImage} contentFit="cover" />
            ))}
          </Swiper>
          <LinearGradient colors={['rgba(8,12,20,0.55)', 'transparent']} style={styles.topGradient} />
          <SafeAreaView edges={['top']} style={styles.headerActions}>
            <TouchableOpacity style={styles.circleBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{property.name}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={GREEN} />
                <Text style={styles.location}>{property.city}, {property.state}</Text>
              </View>
            </View>
          </View>

          {propertyTypes.length > 0 && (
            <View style={styles.statsRow}>
              {propertyTypes.map((t) => (
                <View key={t} style={styles.statChip}>
                  <Text style={styles.statChipText}>{PROPERTY_TYPE_LABELS[t] || t}</Text>
                </View>
              ))}
            </View>
          )}

          {property.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this place</Text>
              <Text style={styles.description}>{property.description}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Check-in / Check-out</Text>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="log-in-outline" size={14} color={GREEN} />
                <Text style={styles.statChipText}>Check-in {property.checkin_time}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="log-out-outline" size={14} color={GREEN} />
                <Text style={styles.statChipText}>Check-out {property.checkout_time}</Text>
              </View>
            </View>
          </View>

          {amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <View style={styles.amenityIconWrap}>
                      <Ionicons name={AMENITY_ICONS[amenity] || 'checkmark-circle-outline'} size={20} color={GREEN} />
                    </View>
                    <Text style={styles.amenityText}>{AMENITY_LABELS[amenity] || amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>House Rules</Text>
            <View style={styles.rulesGrid}>
              <RuleChip icon="logo-no-smoking" label="Smoking" allowed={property.smoking_allowed} />
              <RuleChip icon="paw-outline" label="Pets" allowed={property.pets_allowed} />
              <RuleChip icon="sparkles-outline" label="Parties" allowed={property.parties_allowed} />
              <RuleChip icon="happy-outline" label="Children" allowed={property.children_allowed} />
            </View>
            <Text style={styles.cancellationText}>
              Cancellation policy: {CANCELLATION_LABELS[property.cancellation_policy] || property.cancellation_policy}
            </Text>
          </View>

          {/* Room Types */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Room Types</Text>
            {roomTypes.length === 0 ? (
              <Text style={styles.description}>No room types listed yet.</Text>
            ) : (
              roomTypes.map((rt) => (
                <View key={rt.id} style={styles.roomCard}>
                  {rt.photos?.[0] ? (
                    <Image source={{ uri: rt.photos[0] }} style={styles.roomCardImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.roomCardImg, styles.roomCardImgFallback]}>
                      <Ionicons name="bed-outline" size={24} color="rgba(255,255,255,0.2)" />
                    </View>
                  )}
                  <View style={styles.roomCardBody}>
                    <Text style={styles.roomCardName}>{rt.name}</Text>
                    {rt.beds?.length > 0 && (
                      <Text style={styles.roomCardMeta}>
                        {rt.beds.map((b: any) => `${b.count} ${BED_TYPE_LABELS[b.type] || b.type}`).join(' + ')}
                      </Text>
                    )}
                    <Text style={styles.roomCardMeta}>Up to {rt.max_occupancy} guests</Text>
                    <View style={styles.roomCardPriceRow}>
                      <Text style={styles.roomCardPrice}>₹{rt.base_price?.toLocaleString('en-IN')}<Text style={styles.perNight}>/night</Text></Text>
                      {(rt.weekend_price_enabled || rt.peak_season_enabled) && (
                        <Text style={styles.priceNote}>Weekend/peak pricing may apply</Text>
                      )}
                    </View>
                    <TouchableOpacity style={styles.checkAvailBtn} onPress={() => openCalculator(rt)}>
                      <Text style={styles.checkAvailBtnText}>Check Availability</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.description}>Located in {property.city}, {property.state}. Exact address shared after booking confirmation.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={28} color="rgba(255,255,255,0.15)" />
              <Text style={styles.description}>No reviews yet</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Host</Text>
            <View style={styles.hostCard}>
              <View style={[styles.hostAvatar, styles.hostAvatarFallback]}>
                <Ionicons name="shield-checkmark" size={22} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hostName}>Managed by TrekRiderz Team</Text>
                <Text style={styles.hostBio}>Response time: usually within 24 hours</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Price Calculator / Enquire Modal */}
      <Modal visible={!!calcRoom} animationType="slide" transparent onRequestClose={() => setCalcRoom(null)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{calcRoom?.name}</Text>
              <TouchableOpacity onPress={() => setCalcRoom(null)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Check-in Date</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#555" value={checkin} onChangeText={setCheckin} />
              <Text style={styles.fieldLabel}>Check-out Date</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#555" value={checkout} onChangeText={setCheckout} />

              <Text style={styles.fieldLabel}>Guests</Text>
              <View style={styles.stepperBox}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setGuests(Math.max(1, guests - 1))}>
                  <Ionicons name="remove" size={16} color={GREEN} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{guests}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setGuests(Math.min(calcRoom?.max_occupancy || 10, guests + 1))}>
                  <Ionicons name="add" size={16} color={GREEN} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Your Contact Number</Text>
              <TextInput style={styles.input} placeholder="For the host to reach you" placeholderTextColor="#555" keyboardType="phone-pad" value={enquiryPhone} onChangeText={setEnquiryPhone} />

              <Text style={styles.fieldLabel}>Message (optional)</Text>
              <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Any special requests..." placeholderTextColor="#555" value={enquiryMessage} onChangeText={setEnquiryMessage} multiline />

              {nights > 0 && calcRoom && (
                <View style={styles.calcBreakdown}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>₹{(roomTotal / nights).toFixed(0)} avg × {nights} night{nights !== 1 ? 's' : ''}</Text>
                    <Text style={styles.calcValue}>₹{roomTotal.toLocaleString('en-IN')}</Text>
                  </View>
                  {extraGuestTotal > 0 && (
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Extra guest charge</Text>
                      <Text style={styles.calcValue}>₹{extraGuestTotal.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  <View style={[styles.calcRow, styles.calcTotalRow]}>
                    <Text style={styles.calcTotalLabel}>Total</Text>
                    <Text style={styles.calcTotalValue}>₹{total.toLocaleString('en-IN')}</Text>
                  </View>
                  <Text style={styles.calcServiceNote}>TrekRiderz service fee (included)</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.enquireBtn, submittingEnquiry && { opacity: 0.6 }]} onPress={submitEnquiry} disabled={submittingEnquiry}>
                {submittingEnquiry ? <ActivityIndicator color="#000" /> : <Text style={styles.enquireBtnText}>ENQUIRE NOW</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function RuleChip({ icon, label, allowed }: { icon: any; label: string; allowed: boolean }) {
  return (
    <View style={[styles.ruleChip, { opacity: allowed ? 1 : 0.4 }]}>
      <Ionicons name={allowed ? 'checkmark-circle' : 'close-circle'} size={14} color={allowed ? GREEN : '#EF4444'} />
      <Text style={styles.ruleChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  loadingContainer: { flex: 1, backgroundColor: '#080C14', justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 8 },
  backBtnSmall: { backgroundColor: GREEN, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  backBtnTextSmall: { color: '#000', fontWeight: '700' },
  scrollContent: { paddingBottom: 60 },
  imageContainer: { height: 360, position: 'relative' },
  heroImage: { width: '100%', height: 360 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, zIndex: 1 },
  headerActions: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, zIndex: 2 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)' },
  verifiedText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  name: { color: '#FFF', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)' },
  statChipText: { color: GREEN, fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  description: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityItem: { width: (width - 60) / 2, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  amenityIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(140,198,63,0.1)', justifyContent: 'center', alignItems: 'center' },
  amenityText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500', flex: 1 },
  rulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  ruleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  ruleChipText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  cancellationText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18 },

  roomCard: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  roomCardImg: { width: 88, height: 110, borderRadius: 12 },
  roomCardImgFallback: { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  roomCardBody: { flex: 1 },
  roomCardName: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  roomCardMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 2 },
  roomCardPriceRow: { marginTop: 6, marginBottom: 8 },
  roomCardPrice: { color: GREEN, fontSize: 16, fontWeight: '800' },
  perNight: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.5)' },
  priceNote: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  checkAvailBtn: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  checkAvailBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },

  emptyReviews: { alignItems: 'center', gap: 8, paddingVertical: 20 },

  hostCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  hostAvatar: { width: 52, height: 52, borderRadius: 26 },
  hostAvatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', justifyContent: 'center', alignItems: 'center' },
  hostName: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  hostBio: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0F1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { color: '#FFF', fontSize: 17, fontWeight: '800', flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: GREEN, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase', marginTop: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  stepperBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 6, width: 130 },
  stepperBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(140,198,63,0.12)', alignItems: 'center', justifyContent: 'center' },
  stepperValue: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  calcBreakdown: { backgroundColor: 'rgba(140,198,63,0.06)', borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: 'rgba(140,198,63,0.15)' },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  calcLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  calcValue: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  calcTotalRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4, marginBottom: 4 },
  calcTotalLabel: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  calcTotalValue: { color: GREEN, fontSize: 16, fontWeight: '800' },
  calcServiceNote: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  enquireBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  enquireBtnText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
