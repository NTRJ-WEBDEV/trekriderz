import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import MapPickerModal from '@/components/MapPickerModal';

const SPECIALIZATIONS = [
  { id: 'high_altitude', label: 'High Altitude Trek', emoji: '⛰️' },
  { id: 'wildlife', label: 'Wildlife Safari', emoji: '🦁' },
  { id: 'river_rafting', label: 'River Rafting', emoji: '🌊' },
  { id: 'rock_climbing', label: 'Rock Climbing', emoji: '🧗' },
  { id: 'cultural', label: 'Cultural Tour', emoji: '🏛️' },
  { id: 'pilgrimage', label: 'Pilgrimage', emoji: '🛕' },
  { id: 'photography', label: 'Photography Tour', emoji: '📷' },
  { id: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { id: 'mountain_bike', label: 'Mountain Biking', emoji: '🚵' },
  { id: 'winter_trek', label: 'Winter Trek', emoji: '❄️' },
];

const LANGUAGES = ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi'];

export default function GuideRegisterScreen() {
  const { user } = useAuthStore();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [experience, setExperience] = useState('');
  const [ratePerDay, setRatePerDay] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['Hindi', 'English']);
  const [certifications, setCertifications] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const searchTimeout = useRef<any>(null);

  const handleLocationSearch = (text: string) => {
    setLocation(text);
    setCoords(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) { setSuggestions([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setSuggestions(results);
      setSearching(false);
    }, 500);
  };

  const selectLocation = (place: GeocodeResult) => {
    setLocation(place.place_name);
    setCoords(place.center);
    setSuggestions([]);
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const handleSubmit = async () => {
    if (!name || !location || specializations.length === 0 || !experience || !ratePerDay || !bio) {
      Alert.alert('Missing Fields', 'Please fill in all required fields and select at least one specialization.');
      return;
    }
    if (selectedLanguages.length === 0) {
      Alert.alert('Languages', 'Please select at least one language you speak.');
      return;
    }

    setLoading(true);
    try {
      // Check if already applied
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
        );
        return;
      }

      const { error } = await supabase.from('guides').insert({
        user_id: user?.id,
        name: name.trim(),
        location: location.trim(),
        lat: coords ? coords[1] : null,
        lng: coords ? coords[0] : null,
        specializations: specializations,
        experience_years: parseInt(experience),
        rate_per_day: parseFloat(ratePerDay),
        languages: selectedLanguages,
        certifications: certifications.trim()
          ? certifications.split(',').map((c) => c.trim()).filter(Boolean)
          : [],
        bio: bio.trim(),
        status: 'pending',
        is_premium: false,
        rating: null,
      });

      if (error) throw error;

      // Notify admins
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'New Guide Application',
            message: `${name} has applied to become a certified guide.`,
            type: 'system',
          }))
        );
      }

      // Update user role to guide
      await supabase.from('users').update({ role: 'guide' }).eq('id', user?.id);

      Alert.alert(
        'Application Submitted! 🧭',
        'Our team will verify your credentials and approve your guide profile within 3–5 business days.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Become a Guide</Text>
          <Text style={styles.headerSub}>Apply to guide trekkers on TrekRiderz</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#8CC63F" />
          <Text style={styles.infoText}>
            Verified guides earn a TrekRiderz badge and can list paid expeditions. Applications are reviewed within 3–5 days.
          </Text>
        </View>

        <Field label="Full Name *">
          <TextInput
            style={styles.input}
            placeholder="As it appears on your ID"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Operating Location *">
          <View style={styles.searchBox}>
            <Ionicons name="location-outline" size={16} color="#8CC63F" />
            <TextInput
              style={styles.searchInput}
              placeholder="Where do you primarily guide?"
              placeholderTextColor="#555"
              value={location}
              onChangeText={handleLocationSearch}
            />
            {searching && <ActivityIndicator size="small" color="#8CC63F" />}
          </View>
          {coords && (
            <TouchableOpacity style={styles.mapPinBtn} onPress={() => setShowMap(true)}>
              <Ionicons name="map-outline" size={14} color="#8CC63F" />
              <Text style={styles.mapPinText}>
                Pin marked: {coords[1].toFixed(4)}, {coords[0].toFixed(4)} — tap to adjust
              </Text>
            </TouchableOpacity>
          )}
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggBorder]}
                  onPress={() => selectLocation(s)}
                >
                  <Ionicons name="location-outline" size={13} color="#8CC63F" />
                  <Text style={styles.suggText} numberOfLines={2}>{s.place_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Field>

        <Field label={`Specializations * ${specializations.length > 0 ? `(${specializations.length} selected)` : '— pick all that apply'}`}>
          <View style={styles.chipGrid}>
            {SPECIALIZATIONS.map((s) => {
              const active = specializations.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.specChip, active && styles.specChipActive]}
                  onPress={() =>
                    setSpecializations((prev) =>
                      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.specEmoji}>{s.emoji}</Text>
                  <Text style={[styles.specLabel, active && styles.specLabelActive]}>{s.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={13} color="#000" style={{ marginLeft: 2 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <View style={styles.row}>
          <Field label="Experience (Years) *" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={experience}
              onChangeText={setExperience}
            />
          </Field>
          <Field label="Rate / Day (₹) *" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2500"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={ratePerDay}
              onChangeText={setRatePerDay}
            />
          </Field>
        </View>

        <Field label="Languages Spoken *">
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => {
              const sel = selectedLanguages.includes(lang);
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, sel && styles.langChipActive]}
                  onPress={() => toggleLanguage(lang)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langLabel, sel && styles.langLabelActive]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Certifications (optional)">
          <TextInput
            style={styles.input}
            placeholder="e.g. IMF Basic Mountaineering, First Aid, WFR (comma-separated)"
            placeholderTextColor="#555"
            value={certifications}
            onChangeText={setCertifications}
          />
        </Field>

        <Field label="About You *">
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your guiding experience, the trails you know, and what makes you a great guide..."
            placeholderTextColor="#555"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </Field>

        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="ribbon-outline" size={20} color="#000" />
              <Text style={styles.submitBtnText}>Submit Application</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      <MapPickerModal
        visible={showMap}
        initialLat={coords ? coords[1] : undefined}
        initialLng={coords ? coords[0] : undefined}
        onConfirm={(loc) => {
          setCoords([loc.lng, loc.lat]);
          setShowMap(false);
        }}
        onClose={() => setShowMap(false)}
      />
    </SafeAreaView>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[{ marginBottom: 20 }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
    marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },

  label: {
    fontSize: 11, fontWeight: '700', color: '#8CC63F',
    letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: { minHeight: 110, paddingTop: 13 },
  row: { flexDirection: 'row', gap: 12 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 10,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 13 },
  suggestions: {
    backgroundColor: '#141920', borderRadius: 12, marginTop: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  suggBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggText: { flex: 1, color: '#FFF', fontSize: 13 },
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  mapPinText: { fontSize: 12, color: '#8CC63F', fontWeight: '600', flex: 1 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRow: { gap: 8, paddingBottom: 4 },
  specChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  specChipActive: { backgroundColor: '#8CC63F', borderColor: '#8CC63F' },
  specEmoji: { fontSize: 15 },
  specLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  specLabelActive: { color: '#000' },

  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  langChipActive: { backgroundColor: '#8CC63F', borderColor: '#8CC63F' },
  langLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  langLabelActive: { color: '#000' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8CC63F', borderRadius: 16,
    paddingVertical: 16, marginTop: 8, gap: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
});
