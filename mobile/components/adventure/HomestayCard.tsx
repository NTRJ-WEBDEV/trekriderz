import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface HomestayCardData {
  id: string;
  image?: string | null;
  name: string;
  location: string;
  pricePerNight?: number | null;
  rating?: number | null;
  amenities?: string[] | null;
  verified: boolean; // status === 'approved'
}

interface Props {
  item: HomestayCardData;
  onPress: () => void;
}

export default function HomestayCard({ item, onPress }: Props) {
  const amenities = (item.amenities || []).slice(0, 3);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="home-outline" size={28} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        {item.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#080C14" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={AppColors.primary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
        </View>

        {amenities.length > 0 && (
          <View style={styles.amenityRow}>
            {amenities.map((a) => (
              <View key={a} style={styles.amenityChip}><Text style={styles.amenityText}>{a}</Text></View>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          {item.pricePerNight ? (
            <Text style={styles.price}>₹{item.pricePerNight.toLocaleString('en-IN')}<Text style={styles.priceUnit}>/night</Text></Text>
          ) : <Text style={styles.priceUnit}>Price on request</Text>}
          {item.rating != null && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 230,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 130 },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  verifiedBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: AppColors.primary, borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verifiedText: { color: '#080C14', fontSize: 9.5, fontWeight: '800' },
  body: { padding: Spacing.md, gap: 6 },
  title: { color: AppColors.text, fontSize: 14.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11.5, flex: 1 },
  amenityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  amenityChip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  amenityText: { color: AppColors.subtext, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: AppColors.border,
  },
  price: { color: AppColors.primary, fontSize: 14, fontWeight: '800' },
  priceUnit: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
});
