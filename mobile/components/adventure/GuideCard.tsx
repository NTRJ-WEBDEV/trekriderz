import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface GuideCardData {
  id: string;
  photoUrl?: string | null;
  name: string;
  location?: string | null;
  languages?: string[] | null;
  experienceYears?: number | null;
  treksCompleted?: number | null; // no backing column today
  rating?: number | null;
  totalReviews?: number | null;
  verified: boolean;
  ratePerDay?: number | null;
}

interface Props {
  item: GuideCardData;
  onPress: () => void;
  onBookPress: () => void;
}

export default function GuideCard({ item, onPress, onBookPress }: Props) {
  const languages = (item.languages || []).slice(0, 3);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.topRow}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {item.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#3897F0" />
          </View>
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      {item.location && (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={11} color={AppColors.primary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={styles.statText}>{item.rating ? item.rating.toFixed(1) : 'New'}{item.totalReviews ? ` (${item.totalReviews})` : ''}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="ribbon-outline" size={11} color={AppColors.subtext} />
          <Text style={styles.statText}>{item.experienceYears ? `${item.experienceYears}yr exp` : '—'}</Text>
        </View>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="trail-sign-outline" size={11} color={AppColors.subtext} />
        <Text style={styles.statText}>{item.treksCompleted ? `${item.treksCompleted} treks led` : 'Treks led — coming soon'}</Text>
      </View>

      {languages.length > 0 && (
        <View style={styles.langRow}>
          {languages.map((l) => (
            <View key={l} style={styles.langChip}><Text style={styles.langText}>{l}</Text></View>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        {item.ratePerDay ? (
          <Text style={styles.price}>₹{item.ratePerDay.toLocaleString('en-IN')}<Text style={styles.priceUnit}>/day</Text></Text>
        ) : <View />}
        <TouchableOpacity style={styles.bookBtn} onPress={onBookPress}>
          <Text style={styles.bookBtnText}>Book Guide</Text>
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
    padding: Spacing.md,
    gap: 4,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: AppColors.primary },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: AppColors.primary, fontSize: 20, fontWeight: '800' },
  verifiedBadge: { alignSelf: 'flex-start' },
  name: { color: AppColors.text, fontSize: 14.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11.5 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  langChip: {
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  langText: { color: AppColors.primary, fontSize: 10, fontWeight: '600' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: AppColors.border,
  },
  price: { color: AppColors.primary, fontSize: 13.5, fontWeight: '800' },
  priceUnit: { color: AppColors.subtext, fontSize: 10, fontWeight: '600' },
  bookBtn: { backgroundColor: AppColors.primary, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  bookBtnText: { color: '#080C14', fontSize: 11.5, fontWeight: '800' },
});
