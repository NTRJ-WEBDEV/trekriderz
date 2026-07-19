import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface EventCardItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

interface Props {
  item: EventCardItem;
}

// TrekRiderz-run events — no events table/backend exists yet, so this is a
// placeholder slot. Distinct from ComingSoonCard (Adventure's feature
// placeholders) since these are event concepts, not app features.
export default function EventCard({ item }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => Alert.alert(item.title, "We'll announce dates for this here once it's scheduled.")}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={item.icon} size={26} color={AppColors.primary} />
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <View style={styles.badge}><Text style={styles.badgeText}>Announcing Soon</Text></View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderStyle: 'dashed',
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(140,198,63,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: AppColors.text, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  badge: {
    backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { color: AppColors.primary, fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase' },
});
