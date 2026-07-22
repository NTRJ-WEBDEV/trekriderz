import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import type { PublicTrustSignal } from '@/lib/services/TrustEngineService';

interface Props {
  signals: PublicTrustSignal[];
}

// Traveller Discovery Experience — UX_BLUEPRINT.md §4: "Verification badge
// is tap-to-explain, never a bare icon." Every chip here opens a
// plain-language explanation of what was actually checked rather than
// just asserting "Verified" and expecting faith. Reused across all four
// listing detail screens instead of each hand-rolling its own badge.
export default function TrustSignalBadges({ signals }: Props) {
  if (signals.length === 0) return null;

  return (
    <View style={styles.row}>
      {signals.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={styles.chip}
          activeOpacity={0.75}
          onPress={() => Alert.alert(s.label, s.explanation)}
        >
          <Ionicons name={s.icon as any} size={13} color={AppColors.primary} />
          <Text style={styles.label}>{s.label}</Text>
          <Ionicons name="information-circle-outline" size={12} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)',
  },
  label: { color: AppColors.primary, fontSize: 12, fontWeight: '700' },
});
