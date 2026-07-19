import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Spacing } from '@/constants/theme';

interface Props {
  onSearchPress?: () => void;
  onFilterPress?: () => void;
}

// CONNECT wordmark (plain text, deliberately not the app Wordmark component —
// this is a section identity, not the brand logo) + search/filter shortcuts.
export default function ConnectHeader({ onSearchPress, onFilterPress }: Props) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>CONNECT</Text>
        <Text style={styles.subtitle}>Find People. Join Adventures.</Text>
      </View>
      <View style={styles.icons}>
        <TouchableOpacity style={styles.iconBtn} onPress={onSearchPress} hitSlop={6}>
          <Ionicons name="search-outline" size={20} color={AppColors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onFilterPress} hitSlop={6}>
          <Ionicons name="options-outline" size={20} color={AppColors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  title: { color: AppColors.text, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: AppColors.subtext, fontSize: 12, fontWeight: '600', marginTop: 2 },
  icons: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: AppColors.card, alignItems: 'center', justifyContent: 'center',
  },
});
