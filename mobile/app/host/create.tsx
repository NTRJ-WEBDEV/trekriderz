import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import MapPickerModal from '@/components/MapPickerModal';

const AMENITIES = [
  { id: 'wifi', label: 'WiFi', icon: '📶' },
  { id: 'parking', label: 'Parking', icon: '🅿️' },
  { id: 'hot_water', label: 'Hot Water', icon: '🚿' },
  { id: 'kitchen', label: 'Kitchen', icon: '🍳' },
  { id: 'meals', label: 'Meals Included', icon: '🍱' },
  { id: 'heating', label: 'Heating', icon: '🔥' },
  { id: 'mountain_view', label: 'Mountain View', icon: '🏔️' },
  { id: 'river_view', label: 'River View', icon: '🏞️' },
  { id: 'trail_access', label: 'Trail Access', icon: '🥾' },
  { id: 'bonfire', label: 'Bonfire Area', icon: '🪵' },
  { id: 'tv', label: 'TV', icon: '📺' },
  { id: 'washing', label: 'Laundry', icon: '🧺' },
];

export default function CreateHomestayScreen() {
  const { user } = useAuthStore();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [description, setDescription] = useState('');
  const [pricePerNight, setPricePerNight] = useState('');
  const [rooms, setRooms] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
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

  const toggleAmenity = (id: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!name || !location || !description || !pricePerNight || !rooms) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('homestays').insert({
        owner_id: user?.id,
        name: name.trim(),
        location: location.trim(),
        lat: coords ? coords[1] : null,
        lng: coords ? coords[0] : null,
        description: description.trim(),
        price_per_night: parseFloat(pricePerNight),
        rooms: parseInt(rooms),
        contact_phone: phone.trim() || null,
        amenities: selectedAmenities,
        status: 'pending',
        photos: [],
      });

      if (error) throw error;

      // Notify admins
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');
      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'New Homestay Application',
            message: `${name} has applied for listing approval.`,
            type: 'system',
          }))
        );
      }

      Alert.alert(
        'Application Submitted! 🏠',
        'Your homestay is under review. Our team will verify and approve it within 2–3 business days.',
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
          <Text style={styles.headerTitle}>List Your Property</Text>
          <Text style={styles.headerSub}>Apply to host trekkers & travelers</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#8CC63F" />
          <Text style={styles.infoText}>
            Your listing will be reviewed by our team before going live. Typically approved within 2–3 days.
          </Text>
        </View>

        <Field label="Property Name *">
          <TextInput
            style={styles.input}
            placeholder="e.g. Mountain View Homestay"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
          />
        </Field>

        <Field label="Location *">
          <View style={styles.searchBox}>
            <Ionicons name="location-outline" size={16} color="#8CC63F" />
            <TextInput
              style={styles.searchInput}
              placeholder="Village, district, state"
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
          {!coords && location.length > 0 && !searching && suggestions.length === 0 && (
            <TouchableOpacity style={styles.mapPinBtn} onPress={() => setShowMap(true)}>
              <Ionicons name="map-outline" size={14} color="rgba(255,255,255,0.4)" />
              <Text style={[styles.mapPinText, { color: 'rgba(255,255,255,0.4)' }]}>Pin exact location on map</Text>
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

        <Field label="Description *">
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your property — surroundings, what makes it special, nearby trails..."
            placeholderTextColor="#555"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Field>

        <View style={styles.row}>
          <Field label="Price / Night (₹) *" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1500"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={pricePerNight}
              onChangeText={setPricePerNight}
            />
          </Field>
          <Field label="No. of Rooms *" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 4"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={rooms}
              onChangeText={setRooms}
            />
          </Field>
        </View>

        <Field label="Contact Phone">
          <TextInput
            style={styles.input}
            placeholder="+91 98765 43210"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </Field>

        <Field label="Amenities">
          <View style={styles.amenityGrid}>
            {AMENITIES.map((a) => {
              const selected = selectedAmenities.includes(a.id);
              return (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.amenityChip, selected && styles.amenityChipActive]}
                  onPress={() => toggleAmenity(a.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.amenityIcon}>{a.icon}</Text>
                  <Text style={[styles.amenityLabel, selected && styles.amenityLabelActive]}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
              <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
              <Text style={styles.submitBtnText}>Submit for Approval</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

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
  textArea: { minHeight: 100, paddingTop: 13 },
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

  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  amenityChipActive: { backgroundColor: '#8CC63F', borderColor: '#8CC63F' },
  amenityIcon: { fontSize: 14 },
  amenityLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  amenityLabelActive: { color: '#000' },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8CC63F', borderRadius: 16,
    paddingVertical: 16, marginTop: 8, gap: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
});
