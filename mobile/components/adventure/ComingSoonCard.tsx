import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface ComingSoonItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

interface Props {
  item: ComingSoonItem;
}

// Visual-only reserved slot for a future feature with no backend at all
// (AI Trip Planner, Offline Maps, etc.) — tapping surfaces an honest "not
// built yet" message rather than pretending to do something.
export default function ComingSoonCard({ item }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => Alert.alert(item.title, "This is coming to TrekRiderz soon — we'll let you know when it's ready.")}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={22} color={AppColors.primary} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle} numberOfLines={2}>{item.subtitle}</Text>
      <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
    gap: 5,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  title: { color: AppColors.text, fontSize: 13, fontWeight: '700' },
  subtitle: { color: AppColors.subtext, fontSize: 10.5, lineHeight: 14 },
  badge: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { color: AppColors.primary, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
});
