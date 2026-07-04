import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const { width } = Dimensions.get('window');
const THUMB = (width - 40 - 32) / 4;

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

  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Core details
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

  // Terms
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAccuracy, setAgreeAccuracy] = useState(false);
  const [agreeResponse, setAgreeResponse] = useState(false);

  // Pricing
  const [localEnabled, setLocalEnabled] = useState(true);
  const [localBasePrice, setLocalBasePrice] = useState('');
  const [localIncludedKm, setLocalIncludedKm] = useState('80');
  const [localExtraKmCharge, setLocalExtraKmCharge] = useState('');
  const [outstationEnabled, setOutstationEnabled] = useState(false);
  const [outstationBasePrice, setOutstationBasePrice] = useState('');
  const [outstationIncludedKm, setOutstationIncludedKm] = useState('250');
  const [outstationExtraKmCharge, setOutstationExtraKmCharge] = useState('');
  const [outstationMinDays, setOutstationMinDays] = useState('2');
  const [driverOption, setDriverOption] = useState<'self'|'driver'|'both'>('self');
  const [driverPricePerDay, setDriverPricePerDay] = useState('');
  const [localUnlimitedKm, setLocalUnlimitedKm] = useState(false);
  const [outstationUnlimitedKm, setOutstationUnlimitedKm] = useState(false);

  const needsSeats = ['car', 'jeep', 'tempo', 'bus'].includes(vehicleType);

  const pickPhotos = async () => {
    if (photos.length >= 5) { Alert.alert('Limit Reached', 'You can add up to 5 photos.'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 5 - photos.length,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0) return [];
    setUploading(true);
    const ts = Date.now();
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      setUploadProgress(Math.round((i / photos.length) * 100));
      const uri = photos[i];
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `vehicles/${user?.id}/${ts}/photo_${i + 1}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const { error } = await supabase.storage
        .from('vehicle-photos')
        .upload(path, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });
      if (!error) {
        const { data: urlData } = supabase.storage.from('vehicle-photos').getPublicUrl(path);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
    }
    setUploadProgress(100);
    setUploading(false);
    return urls;
  };

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleSubmit = async () => {
    if (photos.length === 0) { Alert.alert('Photos Required', 'Please add at least 1 photo of your vehicle.'); return; }
    if (!make.trim() || !model.trim() || !pricePerDay || !location.trim() || !contactPhone.trim()) {
      Alert.alert('Missing Fields', 'Please fill in make, model, price, location and contact number.'); return;
    }
    if (isNaN(parseInt(pricePerDay)) || parseInt(pricePerDay) <= 0) {
      Alert.alert('Invalid Price', 'Enter a valid price per day.'); return;
    }
    if (!agreeTerms || !agreeAccuracy || !agreeResponse) {
      Alert.alert('Required', 'Please accept all three agreements to continue.'); return;
    }
    setLoading(true);
    const imageUrls = await uploadPhotos();
    const { error } = await supabase.from('rental_vehicles').insert({
      owner_id: user?.id,
      vehicle_type: vehicleType,
      make: make.trim(), model: model.trim(),
      year: year ? parseInt(year) : null,
      description: description.trim() || null,
      price_per_day: parseInt(pricePerDay),
      location: location.trim(),
      contact_phone: contactPhone.trim(),
      contact_whatsapp: contactWhatsApp.trim() || null,
      seats: needsSeats && seats ? parseInt(seats) : null,
      fuel_included: fuelIncluded,
      features: selectedFeatures,
      images: imageUrls,
      status: 'pending',
      // Pricing
      local_enabled: localEnabled,
      local_base_price: localEnabled && localBasePrice ? parseFloat(localBasePrice) : 0,
      local_included_km: localEnabled && localIncludedKm ? parseInt(localIncludedKm) : 80,
      local_extra_km_charge: localEnabled && localExtraKmCharge ? parseFloat(localExtraKmCharge) : 0,
      outstation_enabled: outstationEnabled,
      outstation_base_price: outstationEnabled && outstationBasePrice ? parseFloat(outstationBasePrice) : 0,
      outstation_included_km: outstationEnabled && outstationIncludedKm ? parseInt(outstationIncludedKm) : 250,
      outstation_extra_km_charge: outstationEnabled && outstationExtraKmCharge ? parseFloat(outstationExtraKmCharge) : 0,
      outstation_min_days: outstationEnabled && outstationMinDays ? parseInt(outstationMinDays) : 2,
      driver_option: driverOption,
      driver_price_per_day: driverOption !== 'self' && driverPricePerDay ? parseFloat(driverPricePerDay) : 0,
      local_unlimited_km: localUnlimitedKm,
      outstation_unlimited_km: outstationUnlimitedKm,
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert(
      'Listing Submitted!',
      'Your vehicle has been submitted for review. It will appear on the app once approved (usually within 24 hours).',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>List Your Vehicle</Text>
            <Text style={styles.headerSub}>Earn by renting out your vehicle</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Photos */}
          <Text style={styles.label}>Vehicle Photos * <Text style={styles.labelHint}>(min 1, max 5)</Text></Text>
          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.thumb}>
                <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                <TouchableOpacity style={styles.thumbRemove} onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}>
                  <Ionicons name="close-circle" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhotos} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={26} color={GREEN} />
                <Text style={styles.addPhotoText}>{photos.length === 0 ? 'Add Photos' : 'Add More'}</Text>
              </TouchableOpacity>
            )}
          </View>
          {uploading && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${uploadProgress}%` as any }]} /></View>
              <Text style={styles.progressText}>Uploading… {uploadProgress}%</Text>
            </View>
          )}

          {/* Vehicle Type */}
          <Text style={styles.label}>Vehicle Type *</Text>
          <View style={styles.typeGrid}>
            {VEHICLE_TYPES.map((t) => (
              <TouchableOpacity key={t.id}
                style={[styles.typeChip, vehicleType === t.id && styles.typeChipActive]}
                onPress={() => setVehicleType(t.id)} activeOpacity={0.8}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, vehicleType === t.id && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Make & Model */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Make *</Text>
              <TextInput style={styles.input} placeholder="e.g. Royal Enfield" placeholderTextColor="rgba(255,255,255,0.25)" value={make} onChangeText={setMake} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Model *</Text>
              <TextInput style={styles.input} placeholder="e.g. Himalayan" placeholderTextColor="rgba(255,255,255,0.25)" value={model} onChangeText={setModel} />
            </View>
          </View>

          {/* Year & Base Price */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Year</Text>
              <TextInput style={styles.input} placeholder="e.g. 2022" placeholderTextColor="rgba(255,255,255,0.25)" value={year} onChangeText={setYear} keyboardType="numeric" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Display Price / Day (₹) *</Text>
              <TextInput style={styles.input} placeholder="e.g. 1200" placeholderTextColor="rgba(255,255,255,0.25)" value={pricePerDay} onChangeText={setPricePerDay} keyboardType="numeric" />
            </View>
          </View>

          {/* ── PRICING DETAILS ─────────────────────────────── */}
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTitle}>PRICING DETAILS</Text>
            <Text style={styles.pricingSubtitle}>Set km-based rates for different rental types</Text>

            {/* Type toggles */}
            <View style={styles.pricingToggles}>
              <TouchableOpacity
                style={[styles.pricingToggleBtn, localEnabled && styles.pricingToggleBtnOn]}
                onPress={() => setLocalEnabled(!localEnabled)} activeOpacity={0.8}
              >
                <Ionicons name={localEnabled ? 'checkbox' : 'square-outline'} size={18} color={localEnabled ? GREEN : 'rgba(255,255,255,0.3)'} />
                <Text style={[styles.pricingToggleText, localEnabled && styles.pricingToggleTextOn]}>Local Rental</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pricingToggleBtn, outstationEnabled && styles.pricingToggleBtnOn]}
                onPress={() => setOutstationEnabled(!outstationEnabled)} activeOpacity={0.8}
              >
                <Ionicons name={outstationEnabled ? 'checkbox' : 'square-outline'} size={18} color={outstationEnabled ? GREEN : 'rgba(255,255,255,0.3)'} />
                <Text style={[styles.pricingToggleText, outstationEnabled && styles.pricingToggleTextOn]}>Outstation</Text>
              </TouchableOpacity>
            </View>

            {/* Local block */}
            {localEnabled && (
              <View style={styles.pricingBlock}>
                <Text style={styles.pricingBlockTitle}>── LOCAL RENTAL ──</Text>
                <View style={styles.pricingRow}>
                  <View style={styles.pricingField}>
                    <Text style={styles.pricingFieldLabel}>Base price/day</Text>
                    <View style={styles.pricingInput}>
                      <Text style={styles.pricingPrefix}>₹</Text>
                      <TextInput style={styles.pricingTextInput} placeholder="800" placeholderTextColor="rgba(255,255,255,0.2)" value={localBasePrice} onChangeText={setLocalBasePrice} keyboardType="numeric" />
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.unlimitedRow} onPress={() => setLocalUnlimitedKm(!localUnlimitedKm)} activeOpacity={0.8}>
                  <View style={[styles.toggleTrack, localUnlimitedKm && styles.toggleTrackOn]}>
                    <View style={[styles.toggleThumb, localUnlimitedKm && styles.toggleThumbOn]} />
                  </View>
                  <Text style={[styles.unlimitedLabel, localUnlimitedKm && styles.unlimitedLabelOn]}>Unlimited KM</Text>
                  {localUnlimitedKm && (
                    <View style={styles.unlimitedBadge}>
                      <Ionicons name="infinite" size={12} color={GREEN} />
                      <Text style={styles.unlimitedBadgeText}>No km limit</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {!localUnlimitedKm && (
                  <View style={styles.pricingRow}>
                    <View style={styles.pricingField}>
                      <Text style={styles.pricingFieldLabel}>Included km/day</Text>
                      <View style={styles.pricingInput}>
                        <TextInput style={styles.pricingTextInput} placeholder="80" placeholderTextColor="rgba(255,255,255,0.2)" value={localIncludedKm} onChangeText={setLocalIncludedKm} keyboardType="numeric" />
                        <Text style={styles.pricingSuffix}>km</Text>
                      </View>
                    </View>
                    <View style={styles.pricingField}>
                      <Text style={styles.pricingFieldLabel}>Extra km charge</Text>
                      <View style={styles.pricingInput}>
                        <Text style={styles.pricingPrefix}>₹</Text>
                        <TextInput style={styles.pricingTextInput} placeholder="12" placeholderTextColor="rgba(255,255,255,0.2)" value={localExtraKmCharge} onChangeText={setLocalExtraKmCharge} keyboardType="numeric" />
                        <Text style={styles.pricingSuffix}>/km</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Outstation block */}
            {outstationEnabled && (
              <View style={styles.pricingBlock}>
                <Text style={styles.pricingBlockTitle}>── OUTSTATION ──</Text>
                <View style={styles.pricingRow}>
                  <View style={styles.pricingField}>
                    <Text style={styles.pricingFieldLabel}>Base price/day</Text>
                    <View style={styles.pricingInput}>
                      <Text style={styles.pricingPrefix}>₹</Text>
                      <TextInput style={styles.pricingTextInput} placeholder="1200" placeholderTextColor="rgba(255,255,255,0.2)" value={outstationBasePrice} onChangeText={setOutstationBasePrice} keyboardType="numeric" />
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.unlimitedRow} onPress={() => setOutstationUnlimitedKm(!outstationUnlimitedKm)} activeOpacity={0.8}>
                  <View style={[styles.toggleTrack, outstationUnlimitedKm && styles.toggleTrackOn]}>
                    <View style={[styles.toggleThumb, outstationUnlimitedKm && styles.toggleThumbOn]} />
                  </View>
                  <Text style={[styles.unlimitedLabel, outstationUnlimitedKm && styles.unlimitedLabelOn]}>Unlimited KM</Text>
                  {outstationUnlimitedKm && (
                    <View style={styles.unlimitedBadge}>
                      <Ionicons name="infinite" size={12} color={GREEN} />
                      <Text style={styles.unlimitedBadgeText}>No km limit</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {!outstationUnlimitedKm && (
                  <View style={styles.pricingRow}>
                    <View style={styles.pricingField}>
                      <Text style={styles.pricingFieldLabel}>Included km/day</Text>
                      <View style={styles.pricingInput}>
                        <TextInput style={styles.pricingTextInput} placeholder="250" placeholderTextColor="rgba(255,255,255,0.2)" value={outstationIncludedKm} onChangeText={setOutstationIncludedKm} keyboardType="numeric" />
                        <Text style={styles.pricingSuffix}>km</Text>
                      </View>
                    </View>
                    <View style={styles.pricingField}>
                      <Text style={styles.pricingFieldLabel}>Extra km charge</Text>
                      <View style={styles.pricingInput}>
                        <Text style={styles.pricingPrefix}>₹</Text>
                        <TextInput style={styles.pricingTextInput} placeholder="10" placeholderTextColor="rgba(255,255,255,0.2)" value={outstationExtraKmCharge} onChangeText={setOutstationExtraKmCharge} keyboardType="numeric" />
                        <Text style={styles.pricingSuffix}>/km</Text>
                      </View>
                    </View>
                  </View>
                )}
                <View style={[styles.pricingRow, { marginTop: 8 }]}>
                  <View style={[styles.pricingField, { flex: 1, maxWidth: 140 }]}>
                    <Text style={styles.pricingFieldLabel}>Minimum days</Text>
                    <View style={styles.pricingInput}>
                      <TextInput style={styles.pricingTextInput} placeholder="2" placeholderTextColor="rgba(255,255,255,0.2)" value={outstationMinDays} onChangeText={setOutstationMinDays} keyboardType="numeric" />
                      <Text style={styles.pricingSuffix}>days</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Driver block */}
            <View style={styles.pricingBlock}>
              <Text style={styles.pricingBlockTitle}>── DRIVER ──</Text>
              {(['self', 'driver', 'both'] as const).map((opt) => (
                <TouchableOpacity key={opt} style={styles.driverRow} onPress={() => setDriverOption(opt)} activeOpacity={0.8}>
                  <View style={[styles.radioOuter, driverOption === opt && styles.radioOuterOn]}>
                    {driverOption === opt && <View style={styles.radioInner} />}
                  </View>
                  {opt === 'self' && <Text style={styles.driverLabel}>Self drive only</Text>}
                  {opt === 'driver' && (
                    <View style={styles.driverWithPrice}>
                      <Text style={styles.driverLabel}>With driver only</Text>
                      {driverOption === 'driver' && (
                        <View style={styles.driverPriceInput}>
                          <Text style={styles.pricingPrefix}>₹</Text>
                          <TextInput style={styles.pricingTextInput} placeholder="500" placeholderTextColor="rgba(255,255,255,0.2)" value={driverPricePerDay} onChangeText={setDriverPricePerDay} keyboardType="numeric" />
                          <Text style={styles.pricingSuffix}>/day</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {opt === 'both' && (
                    <View style={styles.driverWithPrice}>
                      <Text style={styles.driverLabel}>Both options available</Text>
                      {driverOption === 'both' && (
                        <View style={styles.driverPriceInput}>
                          <Text style={styles.pricingPrefix}>₹</Text>
                          <TextInput style={styles.pricingTextInput} placeholder="500" placeholderTextColor="rgba(255,255,255,0.2)" value={driverPricePerDay} onChangeText={setDriverPricePerDay} keyboardType="numeric" />
                          <Text style={styles.pricingSuffix}>/day extra</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {needsSeats && (
            <>
              <Text style={styles.label}>Seating Capacity</Text>
              <TextInput style={styles.input} placeholder="Number of seats" placeholderTextColor="rgba(255,255,255,0.25)" value={seats} onChangeText={setSeats} keyboardType="numeric" />
            </>
          )}

          <Text style={styles.label}>Location *</Text>
          <TextInput style={styles.input} placeholder="Where is the vehicle available? (city/area)" placeholderTextColor="rgba(255,255,255,0.25)" value={location} onChangeText={setLocation} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textarea]} placeholder="Condition, usage tips, any special notes..." placeholderTextColor="rgba(255,255,255,0.25)" value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />

          <TouchableOpacity style={styles.toggleRow} onPress={() => setFuelIncluded(!fuelIncluded)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Fuel Included</Text>
              <Text style={styles.toggleSub}>Fuel cost is included in the daily price</Text>
            </View>
            <View style={[styles.toggleTrack, fuelIncluded && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, fuelIncluded && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          <Text style={styles.label}>What's Included</Text>
          <View style={styles.featuresGrid}>
            {COMMON_FEATURES.map((f) => (
              <TouchableOpacity key={f}
                style={[styles.featureChip, selectedFeatures.includes(f) && styles.featureChipOn]}
                onPress={() => toggleFeature(f)} activeOpacity={0.8}
              >
                {selectedFeatures.includes(f) && <Ionicons name="checkmark-circle" size={14} color={GREEN} />}
                <Text style={[styles.featureText, selectedFeatures.includes(f) && styles.featureTextOn]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Contact Phone *</Text>
          <View style={styles.inputRow}>
            <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput style={styles.inputFlex} placeholder="+91 XXXXXXXXXX" placeholderTextColor="rgba(255,255,255,0.25)" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
          </View>

          <Text style={styles.label}>WhatsApp Number</Text>
          <View style={styles.inputRow}>
            <Ionicons name="logo-whatsapp" size={16} color="rgba(255,255,255,0.35)" />
            <TextInput style={styles.inputFlex} placeholder="If different from above" placeholderTextColor="rgba(255,255,255,0.25)" value={contactWhatsApp} onChangeText={setContactWhatsApp} keyboardType="phone-pad" />
          </View>

          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.infoNoteText}>Your listing will be reviewed before going live. Usually approved within 24 hours.</Text>
          </View>

          <Text style={styles.label}>Terms & Commission *</Text>
          <ScrollView style={styles.termsBox} nestedScrollEnabled>
            <Text style={styles.termsTitle}>TREKRIDERZ VEHICLE RENTAL AGREEMENT</Text>
            <Text style={styles.termsHeading}>COMMISSION & PAYMENTS</Text>
            <Text style={styles.termsBody}>
              TrekRiderz charges a 15% service commission on each confirmed rental. This covers platform maintenance, customer support, marketing, and payment processing.{'\n\n'}
              Payment will be transferred within 3-5 business days after the rental period ends, after deducting the 15% commission.
            </Text>
            <Text style={styles.termsHeading}>VEHICLE CONDITION & INSURANCE</Text>
            <Text style={styles.termsBody}>
              Your vehicle must be roadworthy, accurately described, and covered by valid insurance at all times it is listed. Misleading listings will result in immediate removal.
            </Text>
            <Text style={styles.termsHeading}>ACCIDENTS & LIABILITY</Text>
            <Text style={styles.termsBody}>
              You are responsible for ensuring your insurance covers rental use. In case of an accident, both parties must cooperate with insurance claims. TrekRiderz is not liable for damages, accidents, or disputes arising from vehicle use.
            </Text>
            <Text style={styles.termsHeading}>BOOKING MANAGEMENT</Text>
            <Text style={styles.termsBody}>
              All bookings are managed through TrekRiderz. You must respond to booking requests within 24 hours. Repeated non-responses may result in listing suspension.
            </Text>
            <Text style={styles.termsHeading}>TERMINATION POLICY</Text>
            <Text style={styles.termsBody}>
              Either party may terminate this agreement with 30 days written notice. TrekRiderz may immediately terminate listings for fraud, safety violations, repeated policy breaches, or legal violations.
            </Text>
            <Text style={[styles.termsBody, { marginTop: 8 }]}>
              By accepting, you confirm that you have the legal right to list this vehicle, all information provided is accurate, and you accept the 15% commission structure.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreeTerms(!agreeTerms)} activeOpacity={0.8}>
            <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
              {agreeTerms && <Ionicons name="checkmark" size={14} color={BG} />}
            </View>
            <Text style={styles.checkboxLabel}>I have read and agree to the TrekRiderz Vehicle Rental Agreement and Commission Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreeAccuracy(!agreeAccuracy)} activeOpacity={0.8}>
            <View style={[styles.checkbox, agreeAccuracy && styles.checkboxChecked]}>
              {agreeAccuracy && <Ionicons name="checkmark" size={14} color={BG} />}
            </View>
            <Text style={styles.checkboxLabel}>I confirm that all information provided is accurate and I have the legal right to list this vehicle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreeResponse(!agreeResponse)} activeOpacity={0.8}>
            <View style={[styles.checkbox, agreeResponse && styles.checkboxChecked]}>
              {agreeResponse && <Ionicons name="checkmark" size={14} color={BG} />}
            </View>
            <Text style={styles.checkboxLabel}>I agree to respond to booking requests within 24 hours</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, (loading || uploading || !agreeTerms || !agreeAccuracy || !agreeResponse) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading || uploading || !agreeTerms || !agreeAccuracy || !agreeResponse}
          >
            {loading || uploading ? <ActivityIndicator color={BG} /> : (
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  label: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  labelHint: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'none', letterSpacing: 0 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10 },
  addPhotoBtn: {
    width: THUMB, height: THUMB, borderRadius: 10,
    backgroundColor: 'rgba(140,198,63,0.07)', borderWidth: 1.5, borderColor: 'rgba(140,198,63,0.3)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPhotoText: { fontSize: 10, fontWeight: '700', color: GREEN, textAlign: 'center' },
  progressWrap: { marginTop: 10, gap: 6 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 2 },
  progressText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'right' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  typeChipActive: { backgroundColor: 'rgba(140,198,63,0.15)', borderColor: GREEN },
  typeEmoji: { fontSize: 18 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  typeLabelActive: { color: GREEN },

  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 13, color: '#FFF', fontSize: 14, marginBottom: 2 },
  textarea: { height: 90, paddingTop: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 2 },
  inputFlex: { flex: 1, color: '#FFF', fontSize: 14 },

  // Pricing card
  pricingCard: { backgroundColor: 'rgba(140,198,63,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(140,198,63,0.15)', padding: 16, marginTop: 20 },
  pricingTitle: { fontSize: 12, fontWeight: '800', color: GREEN, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  pricingSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16 },
  pricingToggles: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  pricingToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pricingToggleBtnOn: { backgroundColor: 'rgba(140,198,63,0.1)', borderColor: 'rgba(140,198,63,0.35)' },
  pricingToggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  pricingToggleTextOn: { color: GREEN },
  pricingBlock: { marginTop: 16, gap: 8 },
  pricingBlockTitle: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: 4 },
  pricingRow: { flexDirection: 'row', gap: 8 },
  pricingField: { flex: 1 },
  pricingFieldLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  pricingInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 9 },
  pricingTextInput: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '600', padding: 0 },
  pricingPrefix: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginRight: 3 },
  pricingSuffix: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 2 },
  unlimitedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  unlimitedLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  unlimitedLabelOn: { color: GREEN },
  unlimitedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)' },
  unlimitedBadgeText: { fontSize: 10, fontWeight: '700', color: GREEN },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  radioOuterOn: { borderColor: GREEN },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  driverLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  driverWithPrice: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  driverPriceInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 6, minWidth: 100 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', padding: 16, marginTop: 16, marginBottom: 4 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: 'rgba(255,255,255,0.38)' },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', padding: 3 },
  toggleTrackOn: { backgroundColor: GREEN },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.5)' },
  toggleThumbOn: { backgroundColor: '#FFF', alignSelf: 'flex-end' },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  featureChipOn: { backgroundColor: 'rgba(140,198,63,0.1)', borderColor: 'rgba(140,198,63,0.35)' },
  featureText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  featureTextOn: { color: GREEN },

  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginTop: 20, marginBottom: 4 },
  infoNoteText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 18 },

  termsBox: {
    maxHeight: 240, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginTop: 20, marginBottom: 16,
  },
  termsTitle: { color: GREEN, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 12, textAlign: 'center' },
  termsHeading: { color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 4, letterSpacing: 0.5 },
  termsBody: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 18 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkboxLabel: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19 },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16, marginTop: 20 },
  submitText: { fontSize: 15, fontWeight: '900', color: BG, letterSpacing: 1 },
});
