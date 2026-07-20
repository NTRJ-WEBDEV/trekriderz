import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useExpeditionStore } from '@/stores/expeditionStore';
import { checkGuideIsPremium, getMyGuideProfile } from '@/lib/expeditions';
import PremiumGuardBanner from '@/components/PremiumGuardBanner';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import MapPickerModal, { PickedLocation } from '@/components/MapPickerModal';
import LocationPicker, { getStateCenter } from '@/components/LocationPicker';

const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'expert'] as const;
type Difficulty = typeof DIFFICULTIES[number];

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: 'Easy', color: '#22C55E' },
  moderate: { label: 'Moderate', color: '#F59E0B' },
  challenging: { label: 'Challenging', color: '#EF4444' },
  expert: { label: 'Expert', color: '#8B5CF6' },
};

export default function CreateExpeditionScreen() {
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const { createAndPublishExpedition } = useExpeditionStore();

  const [initLoading, setInitLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [guideId, setGuideId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);

  // Step 1: Basics
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [destState, setDestState] = useState('');
  const [destDistrict, setDestDistrict] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState<GeocodeResult[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const destSearchTimeout = useRef<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [maxSeats, setMaxSeats] = useState('12');
  const [description, setDescription] = useState('');

  // Step 2: Packages
  const [packages, setPackages] = useState([
    { name: 'Standard Package', price_per_person: '', inclusions: '' },
  ]);

  // Step 3: Itinerary
  const [itineraryDays, setItineraryDays] = useState([
    { day_number: 1, title: '', description: '', activities: '' },
  ]);

  useEffect(() => {
    async function checkPremium() {
      if (!user) return;
      const { data: profile } = await getMyGuideProfile(user.id);
      if (profile) {
        setGuideId(profile.id);
        setIsPremium(profile.is_premium);
      }
      setInitLoading(false);
    }
    checkPremium();
  }, [user]);

  if (initLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8CC63F" />
      </View>
    );
  }

  // Was `(user as any)?.role === 'admin'` — user comes from useAuthStore's
  // raw Supabase Auth object, whose own `role` field is GoTrue's
  // ("authenticated"), never the app's admin role. This silently made the
  // admin bypass below unreachable; hasPermission() reads the real RBAC data.
  const isAdmin = hasPermission('expeditions.manage');

  if ((!isPremium || !guideId) && !isAdmin) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Expedition</Text>
            <View style={{ width: 40 }} />
          </View>
          <PremiumGuardBanner />
        </SafeAreaView>
      </View>
    );
  }

  const handleDestSearch = (text: string) => {
    setDestination(text);
    setCoords(null);
    if (destSearchTimeout.current) clearTimeout(destSearchTimeout.current);
    if (text.length < 3) { setDestSuggestions([]); return; }
    setDestSearching(true);
    destSearchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text, getStateCenter(destState));
      setDestSuggestions(results);
      setDestSearching(false);
    }, 500);
  };

  const selectDestSuggestion = (place: GeocodeResult) => {
    setDestination(place.place_name);
    setCoords({ lat: place.center[1], lng: place.center[0] });
    setDestSuggestions([]);
  };

  const handleNextStep1 = () => {
    if (!title || !destination || !startDate || !endDate || !description) {
      Alert.alert('Missing Fields', 'Please fill in all basic details before continuing.');
      return;
    }
    if (startDate >= endDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date.');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    const invalidPkg = packages.some((p) => !p.name || !p.price_per_person);
    if (invalidPkg) {
      Alert.alert('Missing Fields', 'Please ensure all packages have a name and price.');
      return;
    }
    setStep(3);
  };

  const handleAddPackage = () => {
    if (packages.length >= 3) {
      Alert.alert('Limit Reached', 'You can add up to 3 package tiers.');
      return;
    }
    setPackages([...packages, { name: '', price_per_person: '', inclusions: '' }]);
  };

  const handleRemovePackage = (index: number) => {
    if (packages.length === 1) return;
    setPackages(packages.filter((_, i) => i !== index));
  };

  const handleAddItineraryDay = () => {
    setItineraryDays([
      ...itineraryDays,
      {
        day_number: itineraryDays.length + 1,
        title: '',
        description: '',
        activities: '',
      },
    ]);
  };

  const updatePackage = (index: number, field: string, value: string) => {
    const newPkgs = [...packages];
    (newPkgs[index] as any)[field] = value;
    setPackages(newPkgs);
  };

  const updateItinerary = (index: number, field: string, value: string) => {
    const newItinerary = [...itineraryDays];
    (newItinerary[index] as any)[field] = value;
    setItineraryDays(newItinerary);
  };

  const handlePublish = async () => {
    const invalidDay = itineraryDays.some((d) => !d.title);
    if (invalidDay) {
      Alert.alert('Missing Fields', 'Please ensure all itinerary days have a title.');
      return;
    }

    if (!guideId) {
      Alert.alert('No Guide Profile', 'Please register as a guide first before creating an expedition.');
      return;
    }

    setIsPublishing(true);

    const formattedPackages = packages.map((p) => ({
      name: p.name,
      price_per_person: parseInt(p.price_per_person.replace(/[^0-9]/g, '') || '0'),
      inclusions: p.inclusions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));

    const formattedItinerary = itineraryDays.map((d) => ({
      day_number: d.day_number,
      title: d.title,
      description: d.description,
      activities: d.activities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }));

    const { expeditionId, error } = await createAndPublishExpedition({
      basics: {
        guide_id: guideId,
        title,
        description,
        destination,
        destination_state: destState || undefined,
        destination_district: destDistrict || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        start_date: startDate,
        end_date: endDate,
        difficulty,
        max_seats: parseInt(maxSeats || '12'),
      },
      packages: formattedPackages,
      itinerary: formattedItinerary,
      publishNow: true,
    });

    setIsPublishing(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to publish expedition. Please try again.');
    } else {
      Alert.alert('Success!', 'Your expedition is now live!', [
        {
          text: 'View It',
          onPress: () => router.replace(`/expeditions/${expeditionId}` as any),
        },
      ]);
    }
  };

  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
            {step > s ? (
              <Ionicons name="checkmark" size={12} color="#FFF" />
            ) : (
              <Text style={[styles.stepDotText, step >= s && styles.stepDotTextActive]}>
                {s}
              </Text>
            )}
          </View>
          {s < 3 && (
            <View style={[styles.stepLine, step > s && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step === 1 ? (router.canGoBack() ? router.back() : router.replace('/(tabs)')) : setStep(step - 1))}
        >
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Create Expedition</Text>
          <Text style={styles.headerSub}>
            Step {step} of 3 —{' '}
            {step === 1 ? 'Basic Details' : step === 2 ? 'Packages' : 'Itinerary'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 1: BASICS */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Expedition Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Roopkund Trek Winter Edition"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Destination *</Text>
              <LocationPicker
                value={{ state: destState, district: destDistrict }}
                onChange={(v) => { setDestState(v.state); setDestDistrict(v.district); }}
              />
              <View style={[styles.destInputRow, { marginTop: 12 }]}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g., Uttarakhand, India"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={destination}
                  onChangeText={handleDestSearch}
                />
                {destSearching && <ActivityIndicator size="small" color="#8CC63F" style={{ marginLeft: 8 }} />}
              </View>
              {destSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {destSuggestions.map((sug, i) => (
                    <TouchableOpacity
                      key={sug.id}
                      style={[styles.suggItem, i < destSuggestions.length - 1 && styles.suggBorder]}
                      onPress={() => selectDestSuggestion(sug)}
                    >
                      <Ionicons name="location-outline" size={14} color="#8CC63F" />
                      <Text style={styles.suggText} numberOfLines={2}>{sug.place_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.mapPinBtn} onPress={() => setShowMapPicker(true)}>
                <Ionicons name="map-outline" size={14} color="#8CC63F" />
                <Text style={styles.mapPinText}>
                  {coords
                    ? `📍 ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E — tap to adjust`
                    : 'Pin exact destination on the map'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Difficulty *</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTIES.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.diffChip,
                      difficulty === d && {
                        backgroundColor: DIFFICULTY_CONFIG[d].color + '25',
                        borderColor: DIFFICULTY_CONFIG[d].color,
                      },
                    ]}
                    onPress={() => setDifficulty(d)}
                  >
                    <Text
                      style={[
                        styles.diffChipText,
                        difficulty === d && { color: DIFFICULTY_CONFIG[d].color, fontWeight: '700' },
                      ]}
                    >
                      {DIFFICULTY_CONFIG[d].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Max Seats *</Text>
              <TextInput
                style={[styles.input, { width: 100 }]}
                placeholder="12"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={maxSeats}
                onChangeText={setMaxSeats}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the expedition, what makes it special, what to expect..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep1}>
              <Text style={styles.nextBtnText}>Next: Add Packages</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: PACKAGES */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              Create up to 3 package tiers with different inclusions and pricing.
            </Text>

            {packages.map((pkg, index) => (
              <View key={index} style={styles.packageCard}>
                <View style={styles.packageCardHeader}>
                  <Text style={styles.packageCardTitle}>Package {index + 1}</Text>
                  {packages.length > 1 && (
                    <TouchableOpacity onPress={() => handleRemovePackage(index)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Package Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Standard, Premium, Deluxe"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={pkg.name}
                    onChangeText={(v) => updatePackage(index, 'name', v)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Price per Person (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 15000"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={pkg.price_per_person}
                    onChangeText={(v) => updatePackage(index, 'price_per_person', v)}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Inclusions (comma-separated)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="e.g., Meals, Accommodation, Guide, Equipment"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={pkg.inclusions}
                    onChangeText={(v) => updatePackage(index, 'inclusions', v)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ))}

            {packages.length < 3 && (
              <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddPackage}>
                <Ionicons name="add-circle-outline" size={20} color="#8CC63F" />
                <Text style={styles.addMoreBtnText}>Add Another Package</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep2}>
              <Text style={styles.nextBtnText}>Next: Add Itinerary</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: ITINERARY */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDescription}>
              Add a day-by-day itinerary so trekkers know what to expect.
            </Text>

            {itineraryDays.map((day, index) => (
              <View key={index} style={styles.itineraryCard}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>Day {day.day_number}</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Day Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Arrival at base camp"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={day.title}
                    onChangeText={(v) => updateItinerary(index, 'title', v)}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="What happens on this day?"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={day.description}
                    onChangeText={(v) => updateItinerary(index, 'description', v)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Activities (comma-separated)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Trek 8km, Campfire, Wildlife spotting"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={day.activities}
                    onChangeText={(v) => updateItinerary(index, 'activities', v)}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddItineraryDay}>
              <Ionicons name="add-circle-outline" size={20} color="#8CC63F" />
              <Text style={styles.addMoreBtnText}>Add Day {itineraryDays.length + 1}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.publishBtn, isPublishing && { opacity: 0.6 }]}
              onPress={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={20} color="#FFF" />
                  <Text style={styles.publishBtnText}>Publish Expedition</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#080C14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  stepDotText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '700',
  },
  stepDotTextActive: {
    color: '#FFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#8CC63F',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  stepContent: {
    gap: 4,
  },
  stepDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  field: {
    marginBottom: 18,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 12,
  },
  destInputRow: { flexDirection: 'row', alignItems: 'center' },
  suggestions: {
    backgroundColor: '#141920', borderRadius: 12, marginTop: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', overflow: 'hidden',
  },
  suggItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  suggBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggText: { flex: 1, color: '#FFF', fontSize: 13 },
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  mapPinText: { fontSize: 12, color: '#8CC63F', fontWeight: '600', flex: 1 },
  difficultyRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  diffChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  diffChipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  packageCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  packageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  packageCardTitle: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(140,198,63,0.4)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  addMoreBtnText: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
  },
  itineraryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  dayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(140,198,63,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.3)',
  },
  dayBadgeText: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  publishBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
