import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import { Ionicons } from '@expo/vector-icons';
import { queueTask } from '@/lib/db';
import { haptic } from '@/lib/haptics';
import { Calendar } from 'react-native-calendars';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

const GREEN = '#8CC63F';
const BG = '#080C14';
const { width } = Dimensions.get('window');

const TRIP_TYPES = [
  { id: 'trek',        label: 'Trek',        emoji: '⛰️' },
  { id: 'bike',        label: 'Bike Ride',   emoji: '🏍️' },
  { id: 'car_ride',    label: 'Car Ride',    emoji: '🚗' },
  { id: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { id: 'weekend',     label: 'Weekend',     emoji: '🌄' },
  { id: 'spiritual',   label: 'Spiritual',   emoji: '🙏' },
  { id: 'temple',      label: 'Temple',      emoji: '🛕' },
  { id: 'wildlife',    label: 'Wildlife',    emoji: '🦁' },
  { id: 'photography', label: 'Photography', emoji: '📸' },
];

const PARTNER_GENDER = [
  { id: 'any',    label: 'Any',    emoji: '🤝' },
  { id: 'male',   label: 'Male',   emoji: '👨' },
  { id: 'female', label: 'Female', emoji: '👩' },
];

const BIKE_ROLES = [
  { id: 'rider',   label: 'I have a bike',   sub: 'Looking for pillion rider', emoji: '🏍️' },
  { id: 'pillion', label: 'I need a ride',    sub: 'Looking for a rider with bike', emoji: '🪑' },
  { id: 'any',     label: 'Either way',       sub: 'Both are welcome', emoji: '🤝' },
];

const EXPERIENCE_LEVELS = [
  { id: 'beginner',     label: 'Beginner',     emoji: '🌱' },
  { id: 'intermediate', label: 'Intermediate', emoji: '⛰️' },
  { id: 'expert',       label: 'Expert',       emoji: '🏆' },
];

const SLOTS = [1, 2, 3, 4, 5, '6+'];

const isTrekOrAdventure = (type: string) => ['trek', 'backpacking', 'wildlife', 'photography'].includes(type);
const isBike = (type: string) => type === 'bike';

export default function CreateTripScreen() {
  const user = useAuthStore((state) => state.user);

  // Basic fields
  const [tripType, setTripType]       = useState('trek');
  const [destination, setDestination] = useState('');
  const [coords, setCoords]           = useState<[number, number] | null>(null);
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [dateModal, setDateModal]     = useState(false);
  const [pickingField, setPickingField] = useState<'start' | 'end'>('start');
  const [photos, setPhotos]           = useState<string[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [groupSize, setGroupSize]     = useState('');
  const [budget, setBudget]           = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [isPublic, setIsPublic]       = useState(false);
  const [loading, setLoading]         = useState(false);

  // Partner matching
  const [lookingForPartner, setLookingForPartner] = useState(false);
  const [partnerGender, setPartnerGender]         = useState('any');
  const [bikeRole, setBikeRole]                   = useState('rider');
  const [slotsAvailable, setSlotsAvailable]       = useState<string | number>(1);
  const [contactWhatsApp, setContactWhatsApp]     = useState('');

  // Location autocomplete
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching]     = useState(false);
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

  const resetForm = () => {
    setTripType('trek'); setDestination(''); setCoords(null);
    setTitle(''); setDescription(''); setStartDate(''); setEndDate(''); setDateModal(false); setPhotos([]);
    setGroupSize(''); setBudget(''); setMeetingPoint(''); setExperienceLevel('');
    setIsPublic(false); setLookingForPartner(false);
    setPartnerGender('any'); setBikeRole('rider');
    setSlotsAvailable(1); setContactWhatsApp('');
  };

  const pickImage = async () => {
    if (photos.length >= 5) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add trip images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - photos.length,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  const uploadPhotos = async (userId: string): Promise<string[]> => {
    const urls: string[] = [];
    const ts = Date.now();
    for (let i = 0; i < photos.length; i++) {
      const uri = photos[i];
      const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
      const path = `${userId}/${ts}_${i}.${ext}`;
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        const { error } = await supabase.storage
          .from('trip-photos')
          .upload(path, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
        if (!error) {
          const { data } = supabase.storage.from('trip-photos').getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      } catch (e) {
        console.warn('Photo upload failed for', path, e);
      }
    }
    return urls;
  };

  const handleCreate = async () => {
    if (!title.trim() || !destination || !startDate || !endDate || !groupSize || !budget) {
      Alert.alert('Missing Fields', 'Please fill in title, destination, dates, group size and budget.');
      return;
    }
    if (!Number.isInteger(Number(groupSize)) || Number(groupSize) < 1 || Number(groupSize) > 9999) {
      Alert.alert('Invalid Group Size', 'Enter a group size between 1 and 9999.');
      return;
    }
    if (!Number.isInteger(Number(budget)) || Number(budget) < 1 || Number(budget) > 9999999) {
      Alert.alert('Invalid Budget', 'Enter a budget per person up to ₹99,99,999.');
      return;
    }
    haptic.medium();
    setLoading(true);

    // Upload photos first
    let photoUrls: string[] = [];
    if (photos.length > 0 && user?.id) {
      setUploading(true);
      photoUrls = await uploadPhotos(user.id);
      setUploading(false);
    }

    const newTrip: Record<string, any> = {
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
    if (photoUrls.length > 0) newTrip.photos = photoUrls;
    if (isPublic) newTrip.is_public = true;
    if (meetingPoint.trim()) newTrip.meeting_point = meetingPoint.trim();
    if (experienceLevel) newTrip.experience_level = experienceLevel;

    if (isPublic && lookingForPartner) {
      newTrip.looking_for_partner = true;
      newTrip.partner_gender = partnerGender;
      newTrip.slots_available = slotsAvailable === '6+' ? 6 : Number(slotsAvailable);
      if (isBike(tripType)) newTrip.partner_role = bikeRole;
      if (contactWhatsApp.trim()) newTrip.contact_whatsapp = contactWhatsApp.trim();
    }

    try {
      const { error } = await supabase.from('trips').insert([newTrip]);
      if (error) {
        // Only save offline for genuine network failures
        const isNetworkError = error.message?.toLowerCase().includes('network') ||
          error.message?.toLowerCase().includes('fetch') ||
          error.message?.toLowerCase().includes('connection');
        if (isNetworkError) {
          await queueTask('INSERT', 'trips', newTrip);
          Alert.alert('Saved Offline 📡', 'No connection — trip saved locally and will sync when you\'re back online.', [
            { text: 'OK', onPress: () => { resetForm(); router.back(); } },
          ]);
        } else {
          Alert.alert('Failed to Create Trip', error.message || 'Something went wrong. Please try again.');
        }
      } else {
        haptic.success();
        const msg = lookingForPartner && isPublic
          ? 'Your trip is live on Discover with partner matching enabled!'
          : isPublic
            ? 'Your trip is live on Discover — fellow travelers can join!'
            : 'Your adventure is planned.';
        Alert.alert(isPublic ? 'Trip Published! 🎉' : 'Trip Created! 🏔️', msg, [
          { text: 'OK', onPress: () => { resetForm(); router.back(); } },
        ]);
      }
    } catch (e: any) {
      // Catch-block is true network failure (fetch threw)
      await queueTask('INSERT', 'trips', newTrip);
      Alert.alert('Saved Offline 📡', 'Trip saved locally and will sync when you\'re back online.', [
        { text: 'OK', onPress: () => { resetForm(); router.back(); } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} />
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerIconWrap}>
            <Ionicons name="add-circle" size={28} color={GREEN} />
          </View>
          <View>
            <Text style={s.headerTitle}>Plan Adventure</Text>
            <Text style={s.headerSub}>Create your trip and find travel partners</Text>
          </View>
        </View>

        <View style={s.form}>

          {/* ── TRIP TYPE ── */}
          <SectionLabel title="Trip Type" icon="map-outline" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll}>
            <View style={s.typeRow}>
              {TRIP_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeBtn, tripType === t.id && s.typeBtnActive]}
                  onPress={() => { haptic.select(); setTripType(t.id); }}
                >
                  <Text style={s.typeEmoji}>{t.emoji}</Text>
                  <Text style={[s.typeLabel, tripType === t.id && s.typeLabelActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Bike role — only for bike trips */}
          {isBike(tripType) && (
            <View style={s.bikeRoleWrap}>
              {BIKE_ROLES.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[s.bikeRoleCard, bikeRole === r.id && s.bikeRoleCardActive]}
                  onPress={() => { haptic.select(); setBikeRole(r.id); }}
                >
                  <Text style={s.bikeRoleEmoji}>{r.emoji}</Text>
                  <Text style={[s.bikeRoleLabel, bikeRole === r.id && s.bikeRoleLabelActive]}>{r.label}</Text>
                  <Text style={s.bikeRoleSub}>{r.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── DESTINATION ── */}
          <SectionLabel title="Destination" icon="location-outline" />
          <View style={s.inputRow}>
            <Ionicons name="search-outline" size={18} color={GREEN} />
            <TextInput
              style={s.input}
              placeholder="Where are you heading?"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={destination}
              onChangeText={handleSearch}
            />
            {searching && <ActivityIndicator size="small" color={GREEN} />}
          </View>
          {suggestions.length > 0 && (
            <View style={s.suggestions}>
              {suggestions.map((sug, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.suggItem, i < suggestions.length - 1 && s.suggBorder]}
                  onPress={() => selectDestination(sug)}
                >
                  <Ionicons name="location-outline" size={14} color={GREEN} />
                  <Text style={s.suggText} numberOfLines={2}>{sug.place_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Meeting Point */}
          <View style={s.fieldGap}>
            <Text style={s.sublabel}>Meeting Point <Text style={s.optional}>(optional)</Text></Text>
            <View style={s.inputRow}>
              <Ionicons name="flag-outline" size={16} color="rgba(255,255,255,0.3)" />
              <TextInput
                style={s.input}
                placeholder="e.g. Haridwar Railway Station, Gate 2"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={meetingPoint}
                onChangeText={setMeetingPoint}
              />
            </View>
          </View>

          {/* ── TRIP DETAILS ── */}
          <SectionLabel title="Trip Details" icon="document-text-outline" />

          <TextInput
            style={s.inputBox}
            placeholder="Trip title — name your adventure"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[s.inputBox, s.textArea]}
            placeholder="Tell others about this trip — route, plan, what to expect..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Dates */}
          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.sublabel}>Start Date</Text>
              <TouchableOpacity
                style={[s.inputRow, s.dateTap]}
                onPress={() => { setPickingField('start'); setDateModal(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={15} color={startDate ? GREEN : 'rgba(255,255,255,0.3)'} />
                <Text style={[s.dateTapText, !startDate && s.datePlaceholder]}>
                  {startDate ? formatDisplayDate(startDate) : 'Pick date'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={s.half}>
              <Text style={s.sublabel}>End Date</Text>
              <TouchableOpacity
                style={[s.inputRow, s.dateTap]}
                onPress={() => { setPickingField('end'); setDateModal(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={15} color={endDate ? GREEN : 'rgba(255,255,255,0.3)'} />
                <Text style={[s.dateTapText, !endDate && s.datePlaceholder]}>
                  {endDate ? formatDisplayDate(endDate) : 'Pick date'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Trip Photos */}
          <Text style={s.sublabel}>Trip Photos <Text style={s.sublabelMuted}>(up to 5)</Text></Text>
          <View style={s.photosRow}>
            {photos.map((uri, idx) => (
              <TouchableOpacity
                key={idx}
                style={s.photoThumb}
                onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                activeOpacity={0.85}
              >
                <Image source={{ uri }} style={s.photoThumbImg} contentFit="cover" />
                <View style={s.photoRemoveIcon}>
                  <Ionicons name="close-circle" size={18} color="#FFF" />
                </View>
              </TouchableOpacity>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={s.photoAddSlot} onPress={pickImage} activeOpacity={0.8}>
                {uploading ? (
                  <ActivityIndicator size="small" color={GREEN} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.35)" />
                    <Text style={s.photoAddText}>
                      {photos.length === 0 ? 'Add\nPhotos' : `${5 - photos.length}\nleft`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
          {photos.length > 0 && (
            <Text style={s.photoHint}>
              🗑 Tap a photo to remove it · Images auto-delete 30 days after trip ends
            </Text>
          )}

          {/* Group Size & Budget */}
          <View style={s.row}>
            <View style={s.half}>
              <Text style={s.sublabel}>Group Size</Text>
              <View style={s.inputRow}>
                <Ionicons name="people-outline" size={15} color="rgba(255,255,255,0.3)" />
                <TextInput
                  style={s.input}
                  placeholder="No. of people"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  maxLength={4}
                  value={groupSize}
                  onChangeText={setGroupSize}
                />
              </View>
            </View>
            <View style={s.half}>
              <Text style={s.sublabel}>Budget / Person (₹)</Text>
              <View style={s.inputRow}>
                <Text style={s.rupeeSign}>₹</Text>
                <TextInput
                  style={s.input}
                  placeholder="Amount"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  keyboardType="numeric"
                  maxLength={7}
                  value={budget}
                  onChangeText={setBudget}
                />
              </View>
            </View>
          </View>

          {/* Experience Level — for trek/adventure types */}
          {(isTrekOrAdventure(tripType) || isBike(tripType)) && (
            <View>
              <Text style={s.sublabel}>Experience Level Required</Text>
              <View style={s.chipRow}>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <TouchableOpacity
                    key={lvl.id}
                    style={[s.chip, experienceLevel === lvl.id && s.chipActive]}
                    onPress={() => { haptic.select(); setExperienceLevel(lvl.id); }}
                  >
                    <Text style={s.chipEmoji}>{lvl.emoji}</Text>
                    <Text style={[s.chipText, experienceLevel === lvl.id && s.chipTextActive]}>{lvl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── VISIBILITY ── */}
          <SectionLabel title="Who can join?" icon="globe-outline" />
          <TouchableOpacity
            style={[s.toggleCard, isPublic && s.toggleCardActive]}
            onPress={() => { haptic.select(); setIsPublic((v) => !v); }}
            activeOpacity={0.85}
          >
            <View style={[s.toggleIcon, isPublic && { backgroundColor: GREEN + '25' }]}>
              <Ionicons name="people-outline" size={22} color={isPublic ? GREEN : 'rgba(255,255,255,0.4)'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleTitle, isPublic && { color: GREEN }]}>
                {isPublic ? 'Open to Fellow Travelers' : 'Private Trip'}
              </Text>
              <Text style={s.toggleSub}>
                {isPublic
                  ? 'Visible on Discover — anyone can request to join'
                  : 'Only visible to you — tap to make public'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={(v) => { haptic.select(); setIsPublic(v); }}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: GREEN + '60' }}
              thumbColor={isPublic ? GREEN : 'rgba(255,255,255,0.4)'}
            />
          </TouchableOpacity>

          {/* ── PARTNER MATCHING ── only if public */}
          {isPublic && (
            <View style={s.partnerSection}>
              <View style={s.partnerHeader}>
                <Ionicons name="person-add-outline" size={18} color="#A78BFA" />
                <Text style={s.partnerHeaderText}>Looking for a Travel Partner?</Text>
                <Switch
                  value={lookingForPartner}
                  onValueChange={(v) => { haptic.select(); setLookingForPartner(v); }}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7C3AED60' }}
                  thumbColor={lookingForPartner ? '#A78BFA' : 'rgba(255,255,255,0.4)'}
                />
              </View>

              {lookingForPartner && (
                <View style={s.partnerDetails}>

                  {/* Gender preference */}
                  <Text style={s.partnerLabel}>Preferred Partner</Text>
                  <View style={s.genderRow}>
                    {PARTNER_GENDER.map((g) => (
                      <TouchableOpacity
                        key={g.id}
                        style={[s.genderChip, partnerGender === g.id && s.genderChipActive]}
                        onPress={() => { haptic.select(); setPartnerGender(g.id); }}
                      >
                        <Text style={s.genderEmoji}>{g.emoji}</Text>
                        <Text style={[s.genderLabel, partnerGender === g.id && s.genderLabelActive]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Bike role — shown when bike is selected */}
                  {isBike(tripType) && (
                    <>
                      <Text style={s.partnerLabel}>Your Role</Text>
                      <View style={s.chipRow}>
                        {BIKE_ROLES.map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={[s.chip, bikeRole === r.id && s.chipActivePurple]}
                            onPress={() => { haptic.select(); setBikeRole(r.id); }}
                          >
                            <Text style={s.chipEmoji}>{r.emoji}</Text>
                            <Text style={[s.chipText, bikeRole === r.id && { color: '#A78BFA' }]}>
                              {r.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Slots available */}
                  <Text style={s.partnerLabel}>Partner Spots Open</Text>
                  <View style={s.slotsRow}>
                    {SLOTS.map((sl) => (
                      <TouchableOpacity
                        key={String(sl)}
                        style={[s.slotChip, slotsAvailable === sl && s.slotChipActive]}
                        onPress={() => { haptic.select(); setSlotsAvailable(sl); }}
                      >
                        <Text style={[s.slotText, slotsAvailable === sl && s.slotTextActive]}>
                          {sl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* WhatsApp contact */}
                  <Text style={s.partnerLabel}>WhatsApp for Quick Connect <Text style={s.optional}>(optional)</Text></Text>
                  <View style={s.inputRow}>
                    <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
                    <TextInput
                      style={s.input}
                      placeholder="+91 98765 43210"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      keyboardType="phone-pad"
                      value={contactWhatsApp}
                      onChangeText={setContactWhatsApp}
                    />
                  </View>

                  {/* Summary tag */}
                  <View style={s.partnerSummary}>
                    <Ionicons name="information-circle-outline" size={14} color="#A78BFA" />
                    <Text style={s.partnerSummaryText}>
                      {isBike(tripType)
                        ? bikeRole === 'rider'
                          ? 'Shown as "Rider looking for pillion" on Discover'
                          : bikeRole === 'pillion'
                            ? 'Shown as "Pillion looking for rider" on Discover'
                            : 'Shown as "Open to both riders and pillions" on Discover'
                        : `Shown as "Looking for ${partnerGender === 'any' ? 'a travel partner' : `a ${partnerGender} travel partner`}" on Discover`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── CREATE BUTTON ── */}
          <TouchableOpacity
            style={[s.createBtn, loading && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#000" />
                <Text style={s.createBtnText}>
                  {uploading ? `Uploading photos…` : 'Creating…'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons
                  name={isPublic ? 'globe-outline' : 'add-circle-outline'}
                  size={20} color="#000"
                />
                <Text style={s.createBtnText}>
                  {isPublic
                    ? lookingForPartner ? 'Publish & Find Partners' : 'Publish & Invite'
                    : 'Create Trip'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isPublic && (
            <Text style={s.publicNote}>
              {lookingForPartner
                ? 'Your trip will appear on Discover with a "Partner Wanted" badge. Interested travelers can message you directly.'
                : 'Your trip will appear on Discover. Travelers can send a join request which you can accept or decline.'}
            </Text>
          )}

        </View>
      </ScrollView>

      {/* Calendar Modal — must live OUTSIDE ScrollView to avoid Fabric crash */}
      <Modal visible={dateModal} transparent animationType="slide">
        <View style={s.calModalOverlay}>
          <View style={s.calModal}>
            <View style={s.calHeader}>
              <Text style={s.calTitle}>
                {pickingField === 'start' ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <TouchableOpacity onPress={() => setDateModal(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <Calendar
              minDate={pickingField === 'end' && startDate ? startDate : new Date().toISOString().split('T')[0]}
              onDayPress={(day: any) => {
                if (pickingField === 'start') {
                  setStartDate(day.dateString);
                  if (endDate && day.dateString > endDate) setEndDate('');
                  setPickingField('end');
                } else {
                  setEndDate(day.dateString);
                  setDateModal(false);
                }
              }}
              markedDates={{
                ...(startDate ? { [startDate]: { selected: true, selectedColor: GREEN, startingDay: true } } : {}),
                ...(endDate ? { [endDate]: { selected: true, selectedColor: GREEN, endingDay: true } } : {}),
              }}
              markingType="period"
              theme={{
                backgroundColor: '#111827',
                calendarBackground: '#111827',
                textSectionTitleColor: 'rgba(255,255,255,0.4)',
                selectedDayBackgroundColor: GREEN,
                selectedDayTextColor: '#000',
                todayTextColor: GREEN,
                dayTextColor: '#FFF',
                textDisabledColor: 'rgba(255,255,255,0.2)',
                dotColor: GREEN,
                arrowColor: GREEN,
                monthTextColor: '#FFF',
                textMonthFontWeight: '800',
                textDayFontSize: 14,
                textMonthFontSize: 16,
              }}
            />
            {startDate && endDate && (
              <View style={s.calSummary}>
                <Ionicons name="calendar-outline" size={16} color={GREEN} />
                <Text style={s.calSummaryText}>
                  {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionLabel({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={s.sectionLabel}>
      <Ionicons name={icon as any} size={14} color={GREEN} />
      <Text style={s.sectionLabelText}>{title}</Text>
    </View>
  );
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  headerIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: GREEN + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  form: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },

  sectionLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 24, marginBottom: 12,
  },
  sectionLabelText: {
    fontSize: 11, fontWeight: '800', color: GREEN,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },

  sublabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase',
  },
  optional: { fontWeight: '400', color: 'rgba(255,255,255,0.2)' },
  fieldGap: { marginBottom: 14 },

  typeScroll: { marginHorizontal: -20 },
  typeRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 4 },
  typeBtn: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.09)', gap: 4, minWidth: 72,
  },
  typeBtnActive: { backgroundColor: GREEN + '20', borderColor: GREEN },
  typeEmoji: { fontSize: 22 },
  typeLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  typeLabelActive: { color: GREEN },

  bikeRoleWrap: { flexDirection: 'row', gap: 10, marginTop: 12 },
  bikeRoleCard: {
    flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.09)',
  },
  bikeRoleCardActive: { backgroundColor: GREEN + '18', borderColor: GREEN },
  bikeRoleEmoji: { fontSize: 24 },
  bikeRoleLabel: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  bikeRoleLabelActive: { color: GREEN },
  bikeRoleSub: { fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 10,
  },
  input: { flex: 1, color: '#FFF', fontSize: 15 },
  rupeeSign: { fontSize: 15, color: GREEN, fontWeight: '700' },

  inputBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 10,
  },
  textArea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },

  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  suggestions: {
    backgroundColor: '#141920', borderRadius: 12, marginTop: -4, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', overflow: 'hidden',
  },
  suggItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  suggBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggText: { flex: 1, color: '#FFF', fontSize: 13 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: { borderColor: GREEN, backgroundColor: GREEN + '18' },
  chipActivePurple: { borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.15)' },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  chipTextActive: { color: GREEN },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.09)',
  },
  toggleCardActive: { borderColor: GREEN + '50', backgroundColor: GREEN + '0A' },
  toggleIcon: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 16 },

  // Partner section
  partnerSection: {
    marginTop: 16,
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.2)',
  },
  partnerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  partnerHeaderText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#A78BFA' },
  partnerDetails: { marginTop: 16, gap: 4 },
  partnerLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(167,139,250,0.7)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 8,
  },

  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  genderChip: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  genderChipActive: { borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.2)' },
  genderEmoji: { fontSize: 22 },
  genderLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  genderLabelActive: { color: '#A78BFA' },

  slotsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  slotChip: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(167,139,250,0.2)',
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  slotChipActive: { borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.2)' },
  slotText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  slotTextActive: { color: '#A78BFA' },

  partnerSummary: {
    flexDirection: 'row', gap: 6, alignItems: 'flex-start',
    backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 10, padding: 10, marginTop: 8,
  },
  partnerSummaryText: { flex: 1, fontSize: 11, color: 'rgba(167,139,250,0.7)', lineHeight: 16 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN, borderRadius: 16,
    paddingVertical: 17, marginTop: 24, gap: 8,
  },
  createBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 0.3 },

  publicNote: {
    marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', lineHeight: 17, paddingHorizontal: 8,
  },

  // Date picker
  dateTap: { justifyContent: 'flex-start', gap: 8 },
  dateTapText: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  datePlaceholder: { color: 'rgba(255,255,255,0.25)', fontWeight: '400' },

  calModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  calModal: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32, overflow: 'hidden',
  },
  calHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  calTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  calSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 12,
    backgroundColor: 'rgba(140,198,63,0.1)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  calSummaryText: { fontSize: 13, fontWeight: '700', color: GREEN },

  // Photos
  sublabelMuted: { color: 'rgba(255,255,255,0.25)', fontWeight: '400', fontSize: 10 },
  photosRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 6,
  },
  photoThumb: {
    width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative',
  },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemoveIcon: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10,
  },
  photoAddSlot: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoAddText: {
    fontSize: 10, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 13,
  },
  photoHint: {
    fontSize: 11, color: 'rgba(255,255,255,0.28)',
    lineHeight: 16, marginBottom: 4,
  },
});
