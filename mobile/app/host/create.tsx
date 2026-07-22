import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Modal, Pressable, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { uploadMedia } from '@/lib/storage';
import { uploadHomestayPhoto } from '@/lib/services/MediaService';
import { useAuthStore } from '@/stores/authStore';
import { searchPlaces, GeocodeResult } from '@/lib/geocoding';
import MapPickerModal from '@/components/MapPickerModal';
import LocationPicker, { getStateCenter } from '@/components/LocationPicker';
import PhoneInput from '@/components/PhoneInput';
import { AppColors } from '@/constants/theme';

const GREEN = AppColors.primary;
const BG = AppColors.background;

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_LABELS = ['Property', 'Rooms', 'Contact', 'Terms'];

const PROPERTY_TYPES = [
  { id: 'private_room', label: 'Private Room', emoji: '🏠' },
  { id: 'entire_home', label: 'Entire Home', emoji: '🏡' },
  { id: 'villa', label: 'Villa / Bungalow', emoji: '🏰' },
  { id: 'dormitory', label: 'Dormitory / Hostel', emoji: '🛏️' },
  { id: 'tent_camping', label: 'Tent / Camping', emoji: '⛺' },
  { id: 'treehouse', label: 'Treehouse', emoji: '🌳' },
  { id: 'farmstay', label: 'Farmstay', emoji: '🌾' },
  { id: 'heritage_home', label: 'Heritage Home', emoji: '🏛️' },
];

const AMENITIES = [
  { id: 'wifi', label: 'WiFi', emoji: '📶' },
  { id: 'parking', label: 'Parking', emoji: '🚗' },
  { id: 'pool', label: 'Swimming Pool', emoji: '🏊' },
  { id: 'kitchen', label: 'Kitchen Access', emoji: '🍳' },
  { id: 'restaurant', label: 'Restaurant/Meals', emoji: '🍽️' },
  { id: 'hot_water', label: 'Hot Water', emoji: '🚿' },
  { id: 'ac', label: 'Air Conditioning', emoji: '❄️' },
  { id: 'heater', label: 'Heater', emoji: '🔥' },
  { id: 'laundry', label: 'Laundry', emoji: '👕' },
  { id: 'garden', label: 'Garden', emoji: '🌿' },
  { id: 'bonfire', label: 'Bonfire Area', emoji: '🔥' },
  { id: 'trekking_access', label: 'Trekking Access', emoji: '🥾' },
  { id: 'pet_friendly', label: 'Pet Friendly', emoji: '🐾' },
  { id: 'airport_pickup', label: 'Airport Pickup', emoji: '🚐' },
  { id: 'ev_charging', label: 'EV Charging', emoji: '⚡' },
  { id: 'first_aid', label: 'First Aid Kit', emoji: '🏥' },
];

const CHECKIN_TIMES = ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const CHECKOUT_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00'];

const CANCELLATION_POLICIES: { id: string; label: string; emoji: string; desc: string }[] = [
  { id: 'flexible', label: 'Flexible', emoji: '🟢', desc: 'Full refund if cancelled 24 hours before check-in' },
  { id: 'moderate', label: 'Moderate', emoji: '🟡', desc: 'Full refund if cancelled 5 days before check-in. 50% refund after that.' },
  { id: 'strict', label: 'Strict', emoji: '🔴', desc: '50% refund if cancelled 7 days before check-in. No refund after that.' },
  { id: 'non_refundable', label: 'Non-refundable', emoji: '⛔', desc: 'No refund on cancellation. Lower price attracts more bookings.' },
];

const OTHER_COUNTRIES = ['Nepal', 'Bhutan', 'Philippines', 'Indonesia', 'Cambodia'];

const ROOM_CATEGORIES = [
  { id: 'private_room', label: 'Private Room' },
  { id: 'shared_room', label: 'Shared Room' },
  { id: 'entire_unit', label: 'Entire Unit/Apartment' },
  { id: 'dormitory', label: 'Dormitory Bed' },
  { id: 'tent', label: 'Tent Site' },
  { id: 'villa_suite', label: 'Villa Suite' },
  { id: 'treehouse', label: 'Treehouse' },
];

const BED_TYPES = ['single', 'double', 'queen', 'king', 'bunk', 'sofa_bed'];
const BED_TYPE_LABELS: Record<string, string> = {
  single: 'Single', double: 'Double', queen: 'Queen', king: 'King', bunk: 'Bunk', sofa_bed: 'Sofa Bed',
};

const BATHROOM_TYPES = [
  { id: 'attached', label: 'Attached/Private' },
  { id: 'shared', label: 'Shared' },
  { id: 'ensuite', label: 'En-suite' },
];

const ROOM_AMENITIES = [
  { id: 'ac', label: 'AC', emoji: '❄️' },
  { id: 'tv', label: 'TV', emoji: '📺' },
  { id: 'wifi', label: 'WiFi', emoji: '📶' },
  { id: 'mini_fridge', label: 'Mini Fridge', emoji: '🧊' },
  { id: 'wardrobe', label: 'Wardrobe', emoji: '👔' },
  { id: 'balcony', label: 'Balcony', emoji: '🌇' },
  { id: 'mountain_view', label: 'Mountain View', emoji: '🏔️' },
  { id: 'forest_view', label: 'Forest View', emoji: '🌲' },
  { id: 'hot_water', label: 'Hot Water', emoji: '🚿' },
  { id: 'hair_dryer', label: 'Hair Dryer', emoji: '💨' },
  { id: 'safe', label: 'Safe', emoji: '🔒' },
  { id: 'desk', label: 'Work Desk', emoji: '🖥️' },
  { id: 'bathtub', label: 'Bathtub', emoji: '🛁' },
  { id: 'seating_area', label: 'Seating Area', emoji: '🛋️' },
  { id: 'kitchenette', label: 'Kitchenette', emoji: '🍳' },
];

const ID_DOC_TYPES = [
  { id: 'aadhaar', label: 'Aadhaar Card' },
  { id: 'voter_id', label: 'Voter ID' },
  { id: 'driving_licence', label: 'Driving Licence' },
  { id: 'passport', label: 'Passport' },
];

const OWNERSHIP_PROOF_TYPES = [
  { id: 'electricity_bill', label: 'Electricity/Water Bill' },
  { id: 'property_tax', label: 'Property Tax Receipt' },
  { id: 'rental_agreement', label: 'Rental Agreement' },
  { id: 'noc', label: 'NOC from Owner' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Types ───────────────────────────────────────────────────────────────────

type BedEntry = { type: string; count: number };
type PeriodEntry = { name?: string; start: string; end: string };

type RoomType = {
  id: string; // local key
  name: string;
  roomCategory: string;
  description: string;
  maxOccupancy: number;
  baseOccupancy: number;
  extraGuestCharge: string;
  totalUnits: number;
  beds: BedEntry[];
  bathroomType: string;
  amenities: string[];
  photoUris: string[];
  photoUrls: string[];
  basePrice: string;
  weekendEnabled: boolean;
  weekendPrice: string;
  peakEnabled: boolean;
  peakPrice: string;
  peakPeriods: PeriodEntry[];
  offEnabled: boolean;
  offPrice: string;
  offPeriods: PeriodEntry[];
  minNights: number;
  minNightsWeekend: number;
  minNightsPeak: number;
};

function newRoomType(): RoomType {
  return {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '', roomCategory: 'private_room', description: '',
    maxOccupancy: 2, baseOccupancy: 2, extraGuestCharge: '0', totalUnits: 1,
    beds: [], bathroomType: 'attached', amenities: [],
    photoUris: [], photoUrls: [],
    basePrice: '', weekendEnabled: false, weekendPrice: '',
    peakEnabled: false, peakPrice: '', peakPeriods: [],
    offEnabled: false, offPrice: '', offPeriods: [],
    minNights: 1, minNightsWeekend: 1, minNightsPeak: 2,
  };
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CreatePropertyScreen() {
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: Property details ──
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [name, setName] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locSuggestions, setLocSuggestions] = useState<GeocodeResult[]>([]);
  const [locSearching, setLocSearching] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const locSearchTimeout = useRef<any>(null);

  const [checkinTime, setCheckinTime] = useState('14:00');
  const [checkoutTime, setCheckoutTime] = useState('11:00');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [partiesAllowed, setPartiesAllowed] = useState(false);
  const [childrenAllowed, setChildrenAllowed] = useState(true);
  const [cancellationPolicy, setCancellationPolicy] = useState('moderate');

  const country = OTHER_COUNTRIES.includes(state) ? state : 'India';

  // ── Step 2: Room types ──
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoomType>(newRoomType());
  const [bedTypeToAdd, setBedTypeToAdd] = useState('single');
  const [roomPhotoUploading, setRoomPhotoUploading] = useState(false);
  const [peakDraft, setPeakDraft] = useState({ name: '', start: '', end: '' });
  const [offDraft, setOffDraft] = useState({ start: '', end: '' });

  // ── Step 3: Contact & verification ──
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPhoneCode, setContactPhoneCode] = useState('+91');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactWhatsappCode, setContactWhatsappCode] = useState('+91');
  const [contactEmail, setContactEmail] = useState('');

  const [idDocType, setIdDocType] = useState('');
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [idUploading, setIdUploading] = useState<'front' | 'back' | null>(null);

  const [ownershipProofType, setOwnershipProofType] = useState('');
  const [ownershipProofUri, setOwnershipProofUri] = useState<string | null>(null);
  const [ownershipProofUrl, setOwnershipProofUrl] = useState<string | null>(null);
  const [ownershipUploading, setOwnershipUploading] = useState(false);

  // ── Step 4: Terms ──
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAccuracy, setAgreeAccuracy] = useState(false);
  const [agreeResponse, setAgreeResponse] = useState(false);

  // ─── Property Photos ────────────────────────────────────────────────────

  const pickPropertyPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to upload property photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10 - photoUris.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length) {
      const assets = result.assets.slice(0, 10 - photoUris.length);
      const uris = assets.map(a => a.uri);
      setPhotoUris(prev => [...prev, ...uris]);
      setPhotoUrls(prev => [...prev, ...uris.map(() => null)]);
      uploadPropertyPhotos(uris, photoUris.length);
    }
  };

  const uploadPropertyPhotos = async (uris: string[], startIdx: number) => {
    setPhotoUploading(true);
    try {
      for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const url = await uploadHomestayPhoto(user?.id || '', uri, `image/${ext}`);
        if (!url) throw new Error('Failed to upload photo');
        setPhotoUrls(prev => {
          const next = [...prev];
          next[startIdx + i] = url;
          return next;
        });
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload one or more photos');
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePropertyPhoto = (idx: number) => {
    setPhotoUris(prev => prev.filter((_, i) => i !== idx));
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Location Search ──────────────────────────────────────────────────────

  const handleLocSearch = (text: string) => {
    setAddress(text);
    if (locSearchTimeout.current) clearTimeout(locSearchTimeout.current);
    if (text.length < 3) { setLocSuggestions([]); return; }
    setLocSearching(true);
    locSearchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(text, getStateCenter(state));
      setLocSuggestions(results);
      setLocSearching(false);
    }, 500);
  };

  const selectLocSuggestion = (place: GeocodeResult) => {
    setAddress(place.place_name);
    setLocationName(place.place_name);
    setCoords({ lat: place.center[1], lng: place.center[0] });
    setLocSuggestions([]);
  };

  const toggleArrayItem = (arr: string[], setArr: (v: string[]) => void, id: string) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  // ─── Step validation ──────────────────────────────────────────────────────

  const validateStep1 = (): string | null => {
    if (photoUrls.filter(Boolean).length < 3) return 'Add at least 3 property photos.';
    if (photoUploading) return 'Please wait for photos to finish uploading.';
    if (!name.trim()) return 'Enter your property name.';
    if (propertyTypes.length === 0) return 'Select at least one property type.';
    if (description.trim().length < 150) return 'Description must be at least 150 characters.';
    if (!address.trim()) return 'Enter the property address.';
    if (!city.trim()) return 'Enter the city.';
    if (!state) return 'Select a state.';
    if (!coords) return 'Pin the exact location on the map.';
    return null;
  };

  const validateStep2 = (): string | null => {
    if (roomTypes.length === 0) return 'Add at least one room type.';
    return null;
  };

  const validateStep3 = (): string | null => {
    if (!contactName.trim()) return 'Enter a contact name.';
    if (!contactPhone.trim()) return 'Enter a contact phone number.';
    if (!contactEmail.trim()) return 'Enter a contact email.';
    if (!idDocType) return 'Select an identity document type.';
    if (!idFrontUri) return 'Upload the front of your identity document.';
    if (!idBackUri) return 'Upload the back of your identity document.';
    if (idUploading) return 'Please wait for documents to finish uploading.';
    return null;
  };

  const goNext = () => {
    const err = step === 0 ? validateStep1() : step === 1 ? validateStep2() : validateStep3();
    if (err) { Alert.alert('Required', err); return; }
    setStep(s => Math.min(3, s + 1));
  };
  const goBack = () => setStep(s => Math.max(0, s - 1));

  // ─── Room type modal ──────────────────────────────────────────────────────

  const openAddRoom = () => {
    setEditingRoomId(null);
    setDraft(newRoomType());
    setPeakDraft({ name: '', start: '', end: '' });
    setOffDraft({ start: '', end: '' });
    setShowRoomModal(true);
  };

  const openEditRoom = (rt: RoomType) => {
    setEditingRoomId(rt.id);
    setDraft({ ...rt });
    setPeakDraft({ name: '', start: '', end: '' });
    setOffDraft({ start: '', end: '' });
    setShowRoomModal(true);
  };

  const removeRoomType = (id: string) => {
    setRoomTypes(prev => prev.filter(r => r.id !== id));
  };

  const addBedToDraft = () => {
    setDraft(d => {
      const existing = d.beds.find(b => b.type === bedTypeToAdd);
      if (existing) {
        return { ...d, beds: d.beds.map(b => b.type === bedTypeToAdd ? { ...b, count: b.count + 1 } : b) };
      }
      return { ...d, beds: [...d.beds, { type: bedTypeToAdd, count: 1 }] };
    });
  };

  const removeBedFromDraft = (type: string) => {
    setDraft(d => ({ ...d, beds: d.beds.filter(b => b.type !== type) }));
  };

  const pickRoomPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: 8 - draft.photoUris.length, quality: 0.8,
    });
    if (!result.canceled && result.assets.length) {
      const uris = result.assets.slice(0, 8 - draft.photoUris.length).map(a => a.uri);
      const startIdx = draft.photoUris.length;
      setDraft(d => ({ ...d, photoUris: [...d.photoUris, ...uris], photoUrls: [...d.photoUrls, ...uris.map(() => '')] }));
      setRoomPhotoUploading(true);
      try {
        for (let i = 0; i < uris.length; i++) {
          const uri = uris[i];
          const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
          const url = await uploadHomestayPhoto(user?.id || '', uri, `image/${ext}`);
          if (!url) throw new Error('Failed to upload photo');
          setDraft(d => {
            const next = [...d.photoUrls];
            next[startIdx + i] = url;
            return { ...d, photoUrls: next };
          });
        }
      } catch (e: any) {
        Alert.alert('Upload Error', e.message || 'Failed to upload room photos');
      } finally {
        setRoomPhotoUploading(false);
      }
    }
  };

  const removeRoomPhoto = (idx: number) => {
    setDraft(d => ({
      ...d,
      photoUris: d.photoUris.filter((_, i) => i !== idx),
      photoUrls: d.photoUrls.filter((_, i) => i !== idx),
    }));
  };

  const addPeakPeriod = () => {
    if (!peakDraft.name.trim() || !DATE_RE.test(peakDraft.start) || !DATE_RE.test(peakDraft.end)) {
      Alert.alert('Required', 'Enter a period name and valid dates (YYYY-MM-DD).');
      return;
    }
    setDraft(d => ({ ...d, peakPeriods: [...d.peakPeriods, { ...peakDraft }] }));
    setPeakDraft({ name: '', start: '', end: '' });
  };
  const removePeakPeriod = (idx: number) => setDraft(d => ({ ...d, peakPeriods: d.peakPeriods.filter((_, i) => i !== idx) }));

  const addOffPeriod = () => {
    if (!DATE_RE.test(offDraft.start) || !DATE_RE.test(offDraft.end)) {
      Alert.alert('Required', 'Enter valid dates (YYYY-MM-DD).');
      return;
    }
    setDraft(d => ({ ...d, offPeriods: [...d.offPeriods, { ...offDraft }] }));
    setOffDraft({ start: '', end: '' });
  };
  const removeOffPeriod = (idx: number) => setDraft(d => ({ ...d, offPeriods: d.offPeriods.filter((_, i) => i !== idx) }));

  const saveRoomType = () => {
    if (!draft.name.trim()) { Alert.alert('Required', 'Enter a room name.'); return; }
    if (!draft.basePrice.trim() || isNaN(Number(draft.basePrice)) || Number(draft.basePrice) <= 0) {
      Alert.alert('Required', 'Enter a valid base price.'); return;
    }
    if (roomPhotoUploading) { Alert.alert('Please wait', 'Room photos are still uploading.'); return; }

    if (editingRoomId) {
      setRoomTypes(prev => prev.map(r => r.id === editingRoomId ? draft : r));
    } else {
      setRoomTypes(prev => [...prev, draft]);
    }
    setShowRoomModal(false);
  };

  // ─── Document uploads (Step 3) ─────────────────────────────────────────────

  const pickDocPhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      if (side === 'front') setIdFrontUri(uri); else setIdBackUri(uri);
      setIdUploading(side);
      try {
        const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user?.id}/property/id_${side}_${Date.now()}.${ext}`;
        const uploaded = await uploadMedia('guide-documents', path, uri, `image/${ext}`);
        if (!uploaded) throw new Error('Failed to upload document');
        const { data } = await supabase.storage.from('guide-documents').createSignedUrl(path, 7200);
        if (side === 'front') setIdFrontUrl(data?.signedUrl || null);
        else setIdBackUrl(data?.signedUrl || null);
      } catch (e: any) {
        Alert.alert('Upload Error', e.message || 'Failed to upload document');
        if (side === 'front') setIdFrontUri(null); else setIdBackUri(null);
      } finally {
        setIdUploading(null);
      }
    }
  };

  const pickOwnershipProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setOwnershipProofUri(uri);
      setOwnershipUploading(true);
      try {
        const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user?.id}/property/ownership_${Date.now()}.${ext}`;
        const uploaded = await uploadMedia('guide-documents', path, uri, `image/${ext}`);
        if (!uploaded) throw new Error('Failed to upload proof');
        const { data } = await supabase.storage.from('guide-documents').createSignedUrl(path, 7200);
        setOwnershipProofUrl(data?.signedUrl || null);
      } catch (e: any) {
        Alert.alert('Upload Error', e.message || 'Failed to upload proof');
        setOwnershipProofUri(null);
      } finally {
        setOwnershipUploading(false);
      }
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!agreeTerms || !agreeAccuracy || !agreeResponse) {
      Alert.alert('Required', 'Please accept all three agreements to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from('properties')
        .select('id, status')
        .eq('owner_id', user?.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        Alert.alert(
          'Application Pending',
          'You already have a property application under review.',
          [{ text: 'View Status', onPress: () => router.replace(`/host/status?id=${existing.id}` as any) }]
        );
        return;
      }

      const cleanPhotoUrls = photoUrls.filter(Boolean) as string[];

      const { data: property, error } = await supabase.from('properties').insert({
        owner_id: user?.id,
        name: name.trim(),
        description: description.trim(),
        property_type: propertyTypes,
        address: address.trim(),
        city: city.trim(),
        state,
        district: district || null,
        country,
        pincode: pincode.trim() || null,
        lat: coords?.lat,
        lng: coords?.lng,
        location_name: locationName || address.trim(),
        checkin_time: checkinTime,
        checkout_time: checkoutTime,
        amenities,
        smoking_allowed: smokingAllowed,
        pets_allowed: petsAllowed,
        parties_allowed: partiesAllowed,
        children_allowed: childrenAllowed,
        cancellation_policy: cancellationPolicy,
        contact_phone: `${contactPhoneCode}${contactPhone.trim()}`,
        contact_whatsapp: contactWhatsapp.trim() ? `${contactWhatsappCode}${contactWhatsapp.trim()}` : `${contactPhoneCode}${contactPhone.trim()}`,
        contact_email: contactEmail.trim(),
        identity_doc_type: idDocType,
        identity_doc_front_url: idFrontUrl,
        identity_doc_back_url: idBackUrl,
        ownership_proof_type: ownershipProofType || null,
        ownership_proof_url: ownershipProofUrl,
        cover_photo_url: cleanPhotoUrls[0] || null,
        photos: cleanPhotoUrls,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        commission_rate: 15,
        status: 'pending',
      }).select('id').single();

      if (error) throw error;

      const roomPayload = roomTypes.map(rt => ({
        property_id: property.id,
        name: rt.name.trim(),
        room_category: rt.roomCategory,
        description: rt.description.trim(),
        max_occupancy: rt.maxOccupancy,
        base_occupancy: rt.baseOccupancy,
        extra_guest_charge: parseFloat(rt.extraGuestCharge) || 0,
        total_units: rt.totalUnits,
        beds: rt.beds,
        bathroom_type: rt.bathroomType,
        amenities: rt.amenities,
        photos: rt.photoUrls.filter(Boolean),
        base_price: parseFloat(rt.basePrice),
        weekend_price_enabled: rt.weekendEnabled,
        weekend_price: parseFloat(rt.weekendPrice) || 0,
        peak_season_enabled: rt.peakEnabled,
        peak_price: parseFloat(rt.peakPrice) || 0,
        peak_seasons: rt.peakPeriods,
        off_season_enabled: rt.offEnabled,
        off_season_price: parseFloat(rt.offPrice) || 0,
        off_season_periods: rt.offPeriods,
        min_nights: rt.minNights,
        min_nights_weekend: rt.minNightsWeekend,
        min_nights_peak: rt.minNightsPeak,
        is_available: true,
      }));

      const { error: roomErr } = await supabase.from('room_types').insert(roomPayload);
      if (roomErr) throw roomErr;

      // 'system' isn't a valid notifications.type (see notifications_type_check) —
      // this insert was silently failing on every submission. 'ready_for_review'
      // is the same "something needs staff attention" event the Review
      // Resolution workflow already uses for a partner's resubmission.
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins?.length) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.id,
            title: 'New Property Application',
            message: `${name.trim()} has applied for property listing approval.`,
            type: 'ready_for_review',
            related_id: property.id,
          }))
        );
      }

      router.replace(`/host/status?id=${property.id}` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => (step === 0 ? (router.canGoBack() ? router.back() : router.replace('/(tabs)')) : goBack())}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>List Your Property</Text>
          <Text style={s.headerSub}>Step {step + 1} of 4 — {STEP_LABELS[step]}</Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={s.stepRow}>
        {STEP_LABELS.map((label, i) => (
          <View key={label} style={s.stepItem}>
            <View style={[s.stepDot, i <= step && s.stepDotActive]}>
              {i < step
                ? <Ionicons name="checkmark" size={12} color="#000" />
                : <Text style={[s.stepDotText, i <= step && s.stepDotTextActive]}>{i + 1}</Text>}
            </View>
            {i < STEP_LABELS.length - 1 && <View style={[s.stepConnector, i < step && s.stepConnectorActive]} />}
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {step === 0 && (
            <Step1
              photoUris={photoUris} photoUrls={photoUrls} photoUploading={photoUploading}
              onPickPhotos={pickPropertyPhotos} onRemovePhoto={removePropertyPhoto}
              name={name} setName={setName}
              propertyTypes={propertyTypes} onToggleType={(id: string) => toggleArrayItem(propertyTypes, setPropertyTypes, id)}
              description={description} setDescription={setDescription}
              address={address} onAddressChange={handleLocSearch}
              locSuggestions={locSuggestions} locSearching={locSearching} onSelectSuggestion={selectLocSuggestion}
              city={city} setCity={setCity}
              state={state} district={district}
              onLocationChange={(v: { state: string; district: string }) => { setState(v.state); setDistrict(v.district); }}
              country={country}
              pincode={pincode} setPincode={setPincode}
              coords={coords} onOpenMap={() => setShowMapPicker(true)}
              checkinTime={checkinTime} setCheckinTime={setCheckinTime}
              checkoutTime={checkoutTime} setCheckoutTime={setCheckoutTime}
              amenities={amenities} onToggleAmenity={(id: string) => toggleArrayItem(amenities, setAmenities, id)}
              smokingAllowed={smokingAllowed} setSmokingAllowed={setSmokingAllowed}
              petsAllowed={petsAllowed} setPetsAllowed={setPetsAllowed}
              partiesAllowed={partiesAllowed} setPartiesAllowed={setPartiesAllowed}
              childrenAllowed={childrenAllowed} setChildrenAllowed={setChildrenAllowed}
              cancellationPolicy={cancellationPolicy} setCancellationPolicy={setCancellationPolicy}
            />
          )}

          {step === 1 && (
            <Step2 roomTypes={roomTypes} onAdd={openAddRoom} onEdit={openEditRoom} onRemove={removeRoomType} />
          )}

          {step === 2 && (
            <Step3
              contactName={contactName} setContactName={setContactName}
              contactPhone={contactPhone} setContactPhone={setContactPhone}
              contactPhoneCode={contactPhoneCode} setContactPhoneCode={setContactPhoneCode}
              contactWhatsapp={contactWhatsapp} setContactWhatsapp={setContactWhatsapp}
              contactWhatsappCode={contactWhatsappCode} setContactWhatsappCode={setContactWhatsappCode}
              contactEmail={contactEmail} setContactEmail={setContactEmail}
              idDocType={idDocType} setIdDocType={setIdDocType}
              idFrontUri={idFrontUri} idFrontUrl={idFrontUrl}
              idBackUri={idBackUri} idBackUrl={idBackUrl}
              idUploading={idUploading}
              onPickDoc={pickDocPhoto}
              onRemoveFront={() => { setIdFrontUri(null); setIdFrontUrl(null); }}
              onRemoveBack={() => { setIdBackUri(null); setIdBackUrl(null); }}
              ownershipProofType={ownershipProofType} setOwnershipProofType={setOwnershipProofType}
              ownershipProofUri={ownershipProofUri} ownershipUploading={ownershipUploading}
              onPickOwnership={pickOwnershipProof}
              onRemoveOwnership={() => { setOwnershipProofUri(null); setOwnershipProofUrl(null); }}
            />
          )}

          {step === 3 && (
            <Step4
              roomCount={roomTypes.length}
              agreeTerms={agreeTerms} setAgreeTerms={setAgreeTerms}
              agreeAccuracy={agreeAccuracy} setAgreeAccuracy={setAgreeAccuracy}
              agreeResponse={agreeResponse} setAgreeResponse={setAgreeResponse}
            />
          )}

          {/* Nav buttons */}
          <View style={s.navRow}>
            {step > 0 && (
              <TouchableOpacity style={s.backNavBtn} onPress={goBack}>
                <Ionicons name="arrow-back" size={16} color={GREEN} />
                <Text style={s.backNavBtnText}>BACK</Text>
              </TouchableOpacity>
            )}
            {step < 3 ? (
              <TouchableOpacity style={[s.nextBtn, step === 0 && { flex: 1 }]} onPress={goNext} activeOpacity={0.85}>
                <Text style={s.nextBtnText}>NEXT</Text>
                <Ionicons name="arrow-forward" size={16} color="#000" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.submitBtn, (!agreeTerms || !agreeAccuracy || !agreeResponse || submitting) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!agreeTerms || !agreeAccuracy || !agreeResponse || submitting}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#000" />
                    <Text style={s.submitBtnText}>SUBMIT FOR REVIEW</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MapPickerModal
        visible={showMapPicker}
        initialLat={coords?.lat}
        initialLng={coords?.lng}
        onConfirm={(loc) => { setCoords({ lat: loc.lat, lng: loc.lng }); setShowMapPicker(false); }}
        onClose={() => setShowMapPicker(false)}
      />

      {/* Room Type Editor Modal */}
      <Modal visible={showRoomModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <SafeAreaView style={s.modalSheet} edges={['bottom']}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingRoomId ? 'Edit Room Type' : 'Add Room Type'}</Text>
              <TouchableOpacity onPress={() => setShowRoomModal(false)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '100%' }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Text style={s.label}>Room Name *</Text>
              <TextInput
                style={s.input} placeholder='e.g. "Deluxe Double Room"' placeholderTextColor="#555"
                value={draft.name} onChangeText={(v) => setDraft(d => ({ ...d, name: v }))}
              />

              <Text style={s.label}>Room Category</Text>
              <View style={s.chipGrid}>
                {ROOM_CATEGORIES.map(c => (
                  <Pressable key={c.id} style={[s.smallChip, draft.roomCategory === c.id && s.smallChipActive]}
                    onPress={() => setDraft(d => ({ ...d, roomCategory: c.id }))}>
                    <Text style={[s.smallChipText, draft.roomCategory === c.id && s.smallChipTextActive]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, s.textArea]} placeholder="Describe this room type..." placeholderTextColor="#555"
                value={draft.description} onChangeText={(v) => setDraft(d => ({ ...d, description: v }))}
                multiline textAlignVertical="top"
              />

              <Text style={s.label}>Bed Configuration</Text>
              {draft.beds.map(b => (
                <View key={b.type} style={s.bedRow}>
                  <Text style={s.bedRowText}>{BED_TYPE_LABELS[b.type]} × {b.count}</Text>
                  <TouchableOpacity onPress={() => removeBedFromDraft(b.type)}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={s.addBedRow}>
                <View style={s.chipGrid}>
                  {BED_TYPES.map(t => (
                    <Pressable key={t} style={[s.smallChip, bedTypeToAdd === t && s.smallChipActive]} onPress={() => setBedTypeToAdd(t)}>
                      <Text style={[s.smallChipText, bedTypeToAdd === t && s.smallChipTextActive]}>{BED_TYPE_LABELS[t]}</Text>
                    </Pressable>
                  ))}
                </View>
                <TouchableOpacity style={s.addBedBtn} onPress={addBedToDraft}>
                  <Ionicons name="add" size={16} color="#000" />
                  <Text style={s.addBedBtnText}>Add bed type</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Bathroom</Text>
              <View style={s.chipGrid}>
                {BATHROOM_TYPES.map(b => (
                  <Pressable key={b.id} style={[s.smallChip, draft.bathroomType === b.id && s.smallChipActive]}
                    onPress={() => setDraft(d => ({ ...d, bathroomType: b.id }))}>
                    <Text style={[s.smallChipText, draft.bathroomType === b.id && s.smallChipTextActive]}>{b.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.stepperRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Max Occupancy</Text>
                  <Stepper value={draft.maxOccupancy} onChange={(v) => setDraft(d => ({ ...d, maxOccupancy: v }))} min={1} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Base Occupancy</Text>
                  <Stepper value={draft.baseOccupancy} onChange={(v) => setDraft(d => ({ ...d, baseOccupancy: v }))} min={1} />
                </View>
              </View>

              <Text style={s.label}>Extra Guest Charge (₹/night, above base occupancy)</Text>
              <TextInput
                style={s.input} placeholder="0" placeholderTextColor="#555" keyboardType="numeric"
                value={draft.extraGuestCharge} onChangeText={(v) => setDraft(d => ({ ...d, extraGuestCharge: v }))}
              />

              <Text style={s.label}>Total Units of This Type</Text>
              <Stepper value={draft.totalUnits} onChange={(v) => setDraft(d => ({ ...d, totalUnits: v }))} min={1} />

              <Text style={[s.label, { marginTop: 16 }]}>Room Photos</Text>
              <View style={s.thumbGrid}>
                {draft.photoUris.map((uri, idx) => (
                  <View key={idx} style={s.thumbWrap}>
                    <Image source={{ uri }} style={s.thumb} contentFit="cover" />
                    {!draft.photoUrls[idx] && (
                      <View style={s.thumbOverlay}><ActivityIndicator size="small" color={GREEN} /></View>
                    )}
                    <TouchableOpacity style={s.thumbRemove} onPress={() => removeRoomPhoto(idx)}>
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {draft.photoUris.length < 8 && (
                  <TouchableOpacity style={s.thumbAdd} onPress={pickRoomPhotos}>
                    <Ionicons name="camera-outline" size={22} color={GREEN} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[s.label, { marginTop: 16 }]}>Room Amenities</Text>
              <View style={s.chipGrid}>
                {ROOM_AMENITIES.map(a => {
                  const active = draft.amenities.includes(a.id);
                  return (
                    <Pressable key={a.id} style={[s.specChip, active && s.specChipActive]}
                      onPress={() => setDraft(d => ({ ...d, amenities: active ? d.amenities.filter(x => x !== a.id) : [...d.amenities, a.id] }))}>
                      <Text style={s.specEmoji}>{a.emoji}</Text>
                      <Text style={[s.specLabel, active && s.specLabelActive]}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={s.pricingDivider}><Text style={s.pricingDividerText}>PRICING</Text></View>

              <Text style={s.label}>Base Price (₹/night) *</Text>
              <Text style={s.subHint}>Your default weekday price</Text>
              <TextInput
                style={s.input} placeholder="e.g. 2500" placeholderTextColor="#555" keyboardType="numeric"
                value={draft.basePrice} onChangeText={(v) => setDraft(d => ({ ...d, basePrice: v }))}
              />

              <ToggleRow
                label="Weekend Pricing (Fri, Sat)"
                value={draft.weekendEnabled}
                onChange={(v) => setDraft(d => ({ ...d, weekendEnabled: v }))}
              />
              {draft.weekendEnabled && (
                <TextInput
                  style={s.input} placeholder="Weekend price per night" placeholderTextColor="#555" keyboardType="numeric"
                  value={draft.weekendPrice} onChangeText={(v) => setDraft(d => ({ ...d, weekendPrice: v }))}
                />
              )}

              <ToggleRow
                label="Peak Season Pricing"
                value={draft.peakEnabled}
                onChange={(v) => setDraft(d => ({ ...d, peakEnabled: v }))}
              />
              {draft.peakEnabled && (
                <>
                  <TextInput
                    style={s.input} placeholder="Peak season price per night" placeholderTextColor="#555" keyboardType="numeric"
                    value={draft.peakPrice} onChangeText={(v) => setDraft(d => ({ ...d, peakPrice: v }))}
                  />
                  {draft.peakPeriods.map((p, idx) => (
                    <View key={idx} style={s.periodTag}>
                      <Text style={s.periodTagText}>{p.name}: {p.start} → {p.end}</Text>
                      <TouchableOpacity onPress={() => removePeakPeriod(idx)}>
                        <Ionicons name="close" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={s.periodForm}>
                    <TextInput style={[s.input, s.periodInput]} placeholder="Name e.g. Diwali Week" placeholderTextColor="#555"
                      value={peakDraft.name} onChangeText={(v) => setPeakDraft(p => ({ ...p, name: v }))} />
                    <View style={s.periodDateRow}>
                      <TextInput style={[s.input, s.periodInput, { flex: 1 }]} placeholder="Start YYYY-MM-DD" placeholderTextColor="#555"
                        value={peakDraft.start} onChangeText={(v) => setPeakDraft(p => ({ ...p, start: v }))} />
                      <TextInput style={[s.input, s.periodInput, { flex: 1 }]} placeholder="End YYYY-MM-DD" placeholderTextColor="#555"
                        value={peakDraft.end} onChangeText={(v) => setPeakDraft(p => ({ ...p, end: v }))} />
                    </View>
                    <TouchableOpacity style={s.addPeriodBtn} onPress={addPeakPeriod}>
                      <Ionicons name="add-circle-outline" size={16} color={GREEN} />
                      <Text style={s.addPeriodBtnText}>Add peak period</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <ToggleRow
                label="Off-Season Pricing"
                value={draft.offEnabled}
                onChange={(v) => setDraft(d => ({ ...d, offEnabled: v }))}
              />
              {draft.offEnabled && (
                <>
                  <TextInput
                    style={s.input} placeholder="Off-season price per night" placeholderTextColor="#555" keyboardType="numeric"
                    value={draft.offPrice} onChangeText={(v) => setDraft(d => ({ ...d, offPrice: v }))}
                  />
                  {draft.offPeriods.map((p, idx) => (
                    <View key={idx} style={s.periodTag}>
                      <Text style={s.periodTagText}>{p.start} → {p.end}</Text>
                      <TouchableOpacity onPress={() => removeOffPeriod(idx)}>
                        <Ionicons name="close" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <View style={s.periodForm}>
                    <View style={s.periodDateRow}>
                      <TextInput style={[s.input, s.periodInput, { flex: 1 }]} placeholder="Start YYYY-MM-DD" placeholderTextColor="#555"
                        value={offDraft.start} onChangeText={(v) => setOffDraft(p => ({ ...p, start: v }))} />
                      <TextInput style={[s.input, s.periodInput, { flex: 1 }]} placeholder="End YYYY-MM-DD" placeholderTextColor="#555"
                        value={offDraft.end} onChangeText={(v) => setOffDraft(p => ({ ...p, end: v }))} />
                    </View>
                    <TouchableOpacity style={s.addPeriodBtn} onPress={addOffPeriod}>
                      <Ionicons name="add-circle-outline" size={16} color={GREEN} />
                      <Text style={s.addPeriodBtnText}>Add off-season period</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={[s.label, { marginTop: 16 }]}>Minimum Stay (nights)</Text>
              <View style={s.stepperRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subHint}>Regular</Text>
                  <Stepper value={draft.minNights} onChange={(v) => setDraft(d => ({ ...d, minNights: v }))} min={1} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subHint}>Weekends</Text>
                  <Stepper value={draft.minNightsWeekend} onChange={(v) => setDraft(d => ({ ...d, minNightsWeekend: v }))} min={1} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subHint}>Peak</Text>
                  <Stepper value={draft.minNightsPeak} onChange={(v) => setDraft(d => ({ ...d, minNightsPeak: v }))} min={1} />
                </View>
              </View>

              <TouchableOpacity style={s.saveRoomBtn} onPress={saveRoomType} activeOpacity={0.85}>
                <Text style={s.saveRoomBtnText}>SAVE ROOM TYPE</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Step 1 Component ───────────────────────────────────────────────────────

function Step1(props: any) {
  const {
    photoUris, photoUrls, photoUploading, onPickPhotos, onRemovePhoto,
    name, setName, propertyTypes, onToggleType, description, setDescription,
    address, onAddressChange, locSuggestions, locSearching, onSelectSuggestion,
    city, setCity, state, district, onLocationChange, country, pincode, setPincode,
    coords, onOpenMap, checkinTime, setCheckinTime, checkoutTime, setCheckoutTime,
    amenities, onToggleAmenity, smokingAllowed, setSmokingAllowed,
    petsAllowed, setPetsAllowed, partiesAllowed, setPartiesAllowed,
    childrenAllowed, setChildrenAllowed, cancellationPolicy, setCancellationPolicy,
  } = props;

  return (
    <>
      <Text style={s.stepHeader}>Tell us about your property</Text>

      <Text style={s.label}>Property Photos * (min 3, max 10)</Text>
      <View style={s.thumbGrid}>
        {photoUris.map((uri: string, idx: number) => (
          <View key={idx} style={s.thumbWrap}>
            <Image source={{ uri }} style={s.thumb} contentFit="cover" />
            {idx === 0 && <View style={s.coverBadge}><Text style={s.coverBadgeText}>COVER</Text></View>}
            {!photoUrls[idx] && (
              <View style={s.thumbOverlay}><ActivityIndicator size="small" color={GREEN} /></View>
            )}
            <TouchableOpacity style={s.thumbRemove} onPress={() => onRemovePhoto(idx)}>
              <Ionicons name="close" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}
        {photoUris.length < 10 && (
          <TouchableOpacity style={s.thumbAdd} onPress={onPickPhotos}>
            {photoUploading
              ? <ActivityIndicator size="small" color={GREEN} />
              : <Ionicons name="camera-outline" size={22} color={GREEN} />}
            <Text style={s.thumbAddText}>Add Photos</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.label}>Property Name *</Text>
      <TextInput
        style={s.input} placeholder="e.g. Misty Hills Coorg Homestay" placeholderTextColor="#555"
        value={name} onChangeText={setName}
      />

      <Text style={s.label}>Property Types * (min 1)</Text>
      <View style={s.chipGrid}>
        {PROPERTY_TYPES.map((t) => {
          const active = propertyTypes.includes(t.id);
          return (
            <Pressable key={t.id} style={[s.specChip, active && s.specChipActive]} onPress={() => onToggleType(t.id)}>
              <Text style={s.specEmoji}>{t.emoji}</Text>
              <Text style={[s.specLabel, active && s.specLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>Description * (min 150 chars)</Text>
      <TextInput
        style={[s.input, s.textArea]}
        placeholder="Describe your property, surroundings, what makes it special, nearby trails..."
        placeholderTextColor="#555"
        value={description} onChangeText={setDescription}
        multiline textAlignVertical="top"
      />
      <Text style={[s.charCount, description.length >= 150 && s.charCountOk]}>{description.length}/150 min characters</Text>

      <Text style={s.label}>Address *</Text>
      <View style={s.searchBox}>
        <Ionicons name="location-outline" size={16} color={GREEN} />
        <TextInput
          style={s.searchInput} placeholder="Search address, village, district..." placeholderTextColor="#555"
          value={address} onChangeText={onAddressChange}
        />
        {locSearching && <ActivityIndicator size="small" color={GREEN} />}
      </View>
      {locSuggestions.length > 0 && (
        <View style={s.suggestions}>
          {locSuggestions.map((sg: GeocodeResult, i: number) => (
            <TouchableOpacity key={i} style={[s.suggItem, i < locSuggestions.length - 1 && s.suggBorder]} onPress={() => onSelectSuggestion(sg)}>
              <Ionicons name="location-outline" size={13} color={GREEN} />
              <Text style={s.suggText} numberOfLines={2}>{sg.place_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>City *</Text>
          <TextInput style={s.input} placeholder="e.g. Coorg" placeholderTextColor="#555" value={city} onChangeText={setCity} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Pincode</Text>
          <TextInput style={s.input} placeholder="e.g. 571201" placeholderTextColor="#555" keyboardType="numeric" value={pincode} onChangeText={setPincode} maxLength={6} />
        </View>
      </View>

      <LocationPicker
        value={{ state, district }}
        onChange={onLocationChange}
        extraStateOptions={OTHER_COUNTRIES}
        stateLabel="State *"
      />
      <Text style={s.countryHint}>Country: {country}</Text>

      <TouchableOpacity style={s.mapPinBtn} onPress={onOpenMap}>
        <Ionicons name="map-outline" size={14} color={GREEN} />
        <Text style={s.mapPinText}>
          {coords ? `📍 ${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E — tap to adjust` : 'Pin your exact location on the map *'}
        </Text>
      </TouchableOpacity>

      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Check-in Time</Text>
          <View style={s.chipGrid}>
            {CHECKIN_TIMES.map(t => (
              <Pressable key={t} style={[s.smallChip, checkinTime === t && s.smallChipActive]} onPress={() => setCheckinTime(t)}>
                <Text style={[s.smallChipText, checkinTime === t && s.smallChipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={s.row2}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Check-out Time</Text>
          <View style={s.chipGrid}>
            {CHECKOUT_TIMES.map(t => (
              <Pressable key={t} style={[s.smallChip, checkoutTime === t && s.smallChipActive]} onPress={() => setCheckoutTime(t)}>
                <Text style={[s.smallChipText, checkoutTime === t && s.smallChipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={s.label}>Property Amenities</Text>
      <View style={s.chipGrid}>
        {AMENITIES.map(a => {
          const active = amenities.includes(a.id);
          return (
            <Pressable key={a.id} style={[s.specChip, active && s.specChipActive]} onPress={() => onToggleAmenity(a.id)}>
              <Text style={s.specEmoji}>{a.emoji}</Text>
              <Text style={[s.specLabel, active && s.specLabelActive]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={s.label}>House Rules</Text>
      <ToggleRow label="🚬 Smoking allowed" value={smokingAllowed} onChange={setSmokingAllowed} />
      <ToggleRow label="🐕 Pets allowed" value={petsAllowed} onChange={setPetsAllowed} />
      <ToggleRow label="🎉 Parties/Events allowed" value={partiesAllowed} onChange={setPartiesAllowed} />
      <ToggleRow label="👶 Children welcome" value={childrenAllowed} onChange={setChildrenAllowed} />

      <Text style={[s.label, { marginTop: 8 }]}>Cancellation Policy</Text>
      {CANCELLATION_POLICIES.map(p => (
        <TouchableOpacity
          key={p.id}
          style={[s.policyCard, cancellationPolicy === p.id && s.policyCardActive]}
          onPress={() => setCancellationPolicy(p.id)}
          activeOpacity={0.85}
        >
          <View style={s.policyHeader}>
            <Text style={s.policyEmoji}>{p.emoji}</Text>
            <Text style={s.policyLabel}>{p.label}</Text>
            <View style={[s.radioOuter, cancellationPolicy === p.id && s.radioOuterActive]}>
              {cancellationPolicy === p.id && <View style={s.radioInner} />}
            </View>
          </View>
          <Text style={s.policyDesc}>{p.desc}</Text>
        </TouchableOpacity>
      ))}
    </>
  );
}

// ─── Step 2 Component ───────────────────────────────────────────────────────

function Step2({ roomTypes, onAdd, onEdit, onRemove }: { roomTypes: RoomType[]; onAdd: () => void; onEdit: (rt: RoomType) => void; onRemove: (id: string) => void }) {
  return (
    <>
      <Text style={s.stepHeader}>Add your room types</Text>
      <Text style={s.stepSub}>Add all accommodation types available at your property</Text>

      {roomTypes.map((rt) => (
        <View key={rt.id} style={s.roomCard}>
          {rt.photoUrls[0] ? (
            <Image source={{ uri: rt.photoUrls[0] }} style={s.roomCardImg} contentFit="cover" />
          ) : (
            <View style={[s.roomCardImg, s.roomCardImgFallback]}>
              <Ionicons name="bed-outline" size={22} color="rgba(255,255,255,0.2)" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.roomCardName} numberOfLines={1}>{rt.name || 'Untitled Room'}</Text>
            <Text style={s.roomCardMeta}>
              {ROOM_CATEGORIES.find(c => c.id === rt.roomCategory)?.label} · Up to {rt.maxOccupancy} guests
            </Text>
            <Text style={s.roomCardPrice}>₹{rt.basePrice || 0}/night · {rt.totalUnits} unit{rt.totalUnits > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={s.locEdit} onPress={() => onEdit(rt)}>
            <Ionicons name="pencil-outline" size={16} color={GREEN} />
          </TouchableOpacity>
          <TouchableOpacity style={s.locRemove} onPress={() => onRemove(rt.id)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addLocBtn} onPress={onAdd} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={18} color={GREEN} />
        <Text style={s.addLocText}>+ ADD ROOM TYPE</Text>
      </TouchableOpacity>

      {roomTypes.length === 0 && (
        <Text style={s.emptyHint}>Add at least one room type to continue.</Text>
      )}
    </>
  );
}

// ─── Step 3 Component ───────────────────────────────────────────────────────

function Step3(props: any) {
  const {
    contactName, setContactName, contactPhone, setContactPhone,
    contactPhoneCode, setContactPhoneCode,
    contactWhatsapp, setContactWhatsapp, contactWhatsappCode, setContactWhatsappCode,
    contactEmail, setContactEmail,
    idDocType, setIdDocType, idFrontUri, idFrontUrl, idBackUri, idBackUrl,
    idUploading, onPickDoc, onRemoveFront, onRemoveBack,
    ownershipProofType, setOwnershipProofType, ownershipProofUri, ownershipUploading,
    onPickOwnership, onRemoveOwnership,
  } = props;

  return (
    <>
      <Text style={s.stepHeader}>Contact & Identity Verification</Text>

      <Text style={s.label}>Contact Name *</Text>
      <TextInput style={s.input} placeholder="Full name" placeholderTextColor="#555" value={contactName} onChangeText={setContactName} />

      <Text style={s.label}>Phone *</Text>
      <PhoneInput
        countryCode={contactPhoneCode} onChangeCountryCode={setContactPhoneCode}
        number={contactPhone} onChangeNumber={setContactPhone}
        placeholder="Mobile number"
      />

      <Text style={s.label}>WhatsApp</Text>
      <PhoneInput
        countryCode={contactWhatsappCode} onChangeCountryCode={setContactWhatsappCode}
        number={contactWhatsapp} onChangeNumber={setContactWhatsapp}
        placeholder="Same as phone if blank"
      />

      <Text style={s.label}>Email *</Text>
      <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor="#555" value={contactEmail} onChangeText={setContactEmail}
        keyboardType="email-address" autoCapitalize="none" />

      <View style={s.infoBanner}>
        <Ionicons name="lock-closed-outline" size={16} color={GREEN} />
        <Text style={s.infoText}>
          Your contact details are only used by the TrekRiderz team for coordination. They are never shared with guests directly.
        </Text>
      </View>

      <Text style={s.label}>Identity Verification</Text>
      <View style={s.idTypeRow}>
        {ID_DOC_TYPES.map((dt) => (
          <TouchableOpacity key={dt.id} style={[s.idTypeBtn, idDocType === dt.id && s.idTypeBtnActive]} onPress={() => setIdDocType(dt.id)} activeOpacity={0.8}>
            <Text style={[s.idTypeLabel, idDocType === dt.id && s.idTypeLabelActive]}>{dt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {idDocType !== '' && (
        <View style={s.docPhotoRow}>
          <DocPhotoBox label="Front" localUri={idFrontUri} uploading={idUploading === 'front'} done={!!idFrontUrl} onPick={() => onPickDoc('front')} onRemove={onRemoveFront} />
          <DocPhotoBox label="Back" localUri={idBackUri} uploading={idUploading === 'back'} done={!!idBackUrl} onPick={() => onPickDoc('back')} onRemove={onRemoveBack} />
        </View>
      )}

      <Text style={s.label}>Property Ownership Proof (optional but recommended)</Text>
      <View style={s.chipGrid}>
        {OWNERSHIP_PROOF_TYPES.map((t) => (
          <Pressable key={t.id} style={[s.smallChip, ownershipProofType === t.id && s.smallChipActive]} onPress={() => setOwnershipProofType(t.id)}>
            <Text style={[s.smallChipText, ownershipProofType === t.id && s.smallChipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {ownershipProofType !== '' && (
        <View style={{ width: 150 }}>
          <DocPhotoBox label="Proof" localUri={ownershipProofUri} uploading={ownershipUploading} done={!!ownershipProofUri && !ownershipUploading} onPick={onPickOwnership} onRemove={onRemoveOwnership} />
        </View>
      )}
    </>
  );
}

// ─── Step 4 Component ───────────────────────────────────────────────────────

function Step4({ roomCount, agreeTerms, setAgreeTerms, agreeAccuracy, setAgreeAccuracy, agreeResponse, setAgreeResponse }: any) {
  return (
    <>
      <Text style={s.stepHeader}>Review & Accept Terms</Text>

      <ScrollView style={s.termsBox} nestedScrollEnabled>
        <Text style={s.termsTitle}>TREKRIDERZ HOST AGREEMENT</Text>

        <Text style={s.termsHeading}>COMMISSION & PAYMENTS</Text>
        <Text style={s.termsBody}>
          TrekRiderz charges a 15% service commission on each confirmed booking. This covers platform maintenance, customer support, marketing, and payment processing.{'\n\n'}
          Payment to hosts will be transferred within 3-5 business days after guest check-in, after deducting the 15% commission.
        </Text>

        <Text style={s.termsHeading}>LISTING STANDARDS</Text>
        <Text style={s.termsBody}>
          Your property must accurately represent what guests will receive. Photos must be genuine and current. Misleading listings will result in immediate removal.
        </Text>

        <Text style={s.termsHeading}>BOOKING MANAGEMENT</Text>
        <Text style={s.termsBody}>
          All bookings are managed through TrekRiderz. You must respond to booking requests within 24 hours. Repeated non-responses may result in listing suspension.
        </Text>

        <Text style={s.termsHeading}>CANCELLATION OBLIGATIONS</Text>
        <Text style={s.termsBody}>
          If you cancel a confirmed booking, you may be liable for alternative accommodation costs for the guest. Repeated host cancellations will result in listing termination.
        </Text>

        <Text style={s.termsHeading}>QUALITY STANDARDS</Text>
        <Text style={s.termsBody}>
          TrekRiderz reserves the right to conduct quality reviews and remove listings that don't meet platform standards or receive consistently poor guest feedback.
        </Text>

        <Text style={s.termsHeading}>TERMINATION POLICY</Text>
        <Text style={s.termsBody}>
          Either party may terminate this agreement with 30 days written notice. TrekRiderz may immediately terminate listings for:{'\n'}
          - Fraud or misrepresentation{'\n'}
          - Safety violations{'\n'}
          - Repeated policy breaches{'\n'}
          - Legal violations
        </Text>

        <Text style={s.termsHeading}>DISPUTE RESOLUTION</Text>
        <Text style={s.termsBody}>
          Any disputes will first be attempted through mediation. TrekRiderz's decision in guest disputes is final and binding.
        </Text>

        <Text style={[s.termsBody, { marginTop: 8 }]}>
          By accepting, you confirm that:{'\n'}
          - You have the legal right to list this property{'\n'}
          - All information provided is accurate{'\n'}
          - You agree to maintain the listed standards{'\n'}
          - You accept the 15% commission structure
        </Text>
      </ScrollView>

      <CheckboxRow checked={agreeTerms} onToggle={() => setAgreeTerms(!agreeTerms)} label="I have read and agree to the TrekRiderz Host Agreement and Commission Terms" />
      <CheckboxRow checked={agreeAccuracy} onToggle={() => setAgreeAccuracy(!agreeAccuracy)} label="I confirm that all information provided is accurate and I have the legal right to list this property" />
      <CheckboxRow checked={agreeResponse} onToggle={() => setAgreeResponse(!agreeResponse)} label="I agree to respond to booking requests within 24 hours" />

      <Text style={s.summaryHint}>{roomCount} room type{roomCount !== 1 ? 's' : ''} added</Text>
    </>
  );
}

// ─── Shared Sub-components ──────────────────────────────────────────────────

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(140,198,63,0.5)' }} thumbColor={value ? GREEN : '#888'} />
    </View>
  );
}

function CheckboxRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <TouchableOpacity style={s.checkboxRow} onPress={onToggle} activeOpacity={0.8}>
      <View style={[s.checkbox, checked && s.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={14} color="#000" />}
      </View>
      <Text style={s.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View style={s.stepperBox}>
      <TouchableOpacity style={s.stepperBtn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Ionicons name="remove" size={16} color={GREEN} />
      </TouchableOpacity>
      <Text style={s.stepperValue}>{value}</Text>
      <TouchableOpacity style={s.stepperBtn} onPress={() => onChange(Math.min(max, value + 1))}>
        <Ionicons name="add" size={16} color={GREEN} />
      </TouchableOpacity>
    </View>
  );
}

function DocPhotoBox({ label, localUri, uploading, done, onPick, onRemove }: {
  label: string; localUri: string | null; uploading: boolean; done: boolean; onPick: () => void; onRemove: () => void;
}) {
  return (
    <TouchableOpacity style={s.docBox} onPress={localUri ? undefined : onPick} activeOpacity={0.8}>
      {localUri ? (
        <>
          <Image source={{ uri: localUri }} style={s.docThumb} contentFit="cover" />
          {uploading && <View style={s.docOverlay}><ActivityIndicator color={GREEN} /></View>}
          {done && !uploading && <View style={s.docDone}><Ionicons name="checkmark" size={12} color="#000" /></View>}
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
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: GREEN, borderColor: GREEN },
  stepDotText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  stepDotTextActive: { color: '#000' },
  stepConnector: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  stepConnectorActive: { backgroundColor: GREEN },

  stepHeader: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  stepSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 },

  label: {
    fontSize: 11, fontWeight: '700', color: GREEN,
    letterSpacing: 1.5, marginBottom: 10, textTransform: 'uppercase', marginTop: 4,
  },
  subHint: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, marginTop: -4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  textArea: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -12, marginBottom: 16, textAlign: 'right' },
  charCountOk: { color: GREEN },
  row2: { flexDirection: 'row', gap: 12 },

  // Thumbs
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  thumbWrap: { width: 78, height: 78, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  thumbRemove: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: GREEN, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  coverBadgeText: { fontSize: 8, fontWeight: '800', color: '#000' },
  thumbAdd: {
    width: 78, height: 78, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(140,198,63,0.3)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(140,198,63,0.05)', gap: 2,
  },
  thumbAddText: { fontSize: 9, color: GREEN, fontWeight: '700' },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  specChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  specChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  specEmoji: { fontSize: 15 },
  specLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  specLabelActive: { color: '#000' },
  smallChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  smallChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  smallChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  smallChipTextActive: { color: '#000' },

  // Location
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, paddingVertical: 13 },
  suggestions: { backgroundColor: '#141920', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  suggItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  suggBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggText: { flex: 1, color: '#FFF', fontSize: 13 },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16,
  },
  selectBoxText: { color: '#FFF', fontSize: 15 },
  countryHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: -12, marginBottom: 16 },
  mapPinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 20, paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  mapPinText: { fontSize: 12, color: GREEN, fontWeight: '600', flex: 1 },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },

  // Cancellation policy
  policyCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 10,
  },
  policyCardActive: { borderColor: GREEN, backgroundColor: 'rgba(140,198,63,0.06)' },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  policyEmoji: { fontSize: 16 },
  policyLabel: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '700' },
  policyDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: GREEN },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },

  // Room cards (Step 2)
  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 10,
  },
  roomCardImg: { width: 54, height: 54, borderRadius: 10 },
  roomCardImgFallback: { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  roomCardName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  roomCardMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  roomCardPrice: { color: GREEN, fontSize: 12, fontWeight: '700', marginTop: 2 },
  locEdit: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(140,198,63,0.1)', alignItems: 'center', justifyContent: 'center' },
  locRemove: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  addLocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)', borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, marginTop: 4,
  },
  addLocText: { color: GREEN, fontSize: 14, fontWeight: '700' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 16 },

  // Bed config
  bedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  bedRowText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  addBedRow: { marginBottom: 16 },
  addBedBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4,
  },
  addBedBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },

  stepperRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  stepperBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6, paddingVertical: 6, marginBottom: 16,
  },
  stepperBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(140,198,63,0.12)', alignItems: 'center', justifyContent: 'center' },
  stepperValue: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  pricingDivider: { marginTop: 12, marginBottom: 16, alignItems: 'center' },
  pricingDividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  periodTag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  periodTagText: { color: GREEN, fontSize: 12, fontWeight: '600', flex: 1 },
  periodForm: { marginBottom: 12 },
  periodInput: { marginBottom: 8 },
  periodDateRow: { flexDirection: 'row', gap: 8 },
  addPeriodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  addPeriodBtnText: { color: GREEN, fontSize: 12, fontWeight: '700' },

  saveRoomBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveRoomBtnText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // Contact / doc
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)', marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  idTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  idTypeBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  idTypeBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  idTypeLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  idTypeLabelActive: { color: '#000' },
  docPhotoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  docBox: {
    flex: 1, aspectRatio: 1.4, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', gap: 4,
  },
  docThumb: { ...StyleSheet.absoluteFillObject },
  docOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  docDone: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  docRemove: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  docLabel: { fontSize: 11, fontWeight: '700', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  docUploadText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },

  // Terms
  termsBox: {
    maxHeight: 280, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16,
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
  summaryHint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginTop: 8 },

  // Nav
  navRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  backNavBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
  },
  backNavBtnText: { color: GREEN, fontSize: 13, fontWeight: '800' },
  nextBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15,
  },
  nextBtnText: { color: '#000', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  submitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 16,
  },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#000', letterSpacing: 0.5 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0F1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  stateOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  stateOptionBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  stateOptionText: { color: '#FFF', fontSize: 14 },
});
