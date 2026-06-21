import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: June 20, 2026</Text>

        <Text style={styles.sectionTitle}>1. Acceptance</Text>
        <Text style={styles.paragraph}>
          These Terms of Service ("Terms") govern your use of the TrekRiderz
          mobile application (the "App"). By accessing or using the App, you
          agree to be bound by these Terms. If you do not agree, do not use the
          App.
        </Text>

        <Text style={styles.sectionTitle}>2. Services</Text>
        <Text style={styles.paragraph}>
          TrekRiderz provides a platform to discover, book, and manage guided
          expeditions, homestays and related services. Availability, pricing,
          and features may change and are subject to separate provider terms.
        </Text>

        <Text style={styles.sectionTitle}>3. User Accounts</Text>
        <Text style={styles.paragraph}>
          You must create an account to use certain features. You are
          responsible for maintaining the confidentiality of your account and
          for all activity under your account. Notify us promptly of any
          unauthorized access.
        </Text>

        <Text style={styles.sectionTitle}>4. User Content</Text>
        <Text style={styles.paragraph}>
          You retain ownership of content you post, but by posting you grant us
          a worldwide, royalty-free license to use, reproduce and distribute the
          content as necessary to operate the App. You must not post content
          that is illegal, harmful, or infringes third-party rights.
        </Text>

        <Text style={styles.sectionTitle}>5. Bookings & Payments</Text>
        <Text style={styles.paragraph}>
          Booking terms (price, cancellation policy, refunds) are specified on
          the booking confirmation. Payments are processed by third-party
          payment providers (e.g., Razorpay). We do not store full payment
          card details.
        </Text>

        <Text style={styles.sectionTitle}>6. Guide & Homestay Listings</Text>
        <Text style={styles.paragraph}>
          TrekRiderz does not employ guides or operate homestays. We act as a
          marketplace connecting users with independent providers. We are not
          responsible for the conduct of guides or hosts, or for the accuracy
          of their listings. Users engage providers at their own risk.
        </Text>

        <Text style={styles.sectionTitle}>7. Safety & Adventure Activities</Text>
        <Text style={styles.paragraph}>
          Trekking and adventure activities carry inherent risks including
          injury or death. By using the App to plan or join expeditions, you
          acknowledge these risks and agree to take all necessary safety
          precautions. TrekRiderz is not liable for accidents or injuries
          sustained during activities arranged through the App.
        </Text>

        <Text style={styles.sectionTitle}>8. Prohibited Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to misuse the App, harass other users, violate
          applicable laws, post illegal or harmful content, impersonate others,
          or attempt to disrupt or reverse engineer the App or its services.
        </Text>

        <Text style={styles.sectionTitle}>9. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All content, trademarks, logos, and software in the App are owned by
          TrekRiderz or its licensors. You may not copy, reproduce, or
          distribute any part of the App without prior written permission.
        </Text>

        <Text style={styles.sectionTitle}>10. Disclaimers</Text>
        <Text style={styles.paragraph}>
          The App is provided "as is" without warranties of any kind. We do
          not guarantee the accuracy, reliability, or availability of listings
          or third-party services. Use at your own risk.
        </Text>

        <Text style={styles.sectionTitle}>11. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          To the maximum extent permitted by law, TrekRiderz will not be liable
          for indirect, incidental, special, consequential, or punitive
          damages arising out of your use of the App or any activities booked
          through it.
        </Text>

        <Text style={styles.sectionTitle}>12. Termination</Text>
        <Text style={styles.paragraph}>
          We reserve the right to suspend or terminate your account at any time
          for violation of these Terms or any conduct we deem harmful to the
          community. You may delete your account at any time via Profile
          Settings.
        </Text>

        <Text style={styles.sectionTitle}>13. Governing Law</Text>
        <Text style={styles.paragraph}>
          These Terms are governed by the laws of India. Disputes arising from
          these Terms will be subject to the exclusive jurisdiction of the
          courts in India unless otherwise agreed.
        </Text>

        <Text style={styles.sectionTitle}>14. Changes</Text>
        <Text style={styles.paragraph}>
          We may change these Terms. We will notify users of material changes
          and post the updated Terms in the App. Continued use after changes
          constitutes acceptance of the updated Terms.
        </Text>

        <Text style={styles.sectionTitle}>15. Contact</Text>
        <Text style={styles.paragraph}>
          For questions about these Terms contact: admin@trekriderz.in
        </Text>

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
  content: {
    padding: 20,
  },
  updated: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8CC63F',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    marginBottom: 4,
  },
});
