import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface UpcomingTripCardData {
  id: string;
  image?: string | null;
  title: string;
  destination: string;
  dateLabel: string;
  organizerName: string;
  organizerAvatar?: string | null;
  membersJoined: number;
  difficulty?: string | null;
  seatsLeft?: number | null;
  price?: number | null;
  joinState: 'none' | 'pending' | 'joined' | 'own';
}

interface Props {
  item: UpcomingTripCardData;
  onPress: () => void;
  onJoin: () => void;
}

export default function UpcomingTripCard({ item, onPress, onJoin }: Props) {
  const joinLabel = item.joinState === 'own' ? 'Yours' : item.joinState === 'joined' ? 'Joined' : item.joinState === 'pending' ? 'Requested' : 'Join';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="map-outline" size={30} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        {item.difficulty && (
          <View style={styles.diffBadge}><Text style={styles.diffText}>{item.difficulty}</Text></View>
        )}
        {item.seatsLeft != null && item.seatsLeft <= 3 && item.seatsLeft > 0 && (
          <View style={styles.seatsBadge}><Text style={styles.seatsText}>{item.seatsLeft} seats left</Text></View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={AppColors.primary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.destination}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={AppColors.subtext} />
          <Text style={styles.metaText}>{item.dateLabel}</Text>
        </View>

        <View style={styles.organizerRow}>
          {item.organizerAvatar ? (
            <Image source={{ uri: item.organizerAvatar }} style={styles.organizerAvatar} />
          ) : (
            <View style={[styles.organizerAvatar, styles.organizerAvatarFallback]}>
              <Text style={styles.organizerInitial}>{item.organizerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.organizerName} numberOfLines={1}>{item.organizerName}</Text>
          <View style={styles.membersChip}>
            <Ionicons name="people-outline" size={11} color={AppColors.subtext} />
            <Text style={styles.membersText}>{item.membersJoined}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {item.price ? (
            <Text style={styles.price}>₹{item.price.toLocaleString('en-IN')}<Text style={styles.priceUnit}>/person</Text></Text>
          ) : (
            <Text style={styles.priceUnit}>Free to join</Text>
          )}
          <TouchableOpacity
            style={[styles.joinBtn, item.joinState !== 'none' && styles.joinBtnDone]}
            onPress={onJoin}
            disabled={item.joinState !== 'none'}
          >
            <Text style={[styles.joinBtnText, item.joinState !== 'none' && styles.joinBtnTextDone]}>{joinLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 270,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 150 },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  diffBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(140,198,63,0.9)', borderRadius: Radius.pill,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  diffText: { color: '#080C14', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  seatsBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: Radius.pill,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  seatsText: { color: '#FFF', fontSize: 9.5, fontWeight: '800' },
  body: { padding: Spacing.md, gap: 5 },
  title: { color: AppColors.text, fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11.5, flex: 1 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  organizerAvatar: { width: 20, height: 20, borderRadius: 10 },
  organizerAvatarFallback: { backgroundColor: 'rgba(140,198,63,0.2)', alignItems: 'center', justifyContent: 'center' },
  organizerInitial: { color: AppColors.primary, fontSize: 10, fontWeight: '800' },
  organizerName: { color: AppColors.subtext, fontSize: 11, flex: 1 },
  membersChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  membersText: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: AppColors.border,
  },
  price: { color: AppColors.primary, fontSize: 14, fontWeight: '800' },
  priceUnit: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
  joinBtn: { backgroundColor: AppColors.primary, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  joinBtnDone: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: AppColors.border },
  joinBtnText: { color: '#080C14', fontSize: 12, fontWeight: '800' },
  joinBtnTextDone: { color: AppColors.text },
});
