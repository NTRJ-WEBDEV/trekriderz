import { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

export interface ItineraryDay {
  day: number;
  title: string;
  activities: {
    time: string;
    activity: string;
    description: string;
    location?: string;
    duration?: string;
    cost?: number;
  }[];
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  accommodation: string;
  dailyBudget: number;
}

export interface FullItinerary {
  days: ItineraryDay[];
  packingList: string[];
  safetyTips: string[];
  localTips: string[];
}

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [itinerary, setItinerary] = useState<FullItinerary | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);

  const generateItinerary = async () => {
    setGenerating(true);

    try {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;

      const { data, error: functionError } = await supabase.functions.invoke('generate-itinerary', {
        body: {
          tripId,
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          budget: trip.budget,
          budgetType: trip.budget_type,
          tripType: trip.trip_type,
          groupSize: trip.group_size,
        },
      });

      if (functionError) throw functionError;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate itinerary');

      setItinerary(data.itinerary);

      Alert.alert('Success!', 'Your AI itinerary has been generated', [{ text: 'OK' }]);
    } catch (error: any) {
      console.error('Error generating itinerary:', error);
      Alert.alert('Error', error.message || 'Failed to generate itinerary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const loadExistingItinerary = async () => {
    setLoading(true);
    try {
      const { data: trip, error } = await supabase
        .from('trips')
        .select('itinerary')
        .eq('id', tripId)
        .single();

      if (error) throw error;

      if (trip?.itinerary) {
        setItinerary(trip.itinerary);
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    loadExistingItinerary();
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Loading itinerary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (generating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.generatingContainer}>
          <Text style={styles.generatingEmoji}>🤖</Text>
          <ActivityIndicator size="large" color="#8CC63F" style={{ marginVertical: 16 }} />
          <Text style={styles.generatingTitle}>Generating Your Itinerary</Text>
          <Text style={styles.generatingSubtitle}>
            AI is creating a personalized plan for your trip...
          </Text>
          <View style={styles.generatingSteps}>
            <Text style={styles.stepText}>✓ Analyzing destination</Text>
            <Text style={styles.stepText}>✓ Calculating budget</Text>
            <Text style={styles.stepText}>⏳ Planning activities...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!itinerary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="#8CC63F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Itinerary</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No Itinerary Yet</Text>
          <Text style={styles.emptySubtitle}>
            Let AI create a personalized day-by-day plan for your trip
          </Text>
          <TouchableOpacity style={styles.generateButton} onPress={generateItinerary}>
            <Text style={styles.generateButtonText}>Generate AI Itinerary</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentDayData = itinerary.days.find(d => d.day === selectedDay);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Itinerary</Text>
        <TouchableOpacity onPress={generateItinerary} style={styles.regenerateBtn}>
          <Ionicons name="refresh" size={22} color="#8CC63F" />
        </TouchableOpacity>
      </View>

      {/* Day Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {itinerary.days.map((day) => (
          <TouchableOpacity
            key={day.day}
            style={[styles.dayTab, selectedDay === day.day && styles.dayTabActive]}
            onPress={() => setSelectedDay(day.day)}
          >
            <Text style={[styles.dayTabLabel, selectedDay === day.day && styles.dayTabLabelActive]}>
              Day {day.day}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {currentDayData && (
          <>
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{currentDayData.title}</Text>
              <Text style={styles.dayBudget}>Budget: ₹{currentDayData.dailyBudget?.toLocaleString()}</Text>
            </View>

            {/* Activities */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activities</Text>
              {currentDayData.activities.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={styles.activityTimeline}>
                    <View style={styles.timelineDot} />
                    {index < currentDayData.activities.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                    <Text style={styles.activityName}>{activity.activity}</Text>
                    {activity.description && (
                      <Text style={styles.activityDesc}>{activity.description}</Text>
                    )}
                    {activity.location && (
                      <View style={styles.activityLocation}>
                        <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.activityLocationText}>{activity.location}</Text>
                      </View>
                    )}
                    {activity.cost != null && (
                      <Text style={styles.activityCost}>₹{activity.cost?.toLocaleString()}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Meals */}
            {currentDayData.meals && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Meals</Text>
                <View style={styles.mealsCard}>
                  <MealRow icon="☀️" label="Breakfast" value={currentDayData.meals.breakfast} />
                  <MealRow icon="🌤️" label="Lunch" value={currentDayData.meals.lunch} />
                  <MealRow icon="🌙" label="Dinner" value={currentDayData.meals.dinner} />
                </View>
              </View>
            )}

            {/* Accommodation */}
            {currentDayData.accommodation && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Stay</Text>
                <View style={styles.accommodationCard}>
                  <Ionicons name="bed-outline" size={20} color="#8CC63F" />
                  <Text style={styles.accommodationText}>{currentDayData.accommodation}</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Tips section */}
        {itinerary.localTips && itinerary.localTips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Local Tips</Text>
            {itinerary.localTips.map((tip, i) => (
              <View key={i} style={styles.tipItem}>
                <Text style={styles.tipBullet}>•</Text>
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

function MealRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.mealRow}>
      <Text style={styles.mealIcon}>{icon}</Text>
      <View style={styles.mealContent}>
        <Text style={styles.mealLabel}>{label}</Text>
        <Text style={styles.mealValue}>{value}</Text>
      </View>
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
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  generatingEmoji: {
    fontSize: 64,
  },
  generatingTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  generatingSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  generatingSteps: {
    marginTop: 24,
    gap: 10,
    alignItems: 'flex-start',
  },
  stepText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
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
  regenerateBtn: {
    padding: 4,
  },
  placeholder: {
    width: 36,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  generateButton: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  generateButtonText: {
    color: '#080C14',
    fontSize: 16,
    fontWeight: '700',
  },
  daySelector: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  daySelectorContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 8,
  },
  dayTabActive: {
    backgroundColor: '#8CC63F',
  },
  dayTabLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  dayTabLabelActive: {
    color: '#080C14',
  },
  scrollView: {
    flex: 1,
  },
  dayHeader: {
    padding: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  dayBudget: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  activityItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  activityTimeline: {
    alignItems: 'center',
    width: 16,
    paddingTop: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8CC63F',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(140,198,63,0.3)',
    marginTop: 4,
    marginBottom: -4,
    minHeight: 24,
  },
  activityContent: {
    flex: 1,
    paddingBottom: 16,
  },
  activityTime: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityName: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  activityDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  activityLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  activityLocationText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  activityCost: {
    color: '#8CC63F',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  mealsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  mealContent: {
    flex: 1,
  },
  mealLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  mealValue: {
    color: 'white',
    fontSize: 14,
    marginTop: 1,
  },
  accommodationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  accommodationText: {
    color: 'white',
    fontSize: 15,
    flex: 1,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    color: '#8CC63F',
    fontSize: 16,
    lineHeight: 20,
  },
  tipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
