import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

// Filter-sheet chips (price range, difficulty, distance...) — visually
// distinct from CategoryChip: no emoji, shows a checkmark when selected
// rather than swapping the whole chip's tint.
export default function FilterChip({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {selected && <Ionicons name="checkmark" size={14} color={AppColors.background} style={styles.check} />}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  check: { marginRight: 4 },
  label: { color: AppColors.text, fontSize: 13, fontWeight: '600' },
  labelSelected: { color: AppColors.background, fontWeight: '800' },
});
