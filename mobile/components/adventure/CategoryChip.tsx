import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AppColors, Radius, Spacing } from '@/constants/theme';

interface Props {
  emoji: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
}

// Horizontal quick-category chips under the search bar (Trek, Bike Ride,
// Camping...) — also reused for the Rentals section's equipment categories.
export default function CategoryChip({ emoji, label, active, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(140,198,63,0.14)',
    borderColor: 'rgba(140,198,63,0.4)',
  },
  emoji: { fontSize: 14 },
  label: { color: AppColors.subtext, fontSize: 12.5, fontWeight: '600' },
  labelActive: { color: AppColors.primary },
});
