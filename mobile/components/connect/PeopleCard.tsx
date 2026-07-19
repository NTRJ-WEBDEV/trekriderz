import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface PeopleCardData {
  id: string;
  name: string;
  avatar?: string | null;
  location?: string | null;
  verified: boolean;
  following?: boolean;
}

interface Props {
  item: PeopleCardData;
  onPress: () => void;
  onFollow: (id: string, next: boolean) => void;
}

// "Travelers / Backpackers / Photographers / Ride Captains / Mountaineers"
// in the spec are interest categories — there's no interest/tag field on
// users to actually classify by, so this renders one honest suggested-
// people list rather than fake per-category buckets.
export default function PeopleCard({ item, onPress, onFollow }: Props) {
  const [following, setFollowing] = useState(!!item.following);
  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    onFollow(item.id, next);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.verified && <Ionicons name="checkmark-circle" size={13} color="#3897F0" />}
      </View>
      {item.location && <Text style={styles.location} numberOfLines={1}>{item.location}</Text>}
      <TouchableOpacity style={[styles.followBtn, following && styles.followBtnActive]} onPress={toggleFollow}>
        <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>{following ? 'Following' : 'Follow'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 130,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: AppColors.primary },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: AppColors.primary, fontSize: 20, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  name: { color: AppColors.text, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  location: { color: AppColors.subtext, fontSize: 10 },
  followBtn: {
    backgroundColor: AppColors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 2, alignSelf: 'stretch', alignItems: 'center',
  },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: AppColors.border },
  followBtnText: { color: '#080C14', fontSize: 10.5, fontWeight: '800' },
  followBtnTextActive: { color: AppColors.text },
});
