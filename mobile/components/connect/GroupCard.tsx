import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface GroupCardData {
  id: string;
  name: string;
  image?: string | null;
  memberCount: number;
  joinState: 'none' | 'pending' | 'approved';
}

interface Props {
  item: GroupCardData;
  onPress: () => void;
  onJoin: () => void;
}

// "Upcoming Event" has no backing concept on communities today (only
// posts/messages) — shown as an honest "No upcoming event" line rather
// than fabricated.
export default function GroupCard({ item, onPress, onJoin }: Props) {
  const joinLabel = item.joinState === 'approved' ? 'Joined' : item.joinState === 'pending' ? 'Requested' : 'Join';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Ionicons name="people-circle-outline" size={30} color="rgba(255,255,255,0.2)" />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={12} color={AppColors.primary} />
          <Text style={styles.metaText}>{item.memberCount} members</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={AppColors.subtext} />
          <Text style={styles.metaText}>No upcoming event</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinBtn, item.joinState !== 'none' && styles.joinBtnDone]}
          onPress={onJoin}
          disabled={item.joinState !== 'none'}
        >
          <Text style={[styles.joinBtnText, item.joinState !== 'none' && styles.joinBtnTextDone]}>{joinLabel}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 110 },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.md, gap: 5 },
  name: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11 },
  joinBtn: { backgroundColor: AppColors.primary, borderRadius: Radius.pill, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  joinBtnDone: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: AppColors.border },
  joinBtnText: { color: '#080C14', fontSize: 11.5, fontWeight: '800' },
  joinBtnTextDone: { color: AppColors.text },
});
