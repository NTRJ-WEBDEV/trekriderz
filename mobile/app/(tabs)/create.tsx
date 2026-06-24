import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import { Ionicons } from '@expo/vector-icons';
import { queueTask } from '@/lib/db';

const TRIP_TYPES = [
  { id: 'trek', label: 'Trek', emoji: '⛰️' },
  { id: 'bike', label: 'Bike Ride', emoji: '🏍️' },
  { id: 'car_ride', label: 'Car Ride', emoji: '🚗' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { id: 'temple', label: 'Temple', emoji: '🛕' },
  { id: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { id: 'weekend', label: 'Weekend', emoji: '🌄' },
];

export default function CreateTripScreen() {
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripType, setTripType] = useState<string>('trek');
  const [groupSize, setGroupSize] = useState('');
  const [budget, setBudget] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<any>(null);

  const handleSearch = (text: string) => {
    setDestination(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) { setSuggestions([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text);
      setSuggestions(results);
      setSearching(false);
    }, 500);
  };

  const selectDestination = (place: GeocodeResult) => {
    setDestination(place.place_name);
    setCoords(place.center);
    setSuggestions([]);
  };

  const handleCreateTrip = async () => {
    if (!title || !destination || !startDate || !endDate || !groupSize || !budget) {
      Alert.alert('Missing Fields', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    // Only include new columns if they have non-default values — protects against
    // PostgREST rejecting the insert when the DB migration hasn't been run yet.
    const newTrip: Record<string, any> = {
      id: Math.random().toString(36).substr(2, 9),
      created_by: user?.id,
      title: title.trim(),
      destination: destination.trim(),
      lat: coords ? coords[1] : null,
      lng: coords ? coords[0] : null,
      start_date: startDate,
      end_date: endDate,
      trip_type: tripType,
      group_size: parseInt(groupSize),
      budget: parseInt(budget),
      status: 'planning',
    };
    if (description.trim()) newTrip.description = description.trim();
    if (isPublic) newTrip.is_public = true;

    try {
      const { error } = await supabase.from('trips').insert([newTrip]);
      if (error) {
        console.warn('Sync failed, queuing locally:', error.message);
        await queueTask('INSERT', 'trips', newTrip);
        Alert.alert('Saved Offline 📡', 'You are currently offline. Trip saved locally.', [
          { text: 'OK', onPress: () => { resetForm(); router.back(); } },
        ]);
      } else {
        Alert.alert(
          isPublic ? 'Trip Published! 🎉' : 'Trip Created! 🏔️',
          isPublic
            ? 'Your trip is now visible on Discover. Fellow travelers can request to join!'
            : 'Your adventure has been planned.',
          [{ text: 'OK', onPress: () => { resetForm(); router.back(); } }]
        );
      }
    } catch {
      await queueTask('INSERT', 'trips', newTrip);
      Alert.alert('Saved Offline 📡', 'Trip saved locally for later sync.', [
        { text: 'OK', onPress: () => { resetForm(); router.back(); } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setDestination(''); setDescription('');
    setStartDate(''); setEndDate('');
    setGroupSize(''); setBudget('');
    setTripType('trek'); setCoords(null); setIsPublic(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Plan Adventure 🏔️</Text>
          <Text style={styles.subtitle}>Create your trip and invite fellow travelers</Text>
        </View>

        <View style={styles.form}>

          {/* Trip Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Trip Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {TRIP_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeBtn, tripType === t.id && styles.typeBtnActive]}
                  onPress={() => setTripType(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.typeLabel, tripType === t.id && styles.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Destination */}
          <View style={styles.field}>
            <Text style={styles.label}>Destination *</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color="#8CC63F" />
              <TextInput
                style={styles.searchInput}
                placeholder="Where are you heading?"
                placeholderTextColor="#555"
                value={destination}
                onChangeText={handleSearch}
              />
              {searching && <ActivityIndicator size="small" color="#8CC63F" />}
            </View>
            {suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.suggestionItem, i < suggestions.length - 1 && styles.suggestionBorder]}
                    onPress={() => selectDestination(s)}
                  >
                    <Ionicons name="location-outline" size={14} color="#8CC63F" />
                    <Text style={styles.suggestionText} numberOfLines={2}>{s.place_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Trip Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Trip Title *</Text>
            <TextInput
              style={styles.inputBox}
              placeholder="Name your adventure"
              placeholderTextColor="#555"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.inputBox, styles.textArea]}
              placeholder="Tell others about this trip — route, stay, what to expect..."
              placeholderTextColor="#555"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Dates */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Start Date *</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#555"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>End Date *</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#555"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          {/* Group Size & Budget */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Group Size *</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="No. of people"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={groupSize}
                onChangeText={setGroupSize}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Budget (₹) *</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="Total budget"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={budget}
                onChangeText={setBudget}
              />
            </View>
          </View>

          {/* Invite Others toggle */}
          <View style={styles.publicToggleCard}>
            <View style={styles.publicToggleLeft}>
              <View style={styles.publicToggleIconWrap}>
                <Ionicons name="people-outline" size={20} color={isPublic ? '#8CC63F' : 'rgba(255,255,255,0.5)'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.publicToggleTitle}>Invite Fellow Travelers</Text>
                <Text style={styles.publicToggleSub}>
                  {isPublic
                    ? 'Visible on Discover — anyone can request to join'
                    : 'Only visible to you — private trip'}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(140,198,63,0.45)' }}
              thumbColor={isPublic ? '#8CC63F' : 'rgba(255,255,255,0.4)'}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.createBtn, loading && { opacity: 0.6 }]}
            onPress={handleCreateTrip}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name={isPublic ? 'globe-outline' : 'add-circle-outline'} size={20} color="#000" />
                <Text style={styles.createBtnText}>
                  {isPublic ? 'Publish & Invite' : 'Create Trip'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isPublic && (
            <Text style={styles.publicNote}>
              Your trip will appear on the Discover page. Other travelers can send a join request which you can accept or decline.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  scrollView: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },

  form: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  field: { marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#8CC63F',
    letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase',
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 10,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 14 },

  inputBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: { minHeight: 96, paddingTop: 14 },

  suggestions: {
    backgroundColor: '#141920', borderRadius: 12, marginTop: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggestionText: { flex: 1, color: '#FFF', fontSize: 13 },

  typeRow: { gap: 10, paddingBottom: 4 },
  typeBtn: {
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 4, minWidth: 74,
  },
  typeBtnActive: { backgroundColor: '#8CC63F', borderColor: '#8CC63F' },
  typeEmoji: { fontSize: 22 },
  typeLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3, textAlign: 'center',
  },
  typeLabelActive: { color: '#000' },

  publicToggleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20, gap: 12,
  },
  publicToggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  publicToggleIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  publicToggleTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 3 },
  publicToggleSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 16 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8CC63F', borderRadius: 16,
    paddingVertical: 16, marginTop: 4, gap: 8,
  },
  createBtnText: { fontSize: 16, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  publicNote: {
    marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 17, paddingHorizontal: 8,
  },
});
