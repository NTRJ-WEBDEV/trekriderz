import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface OrganizerCardData {
  id: string;
  name: string;
  avatar?: string | null;
  tripsConducted: number;
  followers: number;
  rating?: number | null; // no backing column today
  verified: boolean;
  following?: boolean;
}

interface Props {
  item: OrganizerCardData;
  onPress: () => void;
  onFollow: (id: string, next: boolean) => void;
}

// Cover has no backing column on users — same gradient-fallback treatment
// as ProfileHeader's cover, kept visually consistent across the app.
export default function OrganizerCard({ item, onPress, onFollow }: Props) {
  const [following, setFollowing] = useState(!!item.following);
  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    onFollow(item.id, next);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={['rgba(140,198,63,0.25)', 'rgba(8,12,20,0.9)']} style={styles.cover} />
      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {item.verified && (
            <View style={styles.verifiedDot}><Ionicons name="checkmark" size={9} color="#080C14" /></View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.tripsConducted}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.rating ? item.rating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.followBtn, following && styles.followBtnActive]} onPress={toggleFollow}>
          <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>{following ? 'Following' : 'Follow'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  cover: { height: 54, width: '100%' },
  body: { padding: Spacing.md, paddingTop: 0, alignItems: 'center', gap: 6, marginTop: -26 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: AppColors.card },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: AppColors.primary, fontSize: 19, fontWeight: '800' },
  verifiedDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: AppColors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: AppColors.card,
  },
  name: { color: AppColors.text, fontSize: 13.5, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  statItem: { alignItems: 'center' },
  statValue: { color: AppColors.text, fontSize: 13, fontWeight: '800' },
  statLabel: { color: AppColors.subtext, fontSize: 8.5, fontWeight: '600' },
  followBtn: {
    backgroundColor: AppColors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 7, marginTop: 4, alignSelf: 'stretch', alignItems: 'center',
  },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: AppColors.border },
  followBtnText: { color: '#080C14', fontSize: 11.5, fontWeight: '800' },
  followBtnTextActive: { color: AppColors.text },
});
