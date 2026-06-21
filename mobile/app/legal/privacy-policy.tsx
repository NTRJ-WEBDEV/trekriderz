import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: June 2026</Text>

        <Section title="1. Information We Collect">
          {`TrekRiderz ("we", "our", or "us") collects information you provide directly:\n\n• Account info: name, email address, profile photo\n• Location data: real-time GPS when location sharing is enabled\n• Trip data: trip plans, itineraries, routes you create\n• Communications: messages sent through the app\n• Device info: push notification tokens, device identifiers`}
        </Section>

        <Section title="2. How We Use Your Information">
          {`We use your information to:\n\n• Provide and improve the TrekRiderz service\n• Connect you with fellow trekkers, guides, and homestay hosts\n• Send trip updates, booking confirmations, and notifications\n• Ensure safety via real-time location sharing during trips\n• Personalise content and recommendations`}
        </Section>

        <Section title="3. Location Data">
          {`TrekRiderz accesses your device location:\n\n• In the foreground when you use map or trip features\n• In the background only when you explicitly enable live location sharing for an active trip\n\nYou can disable location access at any time in your device Settings. Background location is used solely for trip-member safety features and is never sold or shared with advertisers.`}
        </Section>

        <Section title="4. Sharing Your Information">
          {`We share information with:\n\n• Other users: your name, photo, and bio are visible to other members\n• Guides & Hosts: your name and contact details when you make a booking\n• Service providers: Supabase (database hosting), Expo (push notifications), Mapbox (maps)\n\nWe do NOT sell your personal data to third parties.`}
        </Section>

        <Section title="5. Data Security">
          {`We protect your data using:\n\n• Encrypted HTTPS connections\n• Row-Level Security (RLS) policies on our database\n• Supabase Auth with automatic token refresh\n\nNo method of transmission over the Internet is 100% secure; we strive to use commercially acceptable means.`}
        </Section>

        <Section title="6. Data Retention">
          {`We retain your data as long as your account is active. You may request account deletion at any time from your Profile → Settings → Delete Account. Upon deletion, your personal data is permanently removed within 30 days.`}
        </Section>

        <Section title="7. Children's Privacy">
          {`TrekRiderz is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such data, contact us and we will remove it promptly.`}
        </Section>

        <Section title="8. Your Rights">
          {`You have the right to:\n\n• Access a copy of your personal data\n• Correct inaccurate data\n• Delete your account and data\n• Withdraw consent for location tracking\n\nContact us at: privacy@trekriderz.app`}
        </Section>

        <Section title="9. Cookies & Tracking">
          {`The TrekRiderz mobile app does not use browser cookies. We may use device identifiers and analytics SDKs (e.g., Expo Analytics) to understand how users interact with the app. You can opt out of analytics via Profile → Settings → Privacy.`}
        </Section>

        <Section title="10. International Transfers">
          {`Your data may be stored and processed in countries other than your country of residence. By using the app you consent to transfer and processing of your data in countries where our service providers operate.`}
        </Section>

        <Section title="11. Changes to This Policy">
          {`We may update this Privacy Policy periodically. We will notify you of significant changes via in-app notification or email. Continued use of the app after changes constitutes acceptance of the updated policy.`}
        </Section>

        <Section title="12. Contact Us">
          {`For questions, requests, or concerns about your privacy:\n\nEmail: privacy@trekriderz.app\nGeneral: admin@trekriderz.in`}
        </Section>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#8CC63F',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  paragraph: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
});
