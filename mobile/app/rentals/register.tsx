import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const ORANGE = '#F97316';
const BG = '#080C14';

const VEHICLE_TYPES = [
  { id: 'bike',  label: 'Bike',  emoji: '🏍️' },
  { id: 'car',   label: 'Car',   emoji: '🚗' },
  { id: 'jeep',  label: 'Jeep',  emoji: '🚙' },
  { id: 'tempo', label: 'Tempo', emoji: '🚐' },
  { id: 'auto',  label: 'Auto',  emoji: '🛺' },
  { id: 'bus',   label: 'Bus',   emoji: '🚌' },
];

const COMMON_FEATURES = [
  'Helmet included', 'Insurance', 'GPS tracker',
  'First aid kit', '24/7 support', 'Luggage carrier',
  'Tool kit', 'Rain cover', 'AC',
];

export default function RegisterRentalScreen() {
  const user = useAuthStore((s) => s.user);

  const [vehicleType, setVehicleType] = useState('bike');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [location, setLocation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsApp, setContactWhatsApp] = useState('');
  const [seats, setSeats] = useState('');
  const [fuelIncluded, setFuelIncluded] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const needsSeats = ['car', 'jeep', 'tempo', 'bus'].includes(vehicleType);

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const handleSubmit = async () => {
    if (!make.trim() || !model.trim() || !pricePerDay || !location.trim() || !contactPhone.trim()) {
      Alert.alert('Missing Fields', 'Please fill in make, model, price, location and contact number.');
      return;
    }
    if (isNaN(parseInt(pricePerDay)) || parseInt(pricePerDay) <= 0) {
      Alert.alert('Invalid Price', 'Enter a valid price per day.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('rental_vehicles').insert({
      owner_id: user?.id,
      vehicle_type: vehicleType,
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year) : null,
      description: description.trim() || null,
      price_per_day: parseInt(pricePerDay),
      location: location.trim(),
      contact_phone: contactPhone.trim(),
      contact_whatsapp: contactWhatsApp.trim() || null,
      seats: needsSeats && seats ? parseInt(seats) : null,
      fuel_included: fuelIncluded,
      features: selectedFeatures,
      status: 'pending',
    });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert(
      'Listing Submitted! 🎉',
      'Your vehicle has been submitted for review. It will appear on the app once our team approves it (usually within 24 hours).',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>List Your Vehicle</Text>
            <Text style={styles.headerSub}>Earn by renting out your vehicle</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Vehicle Type */}
          <Text style={styles.label}>Vehicle Type *</Text>
          <View style={styles.typeGrid}>
            {VEHICLE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, vehicleType === t.id && styles.typeChipActive]}
                onPress={() => setVehicleType(t.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, vehicleType === t.id && styles.typeLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Make & Model */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Make *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Royal Enfield"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={make}
                onChangeText={setMake}
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Model *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Himalayan"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={model}
                onChangeText={setModel}
              />
            </View>
          </View>

          {/* Year & Price */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2022"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Price / Day (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1200"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={pricePerDay}
                onChangeText={setPricePerDay}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Seats (for multi-seat vehicles) */}
          {needsSeats && (
            <>
              <Text style={styles.label}>Seating Capacity</Text>
              <TextInput
                style={styles.input}
                placeholder="Number of seats"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={seats}
                onChangeText={setSeats}
                keyboardType="numeric"
              />
            </>
          )}

          {/* Location */}
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            placeholder="Where is the vehicle available? (city/area)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={location}
            onChangeText={setLocation}
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Condition, usage tips, any special notes..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Fuel included toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setFuelIncluded(!fuelIncluded)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Fuel Included</Text>
              <Text style={styles.toggleSub}>Fuel cost is included in the daily price</Text>
            </View>
            <View style={[styles.toggleTrack, fuelIncluded && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, fuelIncluded && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          {/* Features */}
          <Text style={styles.label}>What's Included</Text>
          <View style={styles.featuresGrid}>
            {COMMON_FEATURES.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.featureChip, selectedFeatures.includes(f) && styles.featureChipOn]}
                onPress={() => toggleFeature(f)}
                activeOpacity={0.8}
              >
                {selectedFeatures.includes(f) && (
                  <Ionicons name="checkmark-circle" size={14} color={ORANGE} />
                )}
                <Text style={[
                  styles.featureText,
                  selectedFeatures.includes(f) && styles.featureTextOn,
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contact */}
          <Text style={styles.label}>Contact Phone *</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.inputFlex}
              placeholder="+91 XXXXXXXXXX"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>WhatsApp Number</Text>
          <View style={styles.inputRow}>
            <Ionicons name="logo-whatsapp" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.inputFlex}
              placeholder="If different from above"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={contactWhatsApp}
              onChangeText={setContactWhatsApp}
              keyboardType="phone-pad"
            />
          </View>

          {/* Info note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.infoNoteText}>
              Your listing will be reviewed by our team before going live. Usually approved within 24 hours.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={BG} />
            ) : (
              <>
                <Ionicons name="car-outline" size={18} color={BG} />
                <Text style={styles.submitText}>SUBMIT FOR REVIEW</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  label: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16,
  },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  typeChipActive: { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: ORANGE },
  typeEmoji: { fontSize: 18 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  typeLabelActive: { color: ORANGE },

  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 13,
    color: '#FFF', fontSize: 14, marginBottom: 2,
  },
  textarea: { height: 90, paddingTop: 12 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 2,
  },
  inputFlex: { flex: 1, color: '#FFF', fontSize: 14 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: 16, marginTop: 16, marginBottom: 4,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: 'rgba(255,255,255,0.38)' },
  toggleTrack: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', padding: 3,
  },
  toggleTrackOn: { backgroundColor: ORANGE },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  toggleThumbOn: { backgroundColor: '#FFF', alignSelf: 'flex-end' },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  featureChipOn: {
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderColor: 'rgba(249,115,22,0.35)',
  },
  featureText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  featureTextOn: { color: ORANGE },

  infoNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14, marginTop: 20, marginBottom: 4,
  },
  infoNoteText: {
    flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 18,
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: ORANGE, borderRadius: 16,
    paddingVertical: 16, marginTop: 20,
  },
  submitText: { fontSize: 15, fontWeight: '900', color: BG, letterSpacing: 1 },
});
