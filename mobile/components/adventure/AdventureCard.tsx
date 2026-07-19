import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#22C55E',
  easy: '#22C55E',
  moderate: '#F59E0B',
  intermediate: '#F59E0B',
  challenging: '#EF4444',
  advanced: '#EF4444',
  expert: '#7C3AED',
};

export interface AdventureCardData {
  id: string;
  image?: string | null;
  title: string;
  location: string;
  difficulty?: string | null;   // trips.experience_level — real when present
  distanceKm?: number | null;   // no backing column today — stays undefined
  durationLabel?: string | null; // derived from start_date/end_date
  rating?: number | null;       // no backing column today — stays undefined
  startingPrice?: number | null;
  saved?: boolean;
}

interface Props {
  item: AdventureCardData;
  onPress: () => void;
  onToggleSave?: (id: string, saved: boolean) => void;
}

// "Popular Treks" card — backed by public trips today. Distance and rating
// have no column anywhere yet, so those two fields render a muted "—"
// instead of a fabricated number; everything else is real.
export default function AdventureCard({ item, onPress, onToggleSave }: Props) {
  const [saved, setSaved] = useState(!!item.saved);
  const diffColor = item.difficulty ? (DIFFICULTY_COLORS[item.difficulty.toLowerCase()] ?? AppColors.primary) : null;

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    onToggleSave?.(item.id, next);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="trail-sign-outline" size={30} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        <TouchableOpacity style={styles.saveBtn} onPress={toggleSave} hitSlop={8}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={17} color={saved ? AppColors.primary : '#FFF'} />
        </TouchableOpacity>
        {item.difficulty && (
          <View style={[styles.diffBadge, { backgroundColor: diffColor + 'E6' }]}>
            <Text style={styles.diffText}>{item.difficulty}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={AppColors.primary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="footsteps-outline" size={12} color={AppColors.subtext} />
            <Text style={styles.statText}>{item.distanceKm ? `${item.distanceKm} km` : '—'}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={12} color={AppColors.subtext} />
            <Text style={styles.statText}>{item.durationLabel || '—'}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.statText}>{item.rating ? item.rating.toFixed(1) : 'New'}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {item.startingPrice ? (
            <Text style={styles.price}>₹{item.startingPrice.toLocaleString('en-IN')}<Text style={styles.priceUnit}> onwards</Text></Text>
          ) : (
            <Text style={styles.priceUnit}>Price on request</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const CARD_WIDTH = 220;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: AppColors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 130 },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  saveBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  diffBadge: { position: 'absolute', bottom: 8, left: 8, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  diffText: { color: '#080C14', fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  body: { padding: Spacing.md, gap: 6 },
  title: { color: AppColors.text, fontSize: 14.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: AppColors.subtext, fontSize: 11.5, flex: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
  footer: { marginTop: 4, borderTopWidth: 1, borderTopColor: AppColors.border, paddingTop: 8 },
  price: { color: AppColors.primary, fontSize: 14, fontWeight: '800' },
  priceUnit: { color: AppColors.subtext, fontSize: 10.5, fontWeight: '600' },
});
