import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpeditionItineraryDay } from '@/lib/expeditions';

interface ItineraryTimelineProps {
  days: ExpeditionItineraryDay[];
}

const ACTIVITY_ICONS: Record<string, any> = {
  trek: 'walk-outline',
  hike: 'walk-outline',
  camp: 'bonfire-outline',
  summit: 'trending-up-outline',
  lake: 'water-outline',
  river: 'water-outline',
  village: 'business-outline',
  rest: 'bed-outline',
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  dinner: 'restaurant-outline',
  photo: 'camera-outline',
  forest: 'leaf-outline',
  default: 'ellipse-outline',
};

function getActivityIcon(activity: string): any {
  const lower = activity.toLowerCase();
  for (const [key, icon] of Object.entries(ACTIVITY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return ACTIVITY_ICONS.default;
}

export default function ItineraryTimeline({ days }: ItineraryTimelineProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));

  const toggleDay = (index: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!days || days.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="map-outline" size={40} color="rgba(255,255,255,0.1)" />
        <Text style={styles.emptyText}>Detailed itinerary coming soon</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {days.map((day, index) => {
        const isExpanded = expandedDays.has(index);
        const isLast = index === days.length - 1;

        return (
          <View key={day.id || index} style={styles.dayRow}>
            {/* Left: Timeline indicator */}
            <View style={styles.timelineLeft}>
              {/* Day bubble */}
              <View style={styles.dayBubble}>
                <Text style={styles.dayBubbleText}>{day.day_number}</Text>
              </View>
              {/* Connector line to next day */}
              {!isLast && <View style={styles.connector} />}
            </View>

            {/* Right: Day card */}
            <View style={[styles.dayCard, isLast && styles.dayCardLast]}>
              {/* Header — tappable */}
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => toggleDay(index)}
                activeOpacity={0.7}
              >
                <View style={styles.dayHeaderLeft}>
                  <Text style={styles.dayLabel}>Day {day.day_number}</Text>
                  <Text style={styles.dayTitle}>{day.title}</Text>
                  {/* Quick stats */}
                  {(day.distance_km || day.elevation_gain_m) && (
                    <View style={styles.dayStats}>
                      {day.distance_km && (
                        <View style={styles.statChip}>
                          <Ionicons name="footsteps-outline" size={11} color="#8CC63F" />
                          <Text style={styles.statChipText}>{day.distance_km} km</Text>
                        </View>
                      )}
                      {day.elevation_gain_m && (
                        <View style={styles.statChip}>
                          <Ionicons name="trending-up-outline" size={11} color="#FF6B35" />
                          <Text style={styles.statChipText}>+{day.elevation_gain_m}m</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {/* Expanded content */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  {/* Description */}
                  {day.description && (
                    <Text style={styles.description}>{day.description}</Text>
                  )}

                  {/* Activities */}
                  {Array.isArray(day.activities) && day.activities.length > 0 && (
                    <View style={styles.activitiesSection}>
                      <Text style={styles.sectionLabel}>Activities</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.activitiesScroll}
                      >
                        {day.activities.map((activity, aIdx) => (
                          <View key={aIdx} style={styles.activityChip}>
                            <Ionicons
                              name={getActivityIcon(activity)}
                              size={13}
                              color="#8CC63F"
                            />
                            <Text style={styles.activityText}>{activity}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Accommodation */}
                  {day.accommodation && (
                    <View style={styles.infoRow}>
                      <Ionicons name="bed-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.infoText}>{day.accommodation}</Text>
                    </View>
                  )}

                  {/* Meals */}
                  {Array.isArray(day.meals_included) && day.meals_included.length > 0 && (
                    <View style={styles.infoRow}>
                      <Ionicons name="restaurant-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.infoText}>{day.meals_included.join(', ')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 40,
  },
  dayBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(140,198,63,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBubbleText: {
    color: '#8CC63F',
    fontWeight: '700',
    fontSize: 14,
  },
  connector: {
    width: 1.5,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
    minHeight: 20,
  },
  dayCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  dayCardLast: {
    marginBottom: 0,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  dayHeaderLeft: {
    flex: 1,
    gap: 3,
  },
  dayLabel: {
    color: '#8CC63F',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dayTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  dayStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statChipText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '500',
  },
  expandedContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  description: {
    color: '#D1D5DB',
    fontSize: 13.5,
    lineHeight: 20,
  },
  activitiesSection: {
    gap: 6,
  },
  sectionLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activitiesScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activityText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#9CA3AF',
    fontSize: 13,
    flex: 1,
  },
});
