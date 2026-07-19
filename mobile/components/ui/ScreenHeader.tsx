import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppColors, Spacing } from '@/constants/theme';

// The back+title+spacer pattern 60 files hand-rolled independently (each
// with its own back-button size, spacer width, border color). One shared
// implementation instead — same visual shape, no more per-screen drift.
interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  fallbackRoute?: string;
}

export default function ScreenHeader({ title, onBack, right, fallbackRoute = '/(tabs)' }: Props) {
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackRoute as any)));

  return (
    <SafeAreaView edges={['top']} style={styles.safeTop}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={6}>
          <Ionicons name="arrow-back" size={22} color={AppColors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {right ?? <View style={styles.spacer} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeTop: { backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
    gap: Spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: AppColors.text },
  spacer: { width: 38 },
});
