import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface RideCardData {
  id: string;
  title: string;
  rideTimeLabel: string;
  meetupPoint?: string | null;
  distanceKm?: number | null; // no backing column today
  captainName: string;
  captainAvatar?: string | null;
  participants: number;
  joinState: 'none' | 'pending' | 'joined' | 'own';
}

interface Props {
  item: RideCardData;
  onPress: () => void;
  onJoin: () => void;
}

export default function RideCard({ item, onPress, onJoin }: Props) {
  const joinLabel = item.joinState === 'own' ? 'Yours' : item.joinState === 'joined' ? 'Joined' : item.joinState === 'pending' ? 'Requested' : 'Join Ride';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.iconWrap}>
        <Ionicons name="bicycle-outline" size={22} color={AppColors.primary} />
      </View>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={12} color={AppColors.subtext} />
        <Text style={styles.metaText}>{item.rideTimeLabel}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={12} color={AppColors.primary} />
        <Text style={styles.metaText} numberOfLines={1}>{item.meetupPoint || 'Meetup point TBD'}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="speedometer-outline" size={12} color={AppColors.subtext} />
        <Text style={styles.metaText}>{item.distanceKm ? `${item.distanceKm} km` : 'Distance — TBD'}</Text>
      </View>

      <View style={styles.captainRow}>
        {item.captainAvatar ? (
          <Image source={{ uri: item.captainAvatar }} style={styles.captainAvatar} />
        ) : (
          <View style={[styles.captainAvatar, styles.captainAvatarFallback]}>
            <Text style={styles.captainInitial}>{item.captainName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.captainName} numberOfLines={1}>{item.captainName}</Text>
        <View style={styles.participantsChip}>
          <Ionicons name="people-outline" size={11} color={AppColors.subtext} />
          <Text style={styles.participantsText}>{item.participants}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.joinBtn, item.joinState !== 'none' && styles.joinBtnDone]}
        onPress={onJoin}
        disabled={item.joinState !== 'none'}
      >
        <Text style={[styles.joinBtnText, item.joinState !== 'none' && styles.joinBtnTextDone]}>{joinLabel}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 210,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
    gap: 5,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { color: AppColors.text, fontSize: 14.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11, flex: 1 },
  captainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  captainAvatar: { width: 20, height: 20, borderRadius: 10 },
  captainAvatarFallback: { backgroundColor: 'rgba(140,198,63,0.2)', alignItems: 'center', justifyContent: 'center' },
  captainInitial: { color: AppColors.primary, fontSize: 10, fontWeight: '800' },
  captainName: { color: AppColors.subtext, fontSize: 10.5, flex: 1 },
  participantsChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  participantsText: { color: AppColors.subtext, fontSize: 10, fontWeight: '600' },
  joinBtn: { backgroundColor: AppColors.primary, borderRadius: Radius.pill, paddingVertical: 9, alignItems: 'center', marginTop: 6 },
  joinBtnDone: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: AppColors.border },
  joinBtnText: { color: '#080C14', fontSize: 12, fontWeight: '800' },
  joinBtnTextDone: { color: AppColors.text },
});
