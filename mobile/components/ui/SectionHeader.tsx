import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

// Reused above every horizontal section (Popular Treks, Homestays, Guides,
// Rentals, Expeditions, Recommends) — one title+subtitle+"See All" shape.
export default function SectionHeader({ title, subtitle, onSeeAll }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {onSeeAll && (
        <TouchableOpacity style={styles.seeAll} onPress={onSeeAll} hitSlop={6}>
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={14} color={AppColors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: AppColors.subtext, fontSize: 12, marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 },
  seeAllText: { color: AppColors.primary, fontSize: 13, fontWeight: '700' },
});
