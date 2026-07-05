import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import MapPickerModal from '@/components/MapPickerModal';
import PhoneInput from '@/components/PhoneInput';

const GREEN = '#8CC63F';
const BG = '#080C14';

// ─── Constants ───────────────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  { id: 'wildlife', label: 'Wildlife Safari', emoji: '🦁' },
  { id: 'cultural', label: 'Cultural Tour', emoji: '🏛️' },
  { id: 'rock_climbing', label: 'Rock Climbing', emoji: '🧗' },
  { id: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { id: 'trekking', label: 'Trekking', emoji: '🥾' },
  { id: 'river_rafting', label: 'River Rafting', emoji: '🌊' },
  { id: 'mountain_climbing', label: 'Mountain Climbing', emoji: '⛰️' },
  { id: 'bird_watching', label: 'Bird Watching', emoji: '🦅' },
  { id: 'photography', label: 'Photography Tour', emoji: '📷' },
  { id: 'heritage_walk', label: 'Heritage Walk', emoji: '🕌' },
  { id: 'camping', label: 'Camping', emoji: '⛺' },
  { id: 'offroad', label: 'Off-road Adventure', emoji: '🚙' },
  { id: 'waterfall_trek', label: 'Waterfall Trek', emoji: '💧' },
  { id: 'night_trek', label: 'Night Trek', emoji: '🌙' },
  { id: 'corporate', label: 'Corporate Outing', emoji: '🏢' },
];

const CERT_REQUIRED_SPECS: Record<string, string> = {
  wildlife: 'Wildlife Guide Certificate',
  rock_climbing: 'Rock Climbing Certificate',
  mountain_climbing: 'IMF/NIMAS Certificate',
  river_rafting: 'River Rafting Safety Certificate',
};

const EXPERIENCE_OPTIONS = [
  'Less than 1 year', '1-2 years', '3-5 years', '5-10 years', '10+ years',
];

const LANGUAGES = [
  'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Hindi',
  'English', 'Marathi', 'Bengali', 'Gujarati',
];

const ID_DOC_TYPES = [
  { id: 'aadhaar', label: 'Aadhaar Card' },
  { id: 'voter_id', label: 'Voter ID' },
  { id: 'driving_licence', label: 'Driving Licence' },
];

const RADIUS_OPTIONS = [10, 25, 50, 100, 150, 200];

// ─── Types ───────────────────────────────────────────────────────────────────

type LocEntry = {
  name: string;
  lat: number;
  lng: number;
  radius_km: number;
  rate_per_day: number;
};

type CertEntry = {
  name: string;
  authority: string;
  url: string | null;
  localUri: string | null;
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function GuideRegisterScreen() {
  const { user } = useAuthStore();

  // Profile photo
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Basic
  const [fullName, setFullName] = useState('');

  // Locations
  const [locations, setLocations] = useState<LocEntry[]>([]);
  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLocIdx, setEditingLocIdx] = useState<number | null>(null);
  // Location editor state
  const [locName, setLocName] = useState('');
  const [locCoords, setLocCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locRadius, setLocRadius] = useState(50);
  const [locRate, setLocRate] = useState('');
  const [locSuggestions, setLocSuggestions] = useState<GeocodeResult[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const locSearchTimeout = useRef<any>(null);

  // Specializations
  const [specializations, setSpecializations] = useState<string[]>([]);

  // Experience
  const [experience, setExperience] = useState('');

  // Languages
  const [languages, setLanguages] = useState<string[]>(['Hindi', 'English']);
  const [customLang, setCustomLang] = useState('');

  // About
  const [about, setAbout] = useState('');

  // Identity document
  const [idDocType, setIdDocType] = useState<string>('');
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [idUploading, setIdUploading] = useState<'front' | 'back' | null>(null);

  // Certificates
  const [certificates, setCertificates] = useState<CertEntry[]>([]);
  const [certUploading, setCertUploading] = useState<number | null>(null);

  // Contact
  const [contactPhone, setContactPhone] = useState('');
  const [contactCountryCode, setContactCountryCode] = useState('+91');

  // Terms
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAccuracy, setAgreeAccuracy] = useState(false);
  const [agreeResponse, setAgreeResponse] = useState(false);

  const [loading, setLoading] = useState(false);

  // ─── Profile Photo ────────────────────────────────────────────────────────

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to upload your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setProfilePhotoUri(uri);
      uploadProfilePhoto(uri);
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    setPhotoUploading(true);
    try {
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user?.id}/profile_${Date.now()}.${ext}`;
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const { error } = await supabase.storage.from('guide-photos').upload(path, blob, {
        contentType: `image/${ext}`,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('guide-photos').getPublicUrl(path);
      setProfilePhotoUrl(data.publicUrl);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload photo');
      setProfilePhotoUri(null);
    } finally {
      setPhotoUploading(false);
    }
  };

  // ─── Location Search ──────────────────────────────────────────────────────

  const handleLocSearch = (text: string) => {
    setLocName(text);
    setLocCoords(null);
    if (locSearchTimeout.current) clearTimeout(locSearchTimeout.current);
    if (text.length < 3) { setLocSuggestions([]); return; }
    setLocSearching(true);
    locSearchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setLocSuggestions(results);
      setLocSearching(false);
    }, 500);
  };

  const selectLocSuggestion = (place: GeocodeResult) => {
    setLocName(place.place_name);
    setLocCoords({ lat: place.center[1], lng: place.center[0] });
    setLocSuggestions([]);
  };

  const openAddLocation = () => {
    setEditingLocIdx(null);
    setLocName(''); setLocCoords(null); setLocRadius(50); setLocRate('');
    setLocSuggestions([]);
    setShowLocModal(true);
  };

  const openEditLocation = (idx: number) => {
    const loc = locations[idx];
    setEditingLocIdx(idx);
    setLocName(loc.name);
    setLocCoords({ lat: loc.lat, lng: loc.lng });
    setLocRadius(loc.radius_km);
    setLocRate(String(loc.rate_per_day));
    setLocSuggestions([]);
    setShowLocModal(true);
  };

  const saveLocation = () => {
    if (!locName.trim()) { Alert.alert('Required', 'Enter a location name.'); return; }
    if (!locCoords) { Alert.alert('Required', 'Select a location from suggestions or drop a pin on the map.'); return; }
    if (!locRate.trim() || isNaN(Number(locRate))) { Alert.alert('Required', 'Enter a valid rate per day.'); return; }

    const entry: LocEntry = {
      name: locName.trim(),
      lat: locCoords.lat,
      lng: locCoords.lng,
      radius_km: locRadius,
      rate_per_day: parseFloat(locRate),
    };

    if (editingLocIdx !== null) {
      setLocations(prev => prev.map((l, i) => i === editingLocIdx ? entry : l));
    } else {
      setLocations(prev => [...prev, entry]);
    }
    setShowLocModal(false);
  };

  const removeLocation = (idx: number) => {
    setLocations(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Specializations ──────────────────────────────────────────────────────

  const toggleSpec = useCallback((id: string) => {
    setSpecializations(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  // ─── Languages ────────────────────────────────────────────────────────────

  const toggleLang = useCallback((lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  }, []);

  const addCustomLang = () => {
    const lang = customLang.trim();
    if (!lang) return;
    if (!languages.includes(lang)) setLanguages(prev => [...prev, lang]);
    setCustomLang('');
  };

  // ─── ID Document Upload ───────────────────────────────────────────────────

  const pickDocPhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (side === 'front') setIdFrontUri(uri);
      else setIdBackUri(uri);
      await uploadDocPhoto(uri, side);
    }
  };

  const uploadDocPhoto = async (uri: string, side: 'front' | 'back') => {
    setIdUploading(side);
    try {
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user?.id}/id_${side}_${Date.now()}.${ext}`;
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const { error } = await supabase.storage.from('guide-documents').upload(path, blob, {
        contentType: `image/${ext}`, upsert: true,
      });
      if (error) throw error;
      const { data } = await supabase.storage.from('guide-documents').createSignedUrl(path, 7200);
      if (side === 'front') setIdFrontUrl(data?.signedUrl || null);
      else setIdBackUrl(data?.signedUrl || null);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload document');
      if (side === 'front') setIdFrontUri(null);
      else setIdBackUri(null);
    } finally {
      setIdUploading(null);
    }
  };

  // ─── Certificates ─────────────────────────────────────────────────────────

  const certNeeded = specializations.filter(s => CERT_REQUIRED_SPECS[s]);

  const addCertificate = () => {
    setCertificates(prev => [...prev, { name: '', authority: '', url: null, localUri: null }]);
  };

  const updateCert = (idx: number, field: keyof CertEntry, value: string) => {
    setCertificates(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeCert = (idx: number) => {
    setCertificates(prev => prev.filter((_, i) => i !== idx));
  };

  const pickCertPhoto = async (idx: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setCertificates(prev => prev.map((c, i) => i === idx ? { ...c, localUri: uri } : c));
      setCertUploading(idx);
      try {
        const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user?.id}/cert_${idx}_${Date.now()}.${ext}`;
        const resp = await fetch(uri);
        const blob = await resp.blob();
        const { error } = await supabase.storage.from('guide-documents').upload(path, blob, {
          contentType: `image/${ext}`, upsert: true,
        });
        if (error) throw error;
        const { data } = await supabase.storage.from('guide-documents').createSignedUrl(path, 7200);
        setCertificates(prev => prev.map((c, i) => i === idx ? { ...c, url: data?.signedUrl || null } : c));
      } catch (e: any) {
        Alert.alert('Upload Error', e.message);
        setCertificates(prev => prev.map((c, i) => i === idx ? { ...c, localUri: null } : c));
      } finally {
        setCertUploading(null);
      }
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!profilePhotoUri) { Alert.alert('Required', 'Please add a profile photo.'); return; }
    if (photoUploading) { Alert.alert('Please wait', 'Profile photo is still uploading.'); return; }
    if (!fullName.trim()) { Alert.alert('Required', 'Enter your full name.'); return; }
    if (locations.length === 0) { Alert.alert('Required', 'Add at least one operating location.'); return; }
    if (specializations.length === 0) { Alert.alert('Required', 'Select at least one specialization.'); return; }
    if (!experience) { Alert.alert('Required', 'Select your experience level.'); return; }
    if (languages.length === 0) { Alert.alert('Required', 'Select at least one language.'); return; }
    if (about.trim().length < 100) { Alert.alert('Required', 'About section must be at least 100 characters.'); return; }
    if (!idDocType) { Alert.alert('Required', 'Select an identity document type.'); return; }
    if (!idFrontUri) { Alert.alert('Required', 'Upload the front of your identity document.'); return; }
    if (!idBackUri) { Alert.alert('Required', 'Upload the back of your identity document.'); return; }
    if (idUploading) { Alert.alert('Please wait', 'Document is still uploading.'); return; }
    if (!contactPhone.trim()) { Alert.alert('Required', 'Enter a contact number.'); return; }
    if (!agreeTerms || !agreeAccuracy || !agreeResponse) { Alert.alert('Required', 'Please accept all three agreements to continue.'); return; }

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('guides')
        .select('id, status')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (existing) {
        Alert.alert(
          'Application Exists',
          existing.status === 'pending'
            ? 'Your guide application is already under review.'
            : `Your guide status is: ${existing.status}`,
          [{ text: 'View Status', onPress: () => router.replace('/guide/application-status' as any) }]
        );
        return;
      }

      const primaryLoc = locations[0];
      const certPayload = certificates.map(({ name, authority, url }) => ({ name, authority, url }));

      const { error } = await supabase.from('guides').insert({
        user_id: user?.id,
        // New schema fields
        full_name: fullName.trim(),
        profile_photo_url: profilePhotoUrl,
        locations: locations,
        about: about.trim(),
        experience: experience,
        identity_doc_type: idDocType,
        identity_doc_front_url: idFrontUrl,
        identity_doc_back_url: idBackUrl,
        certificates: certPayload,
        contact_phone: `${contactCountryCode}${contactPhone.trim()}`,
        // Legacy fields for backward compatibility
        name: fullName.trim(),
        photo_url: profilePhotoUrl,
        location: primaryLoc.name,
        lat: primaryLoc.lat,
        lng: primaryLoc.lng,
        rate_per_day: primaryLoc.rate_per_day,
        bio: about.trim(),
        specializations,
        languages,
        certifications: certPayload.map(c => c.name),
        status: 'pending',
        is_premium: false,
      });

      if (error) throw error;

      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'New Guide Application',
            message: `${fullName.trim()} has applied to become a certified guide.`,
            type: 'system',
          }))
        );
      }

      router.replace('/guide/application-status' as any);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const showCertSection = certNeeded.length > 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Become a Guide</Text>
          <Text style={s.headerSub}>Apply to guide trekkers on TrekRiderz</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {/* Info Banner */}
          <View style={s.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color={GREEN} />
            <Text style={s.infoText}>
              Verified guides earn a TrekRiderz badge and can host paid expeditions. Applications are reviewed within 2-3 business days.
            </Text>
          </View>

          {/* 1. Profile Photo */}
          <SectionLabel>Profile Photo *</SectionLabel>
          <View style={s.photoPickerRow}>
            <TouchableOpacity style={s.photoCircle} onPress={pickProfilePhoto} activeOpacity={0.8}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={s.photoImg} contentFit="cover" />
              ) : (
                <View style={s.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={28} color={GREEN} />
                  <Text style={s.photoPlaceholderText}>Add Photo</Text>
                </View>
              )}
              {photoUploading && (
                <View style={s.photoOverlay}>
                  <ActivityIndicator color={GREEN} />
                </View>
              )}
              {profilePhotoUrl && !photoUploading && (
                <View style={s.photoDone}>
                  <Ionicons name="checkmark" size={12} color="#000" />
                </View>
              )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.photoHint}>Tap to upload from gallery</Text>
              <Text style={s.photoSubHint}>Use a clear, professional photo</Text>
            </View>
          </View>

          {/* 2. Full Name */}
          <SectionLabel>Full Name *</SectionLabel>
          <TextInput
            style={s.input}
            placeholder="As it appears on your ID"
            placeholderTextColor="#555"
            value={fullName}
            onChangeText={setFullName}
          />

          {/* 3. Operating Locations */}
          <SectionLabel>Operating Locations * (min 1)</SectionLabel>
          {locations.map((loc, idx) => (
            <View key={idx} style={s.locCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.locName} numberOfLines={1}>{loc.name}</Text>
                <Text style={s.locMeta}>
                  {loc.radius_km}km radius · ₹{loc.rate_per_day.toLocaleString('en-IN')}/day
                </Text>
              </View>
              <TouchableOpacity style={s.locEdit} onPress={() => openEditLocation(idx)}>
                <Ionicons name="pencil-outline" size={16} color={GREEN} />
              </TouchableOpacity>
              <TouchableOpacity style={s.locRemove} onPress={() => removeLocation(idx)}>
                <Ionicons name="close" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={s.addLocBtn} onPress={openAddLocation} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={GREEN} />
            <Text style={s.addLocText}>Add Location</Text>
          </TouchableOpacity>

          {/* 4. Specializations */}
          <SectionLabel>
            {'Specializations *' + (specializations.length > 0 ? ` (${specializations.length} selected)` : ' — pick all that apply')}
          </SectionLabel>
          <View style={s.chipGrid}>
            {SPECIALIZATIONS.map((spec) => {
              const active = specializations.includes(spec.id);
              return (
                <Pressable
                  key={spec.id}
                  style={[s.specChip, active && s.specChipActive]}
                  onPress={() => toggleSpec(spec.id)}
                >
                  <Text style={s.specEmoji}>{spec.emoji}</Text>
                  <Text style={[s.specLabel, active && s.specLabelActive]}>{spec.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={13} color="#000" />}
                </Pressable>
              );
            })}
          </View>

          {/* 5. Experience */}
          <SectionLabel>Experience Level *</SectionLabel>
          <View style={s.chipGrid}>
            {EXPERIENCE_OPTIONS.map((opt) => {
              const active = experience === opt;
              return (
                <Pressable
                  key={opt}
                  style={[s.expChip, active && s.expChipActive]}
                  onPress={() => setExperience(opt)}
                >
                  <Text style={[s.expLabel, active && s.expLabelActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* 6. Languages */}
          <SectionLabel>Languages Spoken *</SectionLabel>
          <View style={s.chipGrid}>
            {[...LANGUAGES, ...languages.filter(l => !LANGUAGES.includes(l))].map((lang) => {
              const sel = languages.includes(lang);
              return (
                <Pressable
                  key={lang}
                  style={[s.langChip, sel && s.langChipActive]}
                  onPress={() => toggleLang(lang)}
                >
                  <Text style={[s.langLabel, sel && s.langLabelActive]}>{lang}</Text>
                  {sel && !LANGUAGES.includes(lang) && (
                    <Ionicons name="close" size={12} color="#000" style={{ marginLeft: 4 }} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <View style={s.customLangRow}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Add another language..."
              placeholderTextColor="#555"
              value={customLang}
              onChangeText={setCustomLang}
              onSubmitEditing={addCustomLang}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addLangBtn} onPress={addCustomLang}>
              <Ionicons name="add" size={20} color={GREEN} />
            </TouchableOpacity>
          </View>

          {/* 7. About You */}
          <SectionLabel>About You *</SectionLabel>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="Tell trekkers about your experience, areas you know best, your guiding style..."
            placeholderTextColor="#555"
            value={about}
            onChangeText={setAbout}
            multiline
            textAlignVertical="top"
          />
          <Text style={[s.charCount, about.length >= 100 && s.charCountOk]}>
            {about.length}/100 min characters
          </Text>

          {/* 8. Identity Document */}
          <SectionLabel>Identity Document *</SectionLabel>
          <View style={s.idTypeRow}>
            {ID_DOC_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt.id}
                style={[s.idTypeBtn, idDocType === dt.id && s.idTypeBtnActive]}
                onPress={() => setIdDocType(dt.id)}
                activeOpacity={0.8}
              >
                <Text style={[s.idTypeLabel, idDocType === dt.id && s.idTypeLabelActive]}>{dt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {idDocType !== '' && (
            <View style={s.docPhotoRow}>
              <DocPhotoBox
                label="Front"
                localUri={idFrontUri}
                uploading={idUploading === 'front'}
                done={!!idFrontUrl}
                onPick={() => pickDocPhoto('front')}
                onRemove={() => { setIdFrontUri(null); setIdFrontUrl(null); }}
              />
              <DocPhotoBox
                label="Back"
                localUri={idBackUri}
                uploading={idUploading === 'back'}
                done={!!idBackUrl}
                onPick={() => pickDocPhoto('back')}
                onRemove={() => { setIdBackUri(null); setIdBackUrl(null); }}
              />
            </View>
          )}

          {/* 9. Certificates (conditional) */}
          {showCertSection && (
            <>
              <SectionLabel>Professional Certificates *</SectionLabel>
              <View style={s.certBanner}>
                <Ionicons name="ribbon-outline" size={16} color="#FBBF24" />
                <Text style={s.certBannerText}>
                  Your selected specializations require certification:{' '}
                  {certNeeded.map(s => CERT_REQUIRED_SPECS[s]).join(', ')}
                </Text>
              </View>
              {certificates.map((cert, idx) => (
                <View key={idx} style={s.certCard}>
                  <View style={s.certCardHeader}>
                    <Text style={s.certCardTitle}>Certificate {idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeCert(idx)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[s.input, s.certInput]}
                    placeholder="Certificate name"
                    placeholderTextColor="#555"
                    value={cert.name}
                    onChangeText={v => updateCert(idx, 'name', v)}
                  />
                  <TextInput
                    style={[s.input, s.certInput]}
                    placeholder="Issuing authority"
                    placeholderTextColor="#555"
                    value={cert.authority}
                    onChangeText={v => updateCert(idx, 'authority', v)}
                  />
                  <DocPhotoBox
                    label="Certificate Photo"
                    localUri={cert.localUri}
                    uploading={certUploading === idx}
                    done={!!cert.url}
                    onPick={() => pickCertPhoto(idx)}
                    onRemove={() => setCertificates(prev => prev.map((c, i) => i === idx ? { ...c, localUri: null, url: null } : c))}
                  />
                </View>
              ))}
              <TouchableOpacity style={s.addLocBtn} onPress={addCertificate} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={18} color={GREEN} />
                <Text style={s.addLocText}>Add Certificate</Text>
              </TouchableOpacity>
            </>
          )}

          {/* 10. Contact Number */}
          <SectionLabel>Contact Number *</SectionLabel>
          <Text style={s.contactNote}>For TrekRiderz team use only — not shown publicly</Text>
          <PhoneInput
            countryCode={contactCountryCode}
            onChangeCountryCode={setContactCountryCode}
            number={contactPhone}
            onChangeNumber={setContactPhone}
            placeholder="Mobile number"
          />

          {/* 11. Terms & Commission */}
          <SectionLabel>Terms & Commission *</SectionLabel>
          <ScrollView style={s.termsBox} nestedScrollEnabled>
            <Text style={s.termsTitle}>TREKRIDERZ GUIDE AGREEMENT</Text>
            <Text style={s.termsHeading}>COMMISSION & PAYMENTS</Text>
            <Text style={s.termsBody}>
              TrekRiderz charges a 20% service commission on each confirmed booking. Guides have a higher commission than hosts since TrekRiderz handles all marketing, insurance coordination, customer support, and payment processing.{'\n\n'}
              Payment will be transferred within 3-5 business days after the trek concludes, after deducting the 20% commission.
            </Text>
            <Text style={s.termsHeading}>BOOKING MANAGEMENT</Text>
            <Text style={s.termsBody}>
              All bookings are managed through TrekRiderz. You must respond to booking requests within 24 hours. Repeated non-responses may result in profile suspension.
            </Text>
            <Text style={s.termsHeading}>QUALITY & SAFETY STANDARDS</Text>
            <Text style={s.termsBody}>
              TrekRiderz reserves the right to conduct quality and safety reviews and remove guide profiles that don't meet platform standards or receive consistently poor feedback.
            </Text>
            <Text style={s.termsHeading}>TERMINATION POLICY</Text>
            <Text style={s.termsBody}>
              Either party may terminate this agreement with 30 days written notice. TrekRiderz may immediately terminate profiles for fraud, safety violations, repeated policy breaches, or legal violations.
            </Text>
            <Text style={[s.termsBody, { marginTop: 8 }]}>
              By accepting, you confirm that you have the right to offer these services, all information provided is accurate, and you accept the 20% commission structure.
            </Text>
          </ScrollView>

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAgreeTerms(!agreeTerms)} activeOpacity={0.8}>
            <View style={[s.checkbox, agreeTerms && s.checkboxChecked]}>
              {agreeTerms && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
            <Text style={s.checkboxLabel}>I have read and agree to the TrekRiderz Guide Agreement and Commission Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.checkboxRow} onPress={() => setAgreeAccuracy(!agreeAccuracy)} activeOpacity={0.8}>
            <View style={[s.checkbox, agreeAccuracy && s.checkboxChecked]}>
              {agreeAccuracy && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
            <Text style={s.checkboxLabel}>I confirm that all information provided is accurate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.checkboxRow} onPress={() => setAgreeResponse(!agreeResponse)} activeOpacity={0.8}>
            <View style={[s.checkbox, agreeResponse && s.checkboxChecked]}>
              {agreeResponse && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
            <Text style={s.checkboxLabel}>I agree to respond to booking requests within 24 hours</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitBtn, (loading || !agreeTerms || !agreeAccuracy || !agreeResponse) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading || !agreeTerms || !agreeAccuracy || !agreeResponse}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="ribbon-outline" size={20} color="#000" />
                <Text style={s.submitBtnText}>SUBMIT APPLICATION</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Editor Modal */}
      <Modal visible={showLocModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <SafeAreaView style={s.modalSheet} edges={['bottom']}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingLocIdx !== null ? 'Edit Location' : 'Add Location'}</Text>
              <TouchableOpacity onPress={() => setShowLocModal(false)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
              <Text style={s.label}>Location Name *</Text>
              <View style={s.searchBox}>
                <Ionicons name="location-outline" size={16} color={GREEN} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search city, district or area..."
                  placeholderTextColor="#555"
                  value={locName}
                  onChangeText={handleLocSearch}
                />
                {locSearching && <ActivityIndicator size="small" color={GREEN} />}
              </View>
              {locSuggestions.length > 0 && (
                <View style={s.suggestions}>
                  {locSuggestions.map((sg, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.suggItem, i < locSuggestions.length - 1 && s.suggBorder]}
                      onPress={() => selectLocSuggestion(sg)}
                    >
                      <Ionicons name="location-outline" size={13} color={GREEN} />
                      <Text style={s.suggText} numberOfLines={2}>{sg.place_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {locCoords && (
                <TouchableOpacity style={s.mapPinBtn} onPress={() => setShowMapPicker(true)}>
                  <Ionicons name="map-outline" size={14} color={GREEN} />
                  <Text style={s.mapPinText}>
                    Pin: {locCoords.lat.toFixed(4)}, {locCoords.lng.toFixed(4)} — tap to adjust
                  </Text>
                </TouchableOpacity>
              )}
              {!locCoords && !locSearching && locName.length > 2 && (
                <TouchableOpacity style={s.mapPinBtn} onPress={() => setShowMapPicker(true)}>
                  <Ionicons name="pin-outline" size={14} color={GREEN} />
                  <Text style={s.mapPinText}>Drop pin on map manually</Text>
                </TouchableOpacity>
              )}

              <Text style={[s.label, { marginTop: 16 }]}>Service Radius</Text>
              <View style={s.radiusRow}>
                {RADIUS_OPTIONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[s.radiusBtn, locRadius === r && s.radiusBtnActive]}
                    onPress={() => setLocRadius(r)}
                  >
                    <Text style={[s.radiusBtnText, locRadius === r && s.radiusBtnTextActive]}>{r}km</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.label, { marginTop: 16 }]}>Rate Per Day (₹) *</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. 2000"
                placeholderTextColor="#555"
                value={locRate}
                onChangeText={setLocRate}
                keyboardType="numeric"
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancel} onPress={() => setShowLocModal(false)}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSave} onPress={saveLocation}>
                  <Text style={s.modalSaveText}>
                    {editingLocIdx !== null ? 'Save Changes' : 'Add Location'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <MapPickerModal
        visible={showMapPicker}
        initialLat={locCoords?.lat}
        initialLng={locCoords?.lng}
        onConfirm={(loc) => {
          setLocCoords({ lat: loc.lat, lng: loc.lng });
          setShowMapPicker(false);
        }}
        onClose={() => setShowMapPicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{String(children)}</Text>;
}

function DocPhotoBox({
  label, localUri, uploading, done, onPick, onRemove,
}: {
  label: string;
  localUri: string | null;
  uploading: boolean;
  done: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <TouchableOpacity style={s.docBox} onPress={localUri ? undefined : onPick} activeOpacity={0.8}>
      {localUri ? (
        <>
          <Image source={{ uri: localUri }} style={s.docThumb} contentFit="cover" />
          {uploading && (
            <View style={s.docOverlay}>
              <ActivityIndicator color={GREEN} />
            </View>
          )}
          {done && !uploading && (
            <View style={s.docDone}>
              <Ionicons name="checkmark" size={12} color="#000" />
            </View>
          )}
          {!uploading && (
            <TouchableOpacity style={s.docRemove} onPress={onRemove}>
              <Ionicons name="close" size={14} color="#FFF" />
            </TouchableOpacity>
          )}
          <Text style={s.docLabel}>{label}</Text>
        </>
      ) : (
        <>
          <Ionicons name="image-outline" size={26} color={GREEN} />
          <Text style={s.docLabel}>{label}</Text>
          <Text style={s.docUploadText}>Tap to upload</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
    marginBottom: 28,
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  label: {
    fontSize: 11, fontWeight: '700', color: GREEN,
    letterSpacing: 1.5, marginBottom: 10, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  textArea: { minHeight: 120, paddingTop: 13, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -16, marginBottom: 20, textAlign: 'right' },
  charCountOk: { color: GREEN },

  // Photo
  photoPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  photoCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(140,198,63,0.06)',
    borderWidth: 2, borderColor: 'rgba(140,198,63,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative',
  },
  photoImg: { width: 88, height: 88, borderRadius: 44 },
  photoPlaceholder: { alignItems: 'center', gap: 4 },
  photoPlaceholderText: { fontSize: 11, color: GREEN, fontWeight: '600' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoDone: {
    position: 'absolute', bottom: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  photoSubHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  // Locations
  locCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 10, gap: 8,
  },
  locName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  locMeta: { color: GREEN, fontSize: 12, marginTop: 2 },
  locEdit: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(140,198,63,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  locRemove: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  addLocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
    borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    justifyContent: 'center', marginBottom: 24,
  },
  addLocText: { color: GREEN, fontSize: 14, fontWeight: '700' },

  // Specializations
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  specChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  specChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  specEmoji: { fontSize: 15 },
  specLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  specLabelActive: { color: '#000' },

  // Experience
  expChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  expChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  expLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  expLabelActive: { color: '#000' },

  // Languages
  langChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  langChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  langLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  langLabelActive: { color: '#000' },
  customLangRow: { flexDirection: 'row', gap: 10, marginTop: -16, marginBottom: 24 },
  addLangBtn: {
    width: 48, backgroundColor: 'rgba(140,198,63,0.1)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ID doc
  idTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  idTypeBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  idTypeBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  idTypeLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  idTypeLabelActive: { color: '#000' },
  docPhotoRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  docBox: {
    flex: 1, aspectRatio: 1.4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative', gap: 4,
  },
  docThumb: { ...StyleSheet.absoluteFillObject },
  docOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  docDone: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  docRemove: {
    position: 'absolute', top: 6, left: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  docLabel: { fontSize: 11, fontWeight: '700', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  docUploadText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  // Certificates
  certBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    marginBottom: 16,
  },
  certBannerText: { flex: 1, fontSize: 12, color: '#FBBF24', lineHeight: 18 },
  certCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  certCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  certCardTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  certInput: { marginBottom: 10 },

  // Contact
  contactNote: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: -6, marginBottom: 10 },

  // Terms
  termsBox: {
    maxHeight: 240, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16,
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

  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN, borderRadius: 16,
    paddingVertical: 16, gap: 8, marginTop: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: 1 },

  // Location modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0F1520', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 13 },
  suggestions: {
    backgroundColor: '#141920', borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  suggItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  suggBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggText: { flex: 1, color: '#FFF', fontSize: 13 },
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  mapPinText: { fontSize: 12, color: GREEN, fontWeight: '600', flex: 1 },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  radiusBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  radiusBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  radiusBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  radiusBtnTextActive: { color: '#000' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  modalCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '700' },
  modalSave: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: GREEN, alignItems: 'center',
  },
  modalSaveText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
