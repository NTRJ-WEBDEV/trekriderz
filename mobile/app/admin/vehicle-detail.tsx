import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.08)';

const TYPE_EMOJI: Record<string, string> = {
  bike: '🏍️', car: '🚗', jeep: '🚙', tempo: '🚐', auto: '🛺', bus: '🚌',
};

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    const { data } = await supabase
      .from('rental_vehicles')
      .select('*, owner:users!owner_id(id, full_name, avatar_url, email)')
      .eq('id', id)
      .single();
    setVehicle(data || null);
    setLoading(false);
  };

  const handleApprove = async () => {
    setActionLoading(true);
    const { error } = await supabase
      .from('rental_vehicles')
      .update({ status: 'approved' })
      .eq('id', id);
    if (error) {
      Alert.alert('Error', error.message);
      setActionLoading(false);
      return;
    }
    const owner = Array.isArray(vehicle?.owner) ? vehicle.owner[0] : vehicle?.owner;
    if (owner?.id) {
      await supabase.from('notifications').insert({
        user_id: owner.id,
        type: 'other',
        title: 'Vehicle Listing Approved!',
        message: `Your ${vehicle.make} ${vehicle.model} is now live on TrekRiderz.`,
        related_id: id,
      });
    }
    setActionLoading(false);
    Alert.alert('Approved ✓', 'Listing is now live.', [{ text: 'Done', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) }]);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Enter a reason for the owner.');
      return;
    }
    setActionLoading(true);
    const { error } = await supabase
      .from('rental_vehicles')
      .update({ status: 'rejected' })
      .eq('id', id);
    if (error) {
      Alert.alert('Error', error.message);
      setActionLoading(false);
      return;
    }
    const owner = Array.isArray(vehicle?.owner) ? vehicle.owner[0] : vehicle?.owner;
    if (owner?.id) {
      await supabase.from('notifications').insert({
        user_id: owner.id,
        type: 'other',
        title: 'Vehicle Listing Not Approved',
        message: rejectReason.trim(),
        related_id: id,
      });
    }
    setActionLoading(false);
    setRejectVisible(false);
    Alert.alert('Rejected', 'Owner has been notified.', [{ text: 'Done', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) }]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Vehicle not found</Text>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Text style={{ color: GREEN }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const photos: string[] = (
    vehicle.images?.length ? vehicle.images :
    Array.isArray(vehicle.photos) ? vehicle.photos : []
  ).filter(Boolean);

  const owner = Array.isArray(vehicle.owner) ? vehicle.owner[0] : vehicle.owner;
  const features: string[] = Array.isArray(vehicle.features) ? vehicle.features : [];
  const isPending = vehicle.status === 'pending';

  const statusColor: Record<string, string> = {
    pending: '#F59E0B', approved: '#22C55E', rejected: '#EF4444', suspended: '#9CA3AF',
  };
  const sColor = statusColor[vehicle.status] || '#9CA3AF';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {vehicle.make} {vehicle.model}
          </Text>
          <View style={[styles.statusBadge, { borderColor: `${sColor}44`, backgroundColor: `${sColor}12` }]}>
            <Text style={[styles.statusText, { color: sColor }]}>{vehicle.status}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isPending ? 110 : 40 }}>

        {/* Photos */}
        {photos.length > 0 ? (
          <View>
            <Image source={{ uri: photos[photoIndex] }} style={styles.mainPhoto} contentFit="cover" />
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
            {photos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={styles.thumbStrip} contentContainerStyle={styles.thumbRow}
              >
                {photos.map((uri, i) => (
                  <TouchableOpacity key={i} onPress={() => setPhotoIndex(i)} activeOpacity={0.8}>
                    <Image
                      source={{ uri }}
                      style={[styles.thumb, i === photoIndex && styles.thumbActive]}
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={styles.noPhoto}>
            <Text style={{ fontSize: 56 }}>{TYPE_EMOJI[vehicle.vehicle_type] || '🚗'}</Text>
            <Text style={styles.noPhotoLabel}>No photos uploaded</Text>
          </View>
        )}

        <View style={styles.body}>
          {/* Title + type */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{vehicle.make} {vehicle.model}</Text>
              {vehicle.year ? <Text style={styles.year}>{vehicle.year}</Text> : null}
            </View>
            <View style={styles.typeChip}>
              <Text style={{ fontSize: 18 }}>{TYPE_EMOJI[vehicle.vehicle_type] || '🚗'}</Text>
              <Text style={styles.typeChipText}>{vehicle.vehicle_type.toUpperCase()}</Text>
            </View>
          </View>

          {/* Info grid */}
          <View style={styles.infoGrid}>
            <InfoTile icon="location-outline" label="Location" value={vehicle.location} color={GREEN} />
            <InfoTile icon="cash-outline" label="Price / Day" value={`₹${vehicle.price_per_day?.toLocaleString('en-IN')}`} color="#F59E0B" />
            {vehicle.seats ? <InfoTile icon="people-outline" label="Seats" value={`${vehicle.seats}`} color="#3897F0" /> : null}
            <InfoTile
              icon="water-outline"
              label="Fuel"
              value={vehicle.fuel_included ? 'Included' : 'Not included'}
              color={vehicle.fuel_included ? '#22C55E' : 'rgba(255,255,255,0.35)'}
            />
          </View>

          {/* Pricing */}
          {(vehicle.local_enabled || vehicle.outstation_enabled) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Pricing Details</Text>
              {vehicle.local_enabled && (
                <View style={pricingS.block}>
                  <Text style={pricingS.blockLabel}>LOCAL RENTAL</Text>
                  <Text style={pricingS.line}>
                    ₹{vehicle.local_base_price?.toLocaleString('en-IN') || 0}/day
                    {vehicle.local_unlimited_km
                      ? ' — Unlimited KM ✅'
                      : vehicle.local_extra_km_charge > 0
                        ? ` + ₹${vehicle.local_extra_km_charge}/km after ${vehicle.local_included_km}km`
                        : ` · ${vehicle.local_included_km}km included`}
                  </Text>
                </View>
              )}
              {vehicle.outstation_enabled && (
                <View style={pricingS.block}>
                  <Text style={pricingS.blockLabel}>OUTSTATION</Text>
                  <Text style={pricingS.line}>
                    ₹{vehicle.outstation_base_price?.toLocaleString('en-IN') || 0}/day
                    {vehicle.outstation_unlimited_km
                      ? ' — Unlimited KM ✅'
                      : vehicle.outstation_extra_km_charge > 0
                        ? ` + ₹${vehicle.outstation_extra_km_charge}/km after ${vehicle.outstation_included_km}km`
                        : ` · ${vehicle.outstation_included_km}km included`}
                  </Text>
                  <Text style={pricingS.meta}>Min. {vehicle.outstation_min_days || 2} days</Text>
                </View>
              )}
              {vehicle.driver_option && vehicle.driver_option !== 'self' && (
                <View style={pricingS.block}>
                  <Text style={pricingS.blockLabel}>DRIVER</Text>
                  <Text style={pricingS.line}>
                    {vehicle.driver_option === 'driver' ? 'With driver only' : 'Self drive or with driver'}
                    {vehicle.driver_price_per_day > 0 ? ` · ₹${vehicle.driver_price_per_day}/day extra` : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Contact Info</Text>
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={15} color={GREEN} />
              <Text style={styles.contactText}>{vehicle.contact_phone}</Text>
            </View>
            {vehicle.contact_whatsapp ? (
              <View style={styles.contactRow}>
                <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                <Text style={styles.contactText}>{vehicle.contact_whatsapp}</Text>
              </View>
            ) : null}
          </View>

          {/* Features */}
          {features.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Features & Amenities</Text>
              <View style={styles.featureWrap}>
                {features.map((f, i) => (
                  <View key={i} style={styles.featureChip}>
                    <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {vehicle.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.desc}>{vehicle.description}</Text>
            </View>
          ) : null}

          {/* Owner */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Owner</Text>
            <View style={styles.ownerRow}>
              {owner?.avatar_url ? (
                <Image source={{ uri: owner.avatar_url }} style={styles.ownerAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.ownerAvatar, styles.ownerFallback]}>
                  <Text style={styles.ownerInitial}>{owner?.full_name?.charAt(0) || '?'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerName}>{owner?.full_name || 'Unknown'}</Text>
                {owner?.email ? <Text style={styles.ownerEmail}>{owner.email}</Text> : null}
              </View>
              {owner?.id ? (
                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() => router.push(`/user/${owner.id}` as any)}
                >
                  <Text style={styles.profileBtnText}>Profile</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text style={styles.submittedDate}>
            Submitted {new Date(vehicle.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
      </ScrollView>

      {/* Action bar — pending only */}
      {isPending && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.rejectBtn}
            onPress={() => { setRejectReason(''); setRejectVisible(true); }}
            disabled={actionLoading}
          >
            <Ionicons name="close" size={18} color="#EF4444" />
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveBtn, actionLoading && { opacity: 0.6 }]}
            onPress={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFF" />
                <Text style={styles.approveText}>Approve Listing</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Reject modal */}
      {rejectVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reason for Rejection</Text>
            <Text style={styles.modalSub}>Sent to the owner as a notification.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Photos are unclear, missing contact details…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRejectVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalRejectBtn, actionLoading && { opacity: 0.6 }]}
                onPress={handleReject}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.modalRejectText}>Send Rejection</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function InfoTile({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View style={tileS.wrap}>
      <Ionicons name={icon} size={17} color={color} />
      <Text style={tileS.label}>{label}</Text>
      <Text style={[tileS.value, { color }]}>{value}</Text>
    </View>
  );
}
const tileS = StyleSheet.create({
  wrap: {
    flex: 1, minWidth: '44%', backgroundColor: CARD,
    borderRadius: 14, padding: 14, gap: 4,
    borderWidth: 1, borderColor: BORDER,
  },
  label: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, fontWeight: '800' },
});

const pricingS = StyleSheet.create({
  block: { backgroundColor: 'rgba(140,198,63,0.06)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(140,198,63,0.15)' },
  blockLabel: { fontSize: 9, fontWeight: '800', color: GREEN, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5 },
  line: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '700' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  mainPhoto: { width: '100%', height: 280 },
  photoCounter: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  photoCounterText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  thumbStrip: { backgroundColor: 'rgba(0,0,0,0.55)' },
  thumbRow: { padding: 8, gap: 6 },
  thumb: { width: 56, height: 48, borderRadius: 8 },
  thumbActive: { borderWidth: 2, borderColor: GREEN },
  noPhoto: { height: 180, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noPhotoLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },

  body: { padding: 20, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 2 },
  year: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  typeChipText: { color: '#F97316', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  contactText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  featureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  featureText: { color: GREEN, fontSize: 12, fontWeight: '600' },
  desc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 21 },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24 },
  ownerFallback: { backgroundColor: 'rgba(140,198,63,0.15)', justifyContent: 'center', alignItems: 'center' },
  ownerInitial: { color: GREEN, fontSize: 18, fontWeight: '800' },
  ownerName: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  ownerEmail: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  profileBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  profileBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  submittedDate: { color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', marginTop: 8 },

  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 16,
    backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER,
  },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)',
  },
  rejectText: { color: '#EF4444', fontWeight: '700', fontSize: 15 },
  approveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 14, borderRadius: 14, backgroundColor: GREEN,
  },
  approveText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12, borderTopWidth: 1, borderColor: BORDER,
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  modalSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  modalInput: {
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: BORDER,
    minHeight: 80, textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 14 },
  modalRejectBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  modalRejectText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
