import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

export interface ListingCardData {
  id: string;
  image?: string | null;
  title: string;
  subtitle: string;
  badgeLabel?: string;
}

interface Props {
  item: ListingCardData;
  onPress: () => void;
}

// Wide, full-bleed-image card with a bottom gradient — the "premium
// spotlight" treatment for TrekRiderz Recommends, visually distinct from
// AdventureCard's portrait grid shape rather than reusing it verbatim.
export default function ListingCard({ item, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.imageFallback]} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(8,12,20,0.55)', 'rgba(8,12,20,0.95)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {item.badgeLabel && (
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={11} color="#080C14" />
          <Text style={styles.badgeText}>{item.badgeLabel}</Text>
        </View>
      )}
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    height: 160,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  imageFallback: { backgroundColor: AppColors.card },
  badge: {
    position: 'absolute', top: Spacing.sm, left: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: AppColors.primary,
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { color: '#080C14', fontSize: 10, fontWeight: '800' },
  textWrap: { padding: Spacing.md },
  title: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
});
