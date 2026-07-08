import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadImage } from '@/lib/storage';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import MapPickerModal, { PickedLocation } from '@/components/MapPickerModal';
import { POI_CATEGORIES, PoiCategory } from '@/components/ExploreMapView';

// Mirrors the emoji/label lookups in map/index.tsx and ExploreMapView.tsx's
// injected Leaflet template — kept in sync manually since those live in
// different files (one plain TS, one an HTML template string).
const CATEGORY_META: Record<PoiCategory, { emoji: string; label: string }> = {
  waterfall: { emoji: '💧', label: 'Waterfall' },
  viewpoint: { emoji: '🌄', label: 'Viewpoint' },
  peak: { emoji: '⛰️', label: 'Peak' },
  campsite: { emoji: '⛺', label: 'Campsite' },
  temple: { emoji: '🛕', label: 'Temple' },
  other: { emoji: '📍', label: 'Other' },
};

interface FormErrors {
  name?: string;
  category?: string;
  location?: string;
}

export default function SubmitPoiScreen() {
  const { user } = useAuthStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PoiCategory | null>(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);

  const [locQuery, setLocQuery] = useState('');
  const [locSuggestions, setLocSuggestions] = useState<GeocodeResult[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setGpsLat(loc.coords.latitude);
          setGpsLng(loc.coords.longitude);
        }
      } catch (_) {}
    })();
  }, []);

  const handleLocSearch = (text: string) => {
    setLocQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) { setLocSuggestions([]); return; }
    setLocSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setLocSuggestions(results);
      setLocSearching(false);
    }, 500);
  };

  const selectSuggestion = (place: GeocodeResult) => {
    setLocation({ lat: place.center[1], lng: place.center[0], label: place.place_name });
    setLocQuery('');
    setLocSuggestions([]);
    setErrors((e) => ({ ...e, location: undefined }));
  };

  const useMyLocation = () => {
    if (gpsLat == null || gpsLng == null) {
      Alert.alert('Location unavailable', 'Could not get your current location. Try searching or dropping a pin on the map instead.');
      return;
    }
    setLocation({ lat: gpsLat, lng: gpsLng, label: 'My current location' });
    setErrors((e) => ({ ...e, location: undefined }));
  };

  const openPicker = () => setPickerVisible(true);

  const onConfirmPicker = (loc: PickedLocation) => {
    setLocation({ lat: loc.lat, lng: loc.lng });
    setPickerVisible(false);
    setErrors((e) => ({ ...e, location: undefined }));
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to attach a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory(null);
    setDescription('');
    setPhotoUri(null);
    setLocation(null);
    setErrors({});
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required.';
    if (!category) newErrors.category = 'Pick a category.';
    if (!location) newErrors.location = 'Choose a location — search, use your GPS, or drop a pin.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (photoUri) {
        const path = `${user?.id}/${Date.now()}.jpg`;
        imageUrl = await uploadImage('poi-photos', path, photoUri);
        if (!imageUrl) {
          Alert.alert('Upload Error', 'Failed to upload your photo. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from('pois').insert({
        name: name.trim(),
        category,
        description: description.trim() || null,
        lat: location!.lat,
        lng: location!.lng,
        images: imageUrl ? [imageUrl] : [],
        submitted_by: user?.id,
        source: 'user',
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.confirmWrap}>
          <View style={styles.confirmIcon}>
            <Ionicons name="checkmark-circle" size={72} color="#8CC63F" />
          </View>
          <Text style={styles.confirmTitle}>Submitted for review</Text>
          <Text style={styles.confirmBody}>
            Thanks! "{name}" won't appear on the public map yet — an admin needs to
            review and approve it first. We'll notify you once it's live.
          </Text>
          <TouchableOpacity style={styles.confirmPrimaryBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Text style={styles.confirmPrimaryText}>Back to Explore Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmSecondaryBtn} onPress={resetForm}>
            <Text style={styles.confirmSecondaryText}>Submit Another Place</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add a Place</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.helperText}>
            Help other trekkers discover waterfalls, viewpoints, peaks, campsites and
            other places not already on the map. Submissions are reviewed by an admin
            before they go public.
          </Text>

          {/* Name */}
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kune Falls"
            placeholderTextColor="#6B7280"
            value={name}
            onChangeText={(t) => { setName(t); if (t.trim()) setErrors((e) => ({ ...e, name: undefined })); }}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {POI_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setCategory(cat); setErrors((e) => ({ ...e, category: undefined })); }}
                >
                  <Text style={styles.chipEmoji}>{meta.emoji}</Text>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

          {/* Description */}
          <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What makes this place worth visiting? Any tips for getting there?"
            placeholderTextColor="#6B7280"
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* Photo */}
          <Text style={styles.label}>Photo <Text style={styles.optional}>(optional)</Text></Text>
          {photoUri ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
              <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotoUri(null)}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoPicker} onPress={pickPhoto}>
              <Ionicons name="camera-outline" size={22} color="#8CC63F" />
              <Text style={styles.photoPickerText}>Add a photo</Text>
            </TouchableOpacity>
          )}

          {/* Location */}
          <Text style={styles.label}>Location</Text>

          <View style={styles.locSearchRow}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.locSearchInput}
              placeholder="Search for a place..."
              placeholderTextColor="#6B7280"
              value={locQuery}
              onChangeText={handleLocSearch}
            />
            {locSearching && <ActivityIndicator size="small" color="#8CC63F" />}
          </View>

          {locSuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {locSuggestions.map((s) => (
                <TouchableOpacity key={s.id} style={styles.suggestionRow} onPress={() => selectSuggestion(s)}>
                  <Ionicons name="location-outline" size={16} color="#8CC63F" />
                  <Text style={styles.suggestionText} numberOfLines={2}>{s.place_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.locActionsRow}>
            <TouchableOpacity style={styles.locActionBtn} onPress={useMyLocation}>
              <Ionicons name="navigate-outline" size={16} color="#8CC63F" />
              <Text style={styles.locActionText}>Use My Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.locActionBtn} onPress={openPicker}>
              <Ionicons name="map-outline" size={16} color="#8CC63F" />
              <Text style={styles.locActionText}>{location ? 'Adjust Pin' : 'Drop a Pin'}</Text>
            </TouchableOpacity>
          </View>

          {location && (
            <View style={styles.locSummary}>
              <Ionicons name="location" size={16} color="#8CC63F" />
              <Text style={styles.locSummaryText}>
                {location.label ? `${location.label}\n` : ''}{location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </Text>
            </View>
          )}
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#080C14" />
            ) : (
              <Text style={styles.submitBtnText}>Submit for Review</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <MapPickerModal
        visible={pickerVisible}
        initialLat={location?.lat ?? gpsLat ?? undefined}
        initialLng={location?.lng ?? gpsLng ?? undefined}
        onConfirm={onConfirmPicker}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  content: { flex: 1, paddingHorizontal: 20 },
  helperText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19, marginTop: 16, marginBottom: 20 },

  label: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  optional: { color: 'rgba(255,255,255,0.4)', fontWeight: '400', fontSize: 12 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#FFF', fontSize: 15, marginBottom: 4,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },

  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4, marginBottom: 8 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: 'rgba(140,198,63,0.15)', borderColor: '#8CC63F' },
  chipEmoji: { fontSize: 14 },
  chipLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  chipLabelActive: { color: '#8CC63F' },

  photoPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    paddingVertical: 16, borderRadius: 14, marginBottom: 16,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#8CC63F',
    backgroundColor: 'rgba(140,198,63,0.05)',
  },
  photoPickerText: { color: '#8CC63F', fontWeight: '700', fontSize: 14 },
  photoWrap: { position: 'relative', marginBottom: 16, borderRadius: 14, overflow: 'hidden' },
  photoPreview: { width: '100%', height: 180, backgroundColor: '#000' },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12 },

  locSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, paddingVertical: 4,
  },
  locSearchInput: { flex: 1, color: '#FFF', fontSize: 14, paddingVertical: 10 },

  suggestionsBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginTop: 6, overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  suggestionText: { color: '#FFF', fontSize: 13, flex: 1 },

  locActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  locActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(140,198,63,0.1)', borderWidth: 1, borderColor: '#8CC63F',
    paddingVertical: 12, borderRadius: 14,
  },
  locActionText: { color: '#8CC63F', fontSize: 13, fontWeight: '700' },

  locSummary: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
  },
  locSummaryText: { color: '#8CC63F', fontSize: 13, fontWeight: '600', flex: 1 },

  submitBtn: {
    backgroundColor: '#8CC63F', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 24,
  },
  submitBtnText: { color: '#080C14', fontSize: 16, fontWeight: '800' },

  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  confirmIcon: { marginBottom: 20 },
  confirmTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  confirmBody: { color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 32 },
  confirmPrimaryBtn: {
    backgroundColor: '#8CC63F', borderRadius: 16, paddingVertical: 15,
    paddingHorizontal: 32, alignItems: 'center', width: '100%', marginBottom: 12,
  },
  confirmPrimaryText: { color: '#080C14', fontSize: 15, fontWeight: '800' },
  confirmSecondaryBtn: { paddingVertical: 10, alignItems: 'center', width: '100%' },
  confirmSecondaryText: { color: '#8CC63F', fontSize: 14, fontWeight: '700' },
});
