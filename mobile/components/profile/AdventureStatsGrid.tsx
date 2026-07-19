import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing, Radius } from '@/constants/theme';

export interface AdventureStat {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number | null;
  unit?: string;
}

interface Props {
  stats: AdventureStat[];
}

// "Passport stamp" style cards for trekking-specific stats (distance,
// treks completed, etc.) that have no backing column yet — every card
// renders a "—" placeholder until a real value is passed in, so this
// component doesn't change shape when that backend work lands later.
export default function AdventureStatsGrid({ stats }: Props) {
  return (
    <View style={styles.grid}>
      {stats.map((stat) => {
        const hasValue = stat.value !== undefined && stat.value !== null;
        return (
          <View key={stat.label} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={stat.icon} size={18} color={AppColors.primary} />
            </View>
            {hasValue ? (
              <Text style={styles.value}>
                {stat.value}{stat.unit ? <Text style={styles.unit}> {stat.unit}</Text> : null}
              </Text>
            ) : (
              <Text style={styles.placeholder}>—</Text>
            )}
            <Text style={styles.label}>{stat.label}</Text>
            {!hasValue && <Text style={styles.comingSoon}>Coming soon</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  card: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: AppColors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(140,198,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: { color: AppColors.text, fontSize: 16, fontWeight: '800' },
  unit: { color: AppColors.subtext, fontSize: 11, fontWeight: '600' },
  placeholder: { color: AppColors.subtext, fontSize: 16, fontWeight: '800' },
  label: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600', textAlign: 'center' },
  comingSoon: { color: 'rgba(140,198,63,0.55)', fontSize: 8.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
});
