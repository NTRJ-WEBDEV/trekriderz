import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface RentalCardData {
  id: string;
  image?: string | null;
  title: string;
  location: string;
  pricePerDay?: number | null;
  available: boolean;
  verified: boolean; // status === 'approved'
}

interface Props {
  item: RentalCardData;
  onPress: () => void;
}

export default function RentalCard({ item, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="car-outline" size={28} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        <View style={[styles.availBadge, !item.available && styles.availBadgeOff]}>
          <Text style={styles.availText}>{item.available ? 'Available' : 'Booked'}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          {item.verified && <Ionicons name="checkmark-circle" size={14} color="#3897F0" />}
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={AppColors.primary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
        </View>
        {item.pricePerDay ? (
          <Text style={styles.price}>₹{item.pricePerDay.toLocaleString('en-IN')}<Text style={styles.priceUnit}>/day</Text></Text>
        ) : (
          <Text style={styles.priceUnit}>Price on request</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 190,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 110 },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  availBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(34,197,94,0.9)', borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  availBadgeOff: { backgroundColor: 'rgba(107,114,128,0.85)' },
  availText: { color: '#080C14', fontSize: 9.5, fontWeight: '800' },
  body: { padding: Spacing.md, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  title: { color: AppColors.text, fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11, flex: 1 },
  price: { color: AppColors.primary, fontSize: 13.5, fontWeight: '800', marginTop: 2 },
  priceUnit: { color: AppColors.subtext, fontSize: 10, fontWeight: '600' },
});
