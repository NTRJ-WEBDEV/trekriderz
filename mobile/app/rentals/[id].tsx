import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

const TYPE_EMOJI: Record<string, string> = {
  bike: '🏍️', car: '🚗', jeep: '🚙', tempo: '🚐', auto: '🛺', bus: '🚌',
};

const TYPE_COLOR: Record<string, string> = {
  bike: '#F97316', car: '#3B82F6', jeep: '#10B981',
  tempo: '#8B5CF6', auto: '#F59E0B', bus: '#EF4444',
};

interface RentalVehicle {
  id: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: number | null;
  description: string | null;
  price_per_day: number;
  location: string;
  photos: string[];
  contact_phone: string;
  contact_whatsapp: string | null;
  features: string[];
  fuel_included: boolean;
  seats: number | null;
  owner_id: string;
  owner?: { full_name: string; avatar_url: string | null };
}

export default function RentalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<RentalVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase
        .from('rental_vehicles')
        .select('*, owner:users!owner_id(full_name, avatar_url)')
        .eq('id', id)
        .single();
      setVehicle(data as any);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleCall = () => {
    if (!vehicle?.contact_phone) return;
    Linking.openURL(`tel:${vehicle.contact_phone}`);
  };

  const handleWhatsApp = () => {
    const raw = vehicle?.contact_whatsapp || vehicle?.contact_phone;
    if (!raw) return;
    const num = raw.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Hi! I found your ${vehicle?.vehicle_type} (${vehicle?.make} ${vehicle?.model}) on TrekRiderz and I'm interested in renting it. Is it available?`
    );
    Linking.openURL(`whatsapp://send?phone=${num}&text=${msg}`).catch(() =>
      Alert.alert('WhatsApp not installed', 'Please use the call option instead.')
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={{ flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFF' }}>Vehicle not found</Text>
      </View>
    );
  }

  const typeColor = TYPE_COLOR[vehicle.vehicle_type] || '#F97316';
  const photos = vehicle.photos?.length > 0 ? vehicle.photos : [];

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Photo carousel */}
          <View style={styles.photoWrap}>
            {photos.length > 0 ? (
              <>
                <Image
                  source={{ uri: photos[photoIdx] }}
                  style={styles.photo}
                  contentFit="cover"
                />
                {photos.length > 1 && (
                  <View style={styles.photoDotsRow}>
                    {photos.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => setPhotoIdx(i)}>
                        <View style={[styles.photoDot, i === photoIdx && styles.photoDotActive]} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: typeColor + '22' }]}>
                <Text style={{ fontSize: 72 }}>{TYPE_EMOJI[vehicle.vehicle_type]}</Text>
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(8,12,20,0.9)']}
              style={styles.photoGradient}
            />
            {/* Back button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            {/* Type badge */}
            <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
              <Text style={styles.typeBadgeText}>
                {TYPE_EMOJI[vehicle.vehicle_type]} {vehicle.vehicle_type.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            {/* Name + price */}
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
                {vehicle.year && <Text style={styles.vehicleYear}>{vehicle.year}</Text>}
              </View>
              <View style={styles.priceBox}>
                <Text style={styles.priceAmount}>₹{vehicle.price_per_day.toLocaleString()}</Text>
                <Text style={styles.priceUnit}>per day</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#F97316" />
              <Text style={styles.infoText}>{vehicle.location}</Text>
            </View>

            {/* Specs row */}
            <View style={styles.specsRow}>
              {vehicle.seats && (
                <View style={styles.specChip}>
                  <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.specText}>{vehicle.seats} seats</Text>
                </View>
              )}
              <View style={[styles.specChip, vehicle.fuel_included && styles.specChipGreen]}>
                <Ionicons
                  name="water-outline"
                  size={14}
                  color={vehicle.fuel_included ? '#4ADE80' : 'rgba(255,255,255,0.4)'}
                />
                <Text style={[styles.specText, vehicle.fuel_included && { color: '#4ADE80' }]}>
                  {vehicle.fuel_included ? 'Fuel included' : 'Fuel not included'}
                </Text>
              </View>
            </View>

            {/* Description */}
            {vehicle.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.descText}>{vehicle.description}</Text>
              </View>
            )}

            {/* Features */}
            {vehicle.features?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What's Included</Text>
                <View style={styles.featuresGrid}>
                  {vehicle.features.map((f, i) => (
                    <View key={i} style={styles.featureChip}>
                      <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Owner */}
            {vehicle.owner && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Listed by</Text>
                <View style={styles.ownerRow}>
                  {vehicle.owner.avatar_url ? (
                    <Image source={{ uri: vehicle.owner.avatar_url }} style={styles.ownerAvatar} contentFit="cover" />
                  ) : (
                    <View style={styles.ownerAvatarPlaceholder}>
                      <Text style={styles.ownerInitial}>
                        {vehicle.owner.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.ownerName}>{vehicle.owner.full_name}</Text>
                </View>
              </View>
            )}

            <View style={{ height: 24 }} />
          </View>
        </ScrollView>

        {/* Contact action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
            <Ionicons name="call-outline" size={20} color="#FFF" />
            <Text style={styles.callBtnText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.waBtn} onPress={handleWhatsApp}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
            <Text style={styles.waBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },

  photoWrap: { height: 280, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  photoGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
  },
  photoDotsRow: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  photoDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  photoDotActive: { backgroundColor: '#F97316', width: 16 },
  backBtn: {
    position: 'absolute', top: 16, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute', top: 16, right: 16,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  content: { padding: 20 },

  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14, gap: 12,
  },
  vehicleName: { fontSize: 24, fontWeight: '900', color: '#FFF', lineHeight: 30 },
  vehicleYear: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  priceBox: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    padding: 12, alignItems: 'center',
  },
  priceAmount: { fontSize: 20, fontWeight: '900', color: '#F97316' },
  priceUnit: { fontSize: 11, color: 'rgba(249,115,22,0.7)', marginTop: 2 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14,
  },
  infoText: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },

  specsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  specChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  specChipGreen: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.2)',
  },
  specText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  descText: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 22 },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(74,222,128,0.07)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)',
  },
  featureText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20 },
  ownerAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  ownerInitial: { fontSize: 16, fontWeight: '700', color: '#F97316' },
  ownerName: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  actionBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#080C14',
  },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  callBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  waBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 14,
  },
  waBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
