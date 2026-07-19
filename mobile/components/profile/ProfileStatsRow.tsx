import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppColors, Spacing, Radius } from '@/constants/theme';

export interface ProfileStat {
  label: string;
  value: string | number;
  onPress?: () => void;
}

interface Props {
  stats: ProfileStat[];
}

// Identity stats (Posts/Followers/Following/Trips...) — all backed by real
// queries the caller passes in. A wrapping grid rather than a fixed row so
// it works whether the caller passes 3 stats or 6.
export default function ProfileStatsRow({ stats }: Props) {
  return (
    <View style={styles.card}>
      {stats.map((stat, i) => {
        const content = (
          <>
            <Text style={styles.value}>{stat.value}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </>
        );
        const isLastInRow = (i + 1) % 3 === 0;
        return stat.onPress ? (
          <TouchableOpacity
            key={stat.label}
            style={[styles.stat, !isLastInRow && styles.statDivider]}
            onPress={stat.onPress}
            activeOpacity={0.7}
          >
            {content}
          </TouchableOpacity>
        ) : (
          <View key={stat.label} style={[styles.stat, !isLastInRow && styles.statDivider]}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: AppColors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: Spacing.md,
  },
  stat: {
    flexBasis: '33.33%',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: AppColors.border,
  },
  value: { color: AppColors.text, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  label: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
});
