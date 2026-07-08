import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import PhoneInput, { splitPhone } from '@/components/PhoneInput';
import MapPickerModal, { PickedLocation } from '@/components/MapPickerModal';

const GREEN = '#ADFF2F';
const RED = '#EF4444';
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

type Vehicle = {
  id: string;
  owner_id: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: number | null;
  description: string | null;
  price_per_day: number;
  location: string;
  lat: number | null;
  lng: number | null;
  contact_phone: string;
  contact_whatsapp: string | null;
  seats: number | null;
  fuel_included: boolean;
  features: string[];
  images: string[] | null;
  photos: any;
  status: 'pending' | 'approved' | 'rejected';
  is_available: boolean;
};

function allPhotos(v: Vehicle): string[] {
  if (v.images && v.images.length > 0) return v.images;
  if (Array.isArray(v.photos) && v.photos.length > 0) return v.photos;
  return [];
}

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [fetching, setFetching] = useState(true);

  // Existing photos (URLs from Supabase Storage)
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  // New photos picked locally (file URIs)
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  // Index of the cover photo among existingPhotos
  const [coverIndex, setCoverIndex] = useState(0);

  const [vehicleType, setVehicleType] = useState('bike');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneCode, setContactPhoneCode] = useState('+91');
  const [contactWhatsApp, setContactWhatsApp] = useState('');
  const [contactWhatsAppCode, setContactWhatsAppCode] = useState('+91');
  const [seats, setSeats] = useState('');
  const [fuelIncluded, setFuelIncluded] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);

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

  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const needsSeats = ['car', 'jeep', 'tempo', 'bus'].includes(vehicleType);

  useEffect(() => {
    if (!id) return;
    fetchVehicle();
  }, [id]);

  const fetchVehicle = async () => {
    const { data, error } = await supabase
      .from('rental_vehicles')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) {
      Alert.alert('Error', 'Vehicle not found.');
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
      return;
    }
    const v = data as Vehicle;
    setVehicle(v);
    setExistingPhotos(allPhotos(v));
    setVehicleType(v.vehicle_type ?? 'bike');
    setMake(v.make ?? '');
    setModel(v.model ?? '');
    setYear(v.year ? String(v.year) : '');
    setDescription(v.description ?? '');
    setPricePerDay(String(v.price_per_day ?? ''));
    setLocation(v.location ?? '');
    setCoords(v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null);
    const phoneSplit = splitPhone(v.contact_phone ?? '');
    setContactPhoneCode(phoneSplit.countryCode);
    setContactPhone(phoneSplit.number);
    if (v.contact_whatsapp) {
      const waSplit = splitPhone(v.contact_whatsapp);
      setContactWhatsAppCode(waSplit.countryCode);
      setContactWhatsApp(waSplit.number);
    }
    setSeats(v.seats ? String(v.seats) : '');
    setFuelIncluded(v.fuel_included ?? false);
    setSelectedFeatures(v.features ?? []);
    setIsAvailable(v.is_available ?? true);
    // Pricing pre-fill
    const d = data as any;
    setLocalEnabled(d.local_enabled ?? true);
    setLocalBasePrice(d.local_base_price ? String(d.local_base_price) : '');
    setLocalIncludedKm(d.local_included_km ? String(d.local_included_km) : '80');
    setLocalExtraKmCharge(d.local_extra_km_charge ? String(d.local_extra_km_charge) : '');
    setOutstationEnabled(d.outstation_enabled ?? false);
    setOutstationBasePrice(d.outstation_base_price ? String(d.outstation_base_price) : '');
    setOutstationIncludedKm(d.outstation_included_km ? String(d.outstation_included_km) : '250');
    setOutstationExtraKmCharge(d.outstation_extra_km_charge ? String(d.outstation_extra_km_charge) : '');
    setOutstationMinDays(d.outstation_min_days ? String(d.outstation_min_days) : '2');
    setDriverOption(d.driver_option ?? 'self');
    setDriverPricePerDay(d.driver_price_per_day ? String(d.driver_price_per_day) : '');
    setLocalUnlimitedKm(d.local_unlimited_km ?? false);
    setOutstationUnlimitedKm(d.outstation_unlimited_km ?? false);
    setFetching(false);
  };

  const totalPhotoCount = existingPhotos.length + newPhotos.length;

  const pickMorePhotos = async () => {
    if (totalPhotoCount >= 5) {
      Alert.alert('Limit Reached', 'You can have up to 5 photos total.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - totalPhotoCount,
    });
    if (!result.canceled && result.assets.length > 0) {
      setNewPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5 - existingPhotos.length));
    }
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (coverIndex >= next.length) setCoverIndex(Math.max(0, next.length - 1));
      return next;
    });
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadNewPhotos = async (): Promise<string[]> => {
    if (newPhotos.length === 0) return [];
    const ts = Date.now();
    const urls: string[] = [];

    for (let i = 0; i < newPhotos.length; i++) {
      setUploadProgress(Math.round(((i) / newPhotos.length) * 100));
      const uri = newPhotos[i];
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `vehicles/${user?.id}/${ts}/photo_${existingPhotos.length + i + 1}.${ext}`;

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
    return urls;
  };

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const handleSave = async () => {
    if (existingPhotos.length === 0 && newPhotos.length === 0) {
      Alert.alert('Photos Required', 'At least 1 photo is required.');
      return;
    }
    if (!make.trim() || !model.trim() || !pricePerDay || !location.trim() || !contactPhone.trim()) {
      Alert.alert('Missing Fields', 'Fill in make, model, price, location and contact number.');
      return;
    }

    setSaving(true);

    const uploadedUrls = await uploadNewPhotos();

    // Re-order: cover first, rest follow
    let finalPhotos = [...existingPhotos, ...uploadedUrls];
    if (coverIndex > 0 && coverIndex < finalPhotos.length) {
      const cover = finalPhotos.splice(coverIndex, 1)[0];
      finalPhotos = [cover, ...finalPhotos];
    }

    const { error } = await supabase.from('rental_vehicles').update({
      vehicle_type: vehicleType,
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year) : null,
      description: description.trim() || null,
      price_per_day: parseInt(pricePerDay),
      location: location.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      contact_phone: `${contactPhoneCode}${contactPhone.trim()}`,
      contact_whatsapp: contactWhatsApp.trim() ? `${contactWhatsAppCode}${contactWhatsApp.trim()}` : null,
      seats: needsSeats && seats ? parseInt(seats) : null,
      fuel_included: fuelIncluded,
      features: selectedFeatures,
      images: finalPhotos,
      is_available: isAvailable,
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
    }).eq('id', id);

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Saved!', 'Your vehicle listing has been updated.', [
      { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) }
    ]);
  };

  const handleResubmit = async () => {
    const { error } = await supabase
      .from('rental_vehicles')
      .update({ status: 'pending' })
      .eq('id', id);
    if (!error) {
      Alert.alert('Resubmitted', 'Your listing has been resubmitted for review.');
      fetchVehicle();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Listing',
      'Are you sure? This cannot be undone. The vehicle listing and all photos will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);

    // Delete storage objects
    const photosToDelete = allPhotos(vehicle!);
    for (const url of photosToDelete) {
      const match = url.match(/vehicle-photos\/(.+)$/);
      if (match?.[1]) {
        await supabase.storage.from('vehicle-photos').remove([match[1]]);
      }
    }

    const { error } = await supabase.from('rental_vehicles').delete().eq('id', id);
    setDeleting(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.replace('/rentals/my-vehicles' as any);
  };

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const statusBanner =
    vehicle?.status === 'pending' ? {
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.3)',
      text: 'Your listing is under review. Edits will require another review.',
      showResubmit: false,
    } : vehicle?.status === 'rejected' ? {
      color: RED,
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.3)',
      text: 'Your listing was rejected. Edit the details and resubmit for review.',
      showResubmit: true,
    } : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Vehicle</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status Banner */}
          {statusBanner && (
            <View style={[styles.banner, { backgroundColor: statusBanner.bg, borderColor: statusBanner.border }]}>
              <Ionicons
                name={vehicle?.status === 'rejected' ? 'close-circle-outline' : 'time-outline'}
                size={18}
                color={statusBanner.color}
              />
              <Text style={[styles.bannerText, { color: statusBanner.color }]}>{statusBanner.text}</Text>
              {statusBanner.showResubmit && (
                <TouchableOpacity style={[styles.resubmitBtn, { borderColor: RED }]} onPress={handleResubmit}>
                  <Text style={[styles.resubmitText, { color: RED }]}>Resubmit</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Photo Management ─────────────────────────── */}
          <Text style={styles.label}>
            Vehicle Photos <Text style={styles.labelHint}>({totalPhotoCount}/5 — tap to set cover)</Text>
          </Text>

          <View style={styles.photoGrid}>
            {existingPhotos.map((uri, i) => (
              <TouchableOpacity
                key={`ex-${i}`}
                style={[styles.thumb, i === coverIndex && styles.thumbCover]}
                onPress={() => setCoverIndex(i)}
                activeOpacity={0.85}
              >
                <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                {i === coverIndex && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>Cover</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removeExistingPhoto(i)}>
                  <Ionicons name="close-circle" size={20} color="#FFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {newPhotos.map((uri, i) => (
              <View key={`new-${i}`} style={styles.thumb}>
                <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removeNewPhoto(i)}>
                  <Ionicons name="close-circle" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}

            {totalPhotoCount < 5 && (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickMorePhotos} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={26} color={GREEN} />
                <Text style={styles.addPhotoText}>Add More</Text>
              </TouchableOpacity>
            )}
          </View>

          {saving && newPhotos.length > 0 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` as any }]} />
              </View>
              <Text style={styles.progressText}>Uploading… {uploadProgress}%</Text>
            </View>
          )}

          {/* ── Availability Toggle ───────────────────────── */}
          <TouchableOpacity
            style={[styles.availToggle, isAvailable ? styles.availOn : styles.availOff]}
            onPress={() => setIsAvailable(!isAvailable)}
            activeOpacity={0.8}
          >
            <View style={[styles.availDot, { backgroundColor: isAvailable ? GREEN : 'rgba(255,255,255,0.3)' }]} />
            <Text style={[styles.availText, { color: isAvailable ? GREEN : 'rgba(255,255,255,0.45)' }]}>
              {isAvailable ? 'Listing Active — Visible to renters' : 'Listing Inactive — Hidden from renters'}
            </Text>
            <Ionicons name={isAvailable ? 'eye-outline' : 'eye-off-outline'} size={18} color={isAvailable ? GREEN : 'rgba(255,255,255,0.3)'} />
          </TouchableOpacity>

          {/* ── Vehicle Type ───────────────────────────────── */}
          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.typeGrid}>
            {VEHICLE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, vehicleType === t.id && styles.typeChipActive]}
                onPress={() => setVehicleType(t.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, vehicleType === t.id && styles.typeLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Make & Model */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Make</Text>
              <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.25)"
                placeholder="e.g. Royal Enfield" value={make} onChangeText={setMake} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Model</Text>
              <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.25)"
                placeholder="e.g. Himalayan" value={model} onChangeText={setModel} />
            </View>
          </View>

          {/* Year & Price */}
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Year</Text>
              <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.25)"
                placeholder="e.g. 2022" value={year} onChangeText={setYear} keyboardType="numeric" />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Price / Day (₹)</Text>
              <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.25)"
                placeholder="e.g. 1200" value={pricePerDay} onChangeText={setPricePerDay} keyboardType="numeric" />
            </View>
          </View>

          {/* ── PRICING DETAILS ─────────────────────────── */}
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTitle}>PRICING DETAILS</Text>
            <Text style={styles.pricingSubtitle}>Set km-based rates for different rental types</Text>
            <View style={styles.pricingToggles}>
              <TouchableOpacity style={[styles.pricingToggleBtn, localEnabled && styles.pricingToggleBtnOn]} onPress={() => setLocalEnabled(!localEnabled)} activeOpacity={0.8}>
                <Ionicons name={localEnabled ? 'checkbox' : 'square-outline'} size={18} color={localEnabled ? GREEN : 'rgba(255,255,255,0.3)'} />
                <Text style={[styles.pricingToggleText, localEnabled && styles.pricingToggleTextOn]}>Local Rental</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pricingToggleBtn, outstationEnabled && styles.pricingToggleBtnOn]} onPress={() => setOutstationEnabled(!outstationEnabled)} activeOpacity={0.8}>
                <Ionicons name={outstationEnabled ? 'checkbox' : 'square-outline'} size={18} color={outstationEnabled ? GREEN : 'rgba(255,255,255,0.3)'} />
                <Text style={[styles.pricingToggleText, outstationEnabled && styles.pricingToggleTextOn]}>Outstation</Text>
              </TouchableOpacity>
            </View>
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
              <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.25)"
                placeholder="Number of seats" value={seats} onChangeText={setSeats} keyboardType="numeric" />
            </>
          )}

          <Text style={styles.label}>Location</Text>
          <TextInput style={styles.input} placeholderTextColor="rgba(255,255,255,0.25)"
            placeholder="Where is the vehicle available?" value={location} onChangeText={setLocation} />

          <TouchableOpacity style={styles.mapPinBtn} onPress={() => setShowMapPicker(true)}>
            <Ionicons name="map-outline" size={14} color={GREEN} />
            <Text style={styles.mapPinText}>
              {coords
                ? `📍 ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E — tap to adjust`
                : 'Pin exact pickup location on the map'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textarea]} placeholderTextColor="rgba(255,255,255,0.25)"
            placeholder="Condition, usage tips, notes..." value={description} onChangeText={setDescription}
            multiline numberOfLines={3} textAlignVertical="top" />

          {/* Fuel Toggle */}
          <TouchableOpacity style={styles.toggleRow} onPress={() => setFuelIncluded(!fuelIncluded)} activeOpacity={0.8}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Fuel Included</Text>
              <Text style={styles.toggleSub}>Fuel cost is included in daily price</Text>
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
                {selectedFeatures.includes(f) && <Ionicons name="checkmark-circle" size={14} color={GREEN} />}
                <Text style={[styles.featureText, selectedFeatures.includes(f) && styles.featureTextOn]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contact */}
          <Text style={styles.label}>Contact Phone</Text>
          <PhoneInput
            countryCode={contactPhoneCode} onChangeCountryCode={setContactPhoneCode}
            number={contactPhone} onChangeNumber={setContactPhone}
          />

          <Text style={styles.label}>WhatsApp Number</Text>
          <PhoneInput
            countryCode={contactWhatsAppCode} onChangeCountryCode={setContactWhatsAppCode}
            number={contactWhatsApp} onChangeNumber={setContactWhatsApp}
            placeholder="If different from above"
          />

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={BG} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={BG} />
                <Text style={styles.saveBtnText}>SAVE CHANGES</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.85}
          >
            {deleting ? (
              <ActivityIndicator color={RED} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color={RED} />
                <Text style={styles.deleteBtnText}>Delete Listing</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      <MapPickerModal
        visible={showMapPicker}
        initialLat={coords?.lat}
        initialLng={coords?.lng}
        onConfirm={(loc: PickedLocation) => {
          setCoords({ lat: loc.lat, lng: loc.lng });
          setShowMapPicker(false);
        }}
        onClose={() => setShowMapPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#FFF' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1,
    padding: 14, marginBottom: 4, marginTop: 4,
    flexWrap: 'wrap',
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  resubmitBtn: {
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  resubmitText: { fontSize: 12, fontWeight: '700' },

  label: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 18,
  },
  labelHint: { fontSize: 10, color: 'rgba(255,255,255,0.25)', textTransform: 'none', letterSpacing: 0 },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden',
    position: 'relative', borderWidth: 2, borderColor: 'transparent',
  },
  thumbCover: { borderColor: GREEN },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
  },
  coverBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(173,255,47,0.85)', paddingVertical: 3, alignItems: 'center',
  },
  coverBadgeText: { fontSize: 9, fontWeight: '800', color: BG },
  newBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(34,197,94,0.85)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  newBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  addPhotoBtn: {
    width: THUMB, height: THUMB, borderRadius: 10,
    backgroundColor: 'rgba(173,255,47,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(173,255,47,0.3)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPhotoText: { fontSize: 10, fontWeight: '700', color: GREEN, textAlign: 'center' },

  progressWrap: { marginTop: 10, gap: 6 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 2 },
  progressText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'right' },

  // Availability
  availToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 18,
  },
  availOn: { backgroundColor: 'rgba(173,255,47,0.07)', borderColor: 'rgba(173,255,47,0.25)' },
  availOff: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { flex: 1, fontSize: 13, fontWeight: '600' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  typeChipActive: { backgroundColor: 'rgba(173,255,47,0.12)', borderColor: GREEN },
  typeEmoji: { fontSize: 18 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  typeLabelActive: { color: GREEN },

  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 13, color: '#FFF', fontSize: 14,
  },
  textarea: { height: 90, paddingTop: 12 },
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  mapPinText: { fontSize: 12, color: GREEN, fontWeight: '600', flex: 1 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  inputFlex: { flex: 1, color: '#FFF', fontSize: 14 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)', padding: 16, marginTop: 18,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: 'rgba(255,255,255,0.38)' },
  toggleTrack: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', padding: 3,
  },
  toggleTrackOn: { backgroundColor: GREEN },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.5)' },
  toggleThumbOn: { backgroundColor: BG, alignSelf: 'flex-end' },

  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  featureChipOn: { backgroundColor: 'rgba(173,255,47,0.08)', borderColor: 'rgba(173,255,47,0.3)' },
  featureText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  featureTextOn: { color: GREEN },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16, marginTop: 28,
  },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: BG, letterSpacing: 1 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 16, paddingVertical: 14, marginTop: 12,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: RED },

  // Pricing
  pricingCard: { backgroundColor: 'rgba(173,255,47,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(173,255,47,0.15)', padding: 16, marginTop: 20 },
  pricingTitle: { fontSize: 12, fontWeight: '800', color: GREEN, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  pricingSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16 },
  pricingToggles: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  pricingToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pricingToggleBtnOn: { backgroundColor: 'rgba(173,255,47,0.1)', borderColor: 'rgba(173,255,47,0.35)' },
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
  unlimitedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(173,255,47,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(173,255,47,0.3)' },
  unlimitedBadgeText: { fontSize: 10, fontWeight: '700', color: GREEN },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  radioOuterOn: { borderColor: GREEN },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  driverLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  driverWithPrice: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  driverPriceInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 6, minWidth: 100 },
});
