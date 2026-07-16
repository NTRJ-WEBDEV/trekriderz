import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { requestLocationPermissions, startLocationSharing, stopLocationSharing } from '@/lib/location-service';
import { getActiveTrailTripId } from '@/lib/offline-safety';
import * as Location from 'expo-location';

interface SafetyItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: 'preparation' | 'during' | 'emergency';
}

const DEFAULT_SAFETY_CHECKLIST: SafetyItem[] = [
  { id: '1', title: 'Emergency Contacts Saved', description: 'Save important numbers in your phone', completed: false, category: 'preparation' },
  { id: '2', title: 'Travel Insurance', description: 'Ensure you have valid travel insurance', completed: false, category: 'preparation' },
  { id: '3', title: 'Medical Kit', description: 'Pack basic first aid supplies', completed: false, category: 'preparation' },
  { id: '4', title: 'Cash Backup', description: 'Carry some cash for emergencies', completed: false, category: 'preparation' },
  { id: '5', title: 'Stay Hydrated', description: 'Drink plenty of water regularly', completed: false, category: 'during' },
  { id: '6', title: 'Share Location', description: 'Keep location sharing active with trusted contacts', completed: false, category: 'during' },
  { id: '7', title: 'Local Emergency Numbers', description: 'Know local police and medical emergency numbers', completed: false, category: 'during' },
  { id: '8', title: 'Weather Check', description: 'Monitor weather conditions regularly', completed: false, category: 'during' },
  { id: '9', title: 'SOS Plan', description: 'Know what to do in case of emergency', completed: false, category: 'emergency' },
  { id: '10', title: 'Safe Zones', description: 'Identify safe places in your current location', completed: false, category: 'emergency' },
  { id: '11', title: 'Communication Backup', description: 'Have alternative communication methods', completed: false, category: 'emergency' },
  { id: '12', title: 'Exit Strategy', description: 'Know how to get to safety quickly', completed: false, category: 'emergency' },
];

const EMERGENCY_CONTACTS = [
  { label: 'National Emergency', number: '112', icon: '🚨', color: '#EF4444' },
  { label: 'Police', number: '100', icon: '👮', color: '#3B82F6' },
  { label: 'Ambulance', number: '102', icon: '🚑', color: '#EF4444' },
  { label: 'Fire Brigade', number: '101', icon: '🔥', color: '#F97316' },
  { label: 'Tourist Helpline', number: '1800-111-363', icon: '✈️', color: '#8CC63F' },
  { label: 'Women Safety', number: '1091', icon: '🛡️', color: '#8B5CF6' },
];

const SAFETY_TIPS = [
  'Always inform someone about your itinerary before leaving',
  'Keep digital and physical copies of important documents',
  'Download offline maps before heading to remote areas',
  'Carry a basic first-aid kit on all outdoor trips',
  'Respect local customs and avoid photography where restricted',
  'Never trek alone in unknown terrain — go in groups',
  'Acclimatize properly at high altitudes (above 3000m)',
  'Keep emergency cash separate from your main wallet',
];

export default function SafetyScreen() {
  const { tripId } = useLocalSearchParams();
  const currentUser = useAuthStore((state) => state.user);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<string | null>(null);
  const [trip, setTrip] = useState<any>(null);
  const [checklist, setChecklist] = useState<SafetyItem[]>(DEFAULT_SAFETY_CHECKLIST);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'checklist' | 'contacts' | 'tips'>('checklist');

  useEffect(() => {
    fetchTripAndChecklist();
    fetchLocationSharingState();
  }, [tripId]);

  const fetchLocationSharingState = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('users')
      .select('location_sharing_enabled, last_location_update')
      .eq('id', currentUser.id)
      .single();
    if (data) {
      setIsSharingLocation(!!data.location_sharing_enabled);
      setLastLocationUpdate(data.last_location_update ?? null);
    }
  };

  const fetchTripAndChecklist = async () => {
    try {
      const { data: tripData } = await supabase
        .from('trips')
        .select('destination, safety_checklist')
        .eq('id', tripId)
        .single();

      setTrip(tripData);

      if (tripData?.safety_checklist) {
        setChecklist(tripData.safety_checklist);
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (itemId: string) => {
    const updatedChecklist = checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedChecklist);

    try {
      await supabase
        .from('trips')
        .update({ safety_checklist: updatedChecklist })
        .eq('id', tripId);
    } catch (error) {
      console.error('Error saving checklist:', error);
      setChecklist(checklist);
    }
  };

  const handleSOS = () => {
    Alert.alert(
      'SOS ACTIVATED',
      'This will alert your trip members with your location and call emergency services. Are you in an emergency?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CALL 112',
          style: 'destructive',
          onPress: () => {
            // The dial must never be delayed by a network call — it fires
            // immediately, alerting the trip runs alongside it.
            Linking.openURL('tel:112');
            sendSosAlert();
          }
        }
      ]
    );
  };

  const sendSosAlert = async () => {
    if (!currentUser?.id || !tripId) return;
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      // Fresh one-shot capture, independent of the ambient location-sharing
      // toggle — this is an explicit disclosure the user is actively
      // initiating by pressing SOS, not a change to their ambient tracking
      // consent.
      await Location.requestForegroundPermissionsAsync();
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch (error) {
      console.error('SOS location capture failed:', error);
    }

    const { error } = await supabase.from('sos_alerts').insert({
      trip_id: tripId,
      user_id: currentUser.id,
      latitude,
      longitude,
    });

    if (error) {
      console.error('Error sending SOS alert:', error);
      Alert.alert('Alert Not Sent', 'Could not notify your trip members — please also try contacting them directly.');
    }
  };

  const toggleLocationSharing = () => {
    if (!isSharingLocation) {
      Alert.alert(
        'Enable Location Sharing',
        'Your real-time location will be shared with trip members.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: enableLocationSharing },
        ]
      );
    } else {
      disableLocationSharing();
    }
  };

  const enableLocationSharing = async () => {
    if (!currentUser?.id) return;
    try {
      await requestLocationPermissions();
    } catch (error) {
      Alert.alert('Permission Needed', 'Location permission is required to share your location with trip members.');
      return;
    }
    const { error } = await supabase
      .from('users')
      .update({ location_sharing_enabled: true })
      .eq('id', currentUser.id);
    if (error) {
      Alert.alert('Error', 'Failed to enable location sharing.');
      return;
    }
    await startLocationSharing();
    setIsSharingLocation(true);
  };

  const disableLocationSharing = async () => {
    if (!currentUser?.id) return;
    const { error } = await supabase
      .from('users')
      .update({ location_sharing_enabled: false })
      .eq('id', currentUser.id);
    if (error) {
      Alert.alert('Error', 'Failed to disable location sharing.');
      return;
    }
    // Don't stop the background task out from under an active offline-safety
    // trail recording — the write-gate in updateDatabaseLocation() already
    // stops member-visible writes regardless of whether the task keeps running.
    const activeTrail = await getActiveTrailTripId();
    if (!activeTrail) await stopLocationSharing();
    setIsSharingLocation(false);
  };

  const callNumber = (number: string) => {
    const cleaned = number.replace(/-/g, '');
    Linking.openURL(`tel:${cleaned}`);
  };

  // Ground truth for "am I actually being tracked right now" — derived from
  // the last real DB write, not from the toggle's stated intent, so a stale
  // or desynced toggle can never claim tracking is happening when it isn't
  // (or hide that it is). Location ticks land every ~5 minutes, so anything
  // older than 10 minutes reads as not currently live.
  const minutesSinceLocationUpdate = lastLocationUpdate
    ? Math.floor((Date.now() - new Date(lastLocationUpdate).getTime()) / 60000)
    : null;
  const isLiveTracking = isSharingLocation && minutesSinceLocationUpdate !== null && minutesSinceLocationUpdate < 10;

  const completedCount = checklist.filter(i => i.completed).length;
  const totalCount = checklist.length;

  const preparationItems = checklist.filter(i => i.category === 'preparation');
  const duringItems = checklist.filter(i => i.category === 'during');
  const emergencyItems = checklist.filter(i => i.category === 'emergency');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Safety Info</Text>
          {trip?.destination && (
            <Text style={styles.headerSubtitle}>📍 {trip.destination}</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* SOS Button */}
      <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
        <Ionicons name="warning" size={22} color="white" />
        <Text style={styles.sosText}>SOS Emergency</Text>
        <Text style={styles.sosNumber}>112</Text>
      </TouchableOpacity>

      {/* Location sharing toggle */}
      <TouchableOpacity
        style={[styles.locationBar, isSharingLocation && styles.locationBarActive]}
        onPress={toggleLocationSharing}
      >
        <Ionicons
          name={isSharingLocation ? 'location' : 'location-outline'}
          size={20}
          color={isSharingLocation ? '#8CC63F' : 'rgba(255,255,255,0.5)'}
        />
        <Text style={[styles.locationBarText, isSharingLocation && styles.locationBarTextActive]}>
          {isSharingLocation ? 'Sharing location with members' : 'Share your location with members'}
        </Text>
        <View style={[styles.locationToggle, isSharingLocation && styles.locationToggleActive]}>
          <View style={[styles.locationToggleDot, isSharingLocation && styles.locationToggleDotActive]} />
        </View>
      </TouchableOpacity>

      {/* Ground-truth tracking status — reflects the last real DB write, not
          just the toggle's stated intent */}
      <View style={styles.trackingStatus}>
        <View style={[styles.trackingDot, isLiveTracking && styles.trackingDotLive]} />
        <Text style={styles.trackingStatusText}>
          {isLiveTracking
            ? `Live — last sent ${minutesSinceLocationUpdate === 0 ? 'just now' : `${minutesSinceLocationUpdate}m ago`}`
            : 'Not currently being tracked'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['checklist', 'contacts', 'tips'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'checklist' ? `Checklist (${completedCount}/${totalCount})` :
               tab === 'contacts' ? 'Emergency' : 'Tips'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'checklist' && (
          <>
            <ChecklistSection
              title="Before Leaving"
              icon="🧳"
              items={preparationItems}
              onToggle={toggleChecklistItem}
            />
            <ChecklistSection
              title="During Trip"
              icon="🗺️"
              items={duringItems}
              onToggle={toggleChecklistItem}
            />
            <ChecklistSection
              title="Emergency Preparedness"
              icon="🆘"
              items={emergencyItems}
              onToggle={toggleChecklistItem}
            />
          </>
        )}

        {activeTab === 'contacts' && (
          <View style={styles.contactsContainer}>
            <Text style={styles.contactsNote}>
              Tap any contact to call directly
            </Text>
            {EMERGENCY_CONTACTS.map((contact, index) => (
              <TouchableOpacity
                key={index}
                style={styles.contactCard}
                onPress={() => callNumber(contact.number)}
              >
                <Text style={styles.contactIcon}>{contact.icon}</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={[styles.contactNumber, { color: contact.color }]}>
                    {contact.number}
                  </Text>
                </View>
                <Ionicons name="call-outline" size={20} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'tips' && (
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsIntro}>
              Stay safe on your adventure with these essential tips:
            </Text>
            {SAFETY_TIPS.map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <View style={styles.tipNumber}>
                  <Text style={styles.tipNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistSection({
  title,
  icon,
  items,
  onToggle,
}: {
  title: string;
  icon: string;
  items: SafetyItem[];
  onToggle: (id: string) => void;
}) {
  const completed = items.filter(i => i.completed).length;

  return (
    <View style={styles.checklistSection}>
      <View style={styles.checklistSectionHeader}>
        <Text style={styles.checklistSectionIcon}>{icon}</Text>
        <Text style={styles.checklistSectionTitle}>{title}</Text>
        <Text style={styles.checklistSectionCount}>{completed}/{items.length}</Text>
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.checklistItem}
          onPress={() => onToggle(item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
            {item.completed && <Ionicons name="checkmark" size={14} color="#080C14" />}
          </View>
          <View style={styles.checklistItemContent}>
            <Text style={[styles.checklistItemTitle, item.completed && styles.checklistItemTitleDone]}>
              {item.title}
            </Text>
            <Text style={styles.checklistItemDesc}>{item.description}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    padding: 4,
    width: 36,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 1,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  sosText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
  sosNumber: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  locationBarActive: {
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderColor: 'rgba(140,198,63,0.3)',
  },
  locationBarText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flex: 1,
  },
  locationBarTextActive: {
    color: '#8CC63F',
  },
  locationToggle: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  locationToggleActive: {
    backgroundColor: 'rgba(140,198,63,0.3)',
    alignItems: 'flex-end',
  },
  locationToggleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  locationToggleDotActive: {
    backgroundColor: '#8CC63F',
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 7,
  },
  trackingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  trackingDotLive: {
    backgroundColor: '#8CC63F',
  },
  trackingStatusText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#8CC63F',
  },
  tabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#8CC63F',
  },
  scrollView: {
    flex: 1,
  },
  checklistSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  checklistSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  checklistSectionIcon: {
    fontSize: 18,
  },
  checklistSectionTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  checklistSectionCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  checklistItemContent: {
    flex: 1,
  },
  checklistItemTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  checklistItemTitleDone: {
    color: 'rgba(255,255,255,0.35)',
    textDecorationLine: 'line-through',
  },
  checklistItemDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  contactsContainer: {
    padding: 20,
  },
  contactsNote: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  contactIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginBottom: 2,
  },
  contactNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  tipsContainer: {
    padding: 20,
  },
  tipsIntro: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(140,198,63,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  tipNumberText: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '700',
  },
  tipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    paddingTop: 4,
  },
});
