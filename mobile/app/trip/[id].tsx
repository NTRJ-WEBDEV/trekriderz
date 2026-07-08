import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import WeatherCard from '@/components/WeatherCard';
import SOSButton from '@/components/SOSButton';
import { shareTripItinerary } from '@/lib/trip-export';

interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  trip_type: string;
  group_size: number;
  budget: number;
  status: string;
  itinerary: any;
  packing_list: any;
  created_by: string;
  lat?: number;
  lng?: number;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user: currentUser } = useAuthStore();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    fetchTripDetails();
  }, [id]);

  const fetchTripDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setTrip(data);
      setIsOrganizer(data.created_by === currentUser?.id);
    } catch (error) {
      console.error('Error fetching trip:', error);
      Alert.alert('Error', 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  };

  const getTripTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      trek: '🥾', bike: '🏍️', temple: '🛕', backpacking: '🎒', weekend: '🌄',
    };
    return emojis[type] || '🗺️';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  };

  const getDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Syncing adventure...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Trip not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const duration = getDuration(trip.start_date, trip.end_date);
  const perPersonBudget = Math.round(trip.budget / trip.group_size);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Details</Text>
        {isOrganizer ? (
          <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Edit feature is being developed')}>
            <Ionicons name="create-outline" size={24} color="#8CC63F" />
          </TouchableOpacity>
        ) : <View style={{ width: 20 }} />}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{getTripTypeEmoji(trip.trip_type)}</Text>
          <Text style={styles.heroTitle}>{trip.title}</Text>
          <Text style={styles.heroDestination}>📍 {trip.destination}</Text>
          <View style={[styles.statusBadge, (styles as any)[`status${trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}`]]}>
            <Text style={styles.statusText}>{trip.status}</Text>
          </View>
        </View>

        {trip.lat && trip.lng && (
          <View style={{ padding: 20, paddingTop: 0 }}>
            <WeatherCard lat={Number(trip.lat)} lng={Number(trip.lng)} locationName={trip.destination} />
          </View>
        )}

        <View style={styles.infoSection}>
          <InfoCard icon="📅" title="Dates" value={`${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}`} subtitle={`${duration} days plan`} />
          <InfoCard icon="👥" title="Travelers" value={`${trip.group_size} People`} />
          <InfoCard icon="💰" title="Budget" value={`₹${trip.budget.toLocaleString()}`} subtitle={`₹${perPersonBudget.toLocaleString()} / head`} />
        </View>

        <View style={styles.actionsSection}>
          {isOrganizer && (
            <ActionButton
              icon="🤖"
              title="Optimize Itinerary"
              subtitle="Generate day-wise plan with AI"
              onPress={() => router.push(`/itinerary/${trip.id}` as any)}
              primary
            />
          )}
          <ActionButton
            icon="📤"
            title="Export & Share"
            subtitle="Send itinerary to WhatsApp or Email"
            onPress={() => shareTripItinerary(trip)}
          />
          <ActionButton
            icon="👥"
            title="Trip Members"
            subtitle="Connections & managing invites"
            onPress={() => router.push(`/trip-members/${trip.id}` as any)}
          />
          <ActionButton
            icon="💬"
            title="Group Chat"
            subtitle="Chat with trip members"
            onPress={() => router.push(`/chat/${trip.id}` as any)}
          />
          <ActionButton
            icon="💰"
            title="Budget Tracker"
            subtitle="Track expenses & split costs"
            onPress={() => router.push(`/budget/${trip.id}` as any)}
          />
          <ActionButton
            icon="🗺️"
            title="Interactive Map"
            subtitle="View location & live tracking"
            onPress={() => router.push(`/map/${trip.id}` as any)}
          />
          <ActionButton
            icon="🎒"
            title="Packing Checklist"
            subtitle="Items recommended for this trip"
            onPress={() => router.push(`/packing/${trip.id}` as any)}
          />
          <ActionButton
            icon="🛡️"
            title="Safety Info"
            subtitle="Emergency contacts & safety tips"
            onPress={() => router.push(`/safety/${trip.id}` as any)}
          />
        </View>

        <View style={[styles.section, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View>
            <Text style={styles.sectionTitle}>Emergency</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Long press SOS to alert contacts</Text>
          </View>
          <SOSButton tripName={trip.title} location={trip.destination} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Budget Estimation</Text>
          <BudgetItem category="Stay & Lodging" amount={trip.budget * 0.4} />
          <BudgetItem category="Travel & Tickets" amount={trip.budget * 0.3} />
          <BudgetItem category="Dining" amount={trip.budget * 0.2} />
          <BudgetItem category="Misc" amount={trip.budget * 0.1} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ icon, title, value, subtitle }: any) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoValue}>{value}</Text>
        {subtitle && <Text style={styles.infoSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function ActionButton({ icon, title, subtitle, onPress, primary }: any) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, primary && styles.actionButtonPrimary]}
      onPress={onPress}
    >
      <Text style={styles.actionIcon}>{icon}</Text>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, primary && styles.actionTitlePrimary]}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={primary ? '#080C14' : 'rgba(255,255,255,0.4)'} />
    </TouchableOpacity>
  );
}

function BudgetItem({ category, amount }: any) {
  return (
    <View style={styles.budgetItem}>
      <Text style={styles.budgetCategory}>{category}</Text>
      <Text style={styles.budgetAmount}>₹{Math.round(amount).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
  },
  backButton: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#080C14',
    fontWeight: '700',
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
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroDestination: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusPlanning: {
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  statusConfirmed: {
    backgroundColor: 'rgba(140,198,63,0.2)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  infoSection: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  infoIcon: {
    fontSize: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  infoSubtitle: {
    color: '#8CC63F',
    fontSize: 12,
    marginTop: 2,
  },
  actionsSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonPrimary: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  actionIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  actionTitlePrimary: {
    color: '#080C14',
  },
  actionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  budgetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  budgetCategory: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  budgetAmount: {
    color: '#8CC63F',
    fontSize: 15,
    fontWeight: '700',
  },
});
