import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors } from '@/constants/theme';

const GREEN = AppColors.primary;
const BG = AppColors.background;
const KEY = 'notification_prefs';

interface Prefs {
  trip_invites: boolean;
  trip_reminders: boolean;
  booking_updates: boolean;
  new_messages: boolean;
  guide_bookings: boolean;
  expedition_updates: boolean;
  community_posts: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: Prefs = {
  trip_invites: true,
  trip_reminders: true,
  booking_updates: true,
  new_messages: true,
  guide_bookings: true,
  expedition_updates: true,
  community_posts: false,
  promotions: false,
};

const SECTIONS = [
  {
    title: 'Trips & Bookings',
    items: [
      { key: 'trip_invites', label: 'Trip Invitations', desc: 'When someone invites you to join a trip', icon: 'airplane-outline' },
      { key: 'trip_reminders', label: 'Trip Reminders', desc: '24h before your trip starts', icon: 'alarm-outline' },
      { key: 'booking_updates', label: 'Booking Updates', desc: 'Confirmations, cancellations, changes', icon: 'receipt-outline' },
    ],
  },
  {
    title: 'Social',
    items: [
      { key: 'new_messages', label: 'New Messages', desc: 'Chat messages from trip members', icon: 'chatbubble-outline' },
      { key: 'community_posts', label: 'Community Posts', desc: 'New posts in communities you joined', icon: 'people-outline' },
    ],
  },
  {
    title: 'Guides & Expeditions',
    items: [
      { key: 'guide_bookings', label: 'Guide Requests', desc: 'New hire requests (guides only)', icon: 'ribbon-outline' },
      { key: 'expedition_updates', label: 'Expedition Updates', desc: 'Changes to expeditions you joined', icon: 'flag-outline' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { key: 'promotions', label: 'Promotions & Offers', desc: 'Deals and seasonal offers', icon: 'pricetag-outline' },
    ],
  },
];

export default function NotificationPreferencesScreen() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    });
  }, []);

  const toggle = async (key: keyof Prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>Choose what alerts you receive</Text>
          </View>
          {saving && <Ionicons name="checkmark-circle" size={20} color={GREEN} style={{ marginLeft: 'auto' }} />}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.items.map((item) => (
                <View key={item.key} style={styles.row}>
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon as any} size={18} color={GREEN} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key as keyof Prefs]}
                    onValueChange={() => toggle(item.key as keyof Prefs)}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: GREEN + '60' }}
                    thumbColor={prefs[item.key as keyof Prefs] ? GREEN : 'rgba(255,255,255,0.4)'}
                  />
                </View>
              ))}
            </View>
          ))}

          <Text style={styles.note}>
            Push notification permissions are managed in your device Settings → TrekRiderz.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  content: { paddingHorizontal: 16, paddingBottom: 60 },

  section: { marginTop: 24 },
  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 10, marginLeft: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 14, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: GREEN + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  rowDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 15 },

  note: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12, textAlign: 'center',
    marginTop: 28, lineHeight: 18, paddingHorizontal: 8,
  },
});
