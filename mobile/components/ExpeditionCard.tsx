import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GuidedExpedition } from '@/lib/expeditions';

const { width } = Dimensions.get('window');

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22C55E',
  moderate: '#F59E0B',
  challenging: '#EF4444',
  expert: '#7C3AED',
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80';

interface ExpeditionCardProps {
  expedition: GuidedExpedition;
  onPress: () => void;
}

export default function ExpeditionCard({ expedition, onPress }: ExpeditionCardProps) {
  const coverPhoto =
    Array.isArray(expedition.cover_photos) && expedition.cover_photos.length > 0
      ? expedition.cover_photos[0]
      : FALLBACK_IMAGE;

  const seatsLeft = (expedition.max_seats ?? 0) - (expedition.booked_seats ?? 0);
  const isFull = expedition.status === 'full' || seatsLeft <= 0;

  const startDate = new Date(expedition.start_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  const endDate = new Date(expedition.end_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const difficultyColor = DIFFICULTY_COLORS[expedition.difficulty] ?? '#8CC63F';
  const guideInitial = expedition.guide?.name?.[0]?.toUpperCase() ?? 'G';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Cover Photo */}
      <Image
        source={{ uri: coverPhoto }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={300}
      />

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(10,14,39,0.15)', 'transparent', 'rgba(10,14,39,0.98)']}
        style={StyleSheet.absoluteFillObject}
        locations={[0, 0.35, 1]}
      />

      {/* Top Row — Difficulty + Premium Crown */}
      <View style={styles.topRow}>
        <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '22', borderColor: difficultyColor + '55' }]}>
          <View style={[styles.difficultyDot, { backgroundColor: difficultyColor }]} />
          <Text style={[styles.difficultyText, { color: difficultyColor }]}>
            {expedition.difficulty.charAt(0).toUpperCase() + expedition.difficulty.slice(1)}
          </Text>
        </View>
        {expedition.guide?.is_premium && (
          <View style={styles.premiumBadge}>
            <Ionicons name="ribbon" size={12} color="#F59E0B" />
            <Text style={styles.premiumText}>Premium</Text>
          </View>
        )}
      </View>

      {/* Guide Avatar — top right */}
      <View style={styles.guideAvatarContainer}>
        {expedition.guide?.photo_url ? (
          <Image
            source={{ uri: expedition.guide.photo_url }}
            style={styles.guideAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.guideAvatar, styles.guideAvatarFallback]}>
            <Text style={styles.guideInitial}>{guideInitial}</Text>
          </View>
        )}
      </View>

      {/* Bottom Content */}
      <View style={styles.bottomContent}>
        <Text style={styles.title} numberOfLines={2}>
          {expedition.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={13} color="#8CC63F" />
            <Text style={styles.metaText} numberOfLines={1}>
              {expedition.destination}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color="#9CA3AF" />
            <Text style={styles.metaText}>
              {startDate} – {endDate}
            </Text>
          </View>
        </View>

        {/* Seat Bar + Price */}
        <View style={styles.bottomRow}>
          {isFull ? (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>Fully Booked</Text>
            </View>
          ) : (
            <View style={styles.seatsInfo}>
              <Text style={styles.seatsText}>
                <Text style={styles.seatsNumber}>{seatsLeft}</Text> seats left
              </Text>
              {/* Seat availability bar */}
              <View style={styles.seatBar}>
                <View
                  style={[
                    styles.seatBarFill,
                    {
                      width: `${Math.min(100, ((expedition.booked_seats ?? 0) / (expedition.max_seats ?? 1)) * 100)}%`,
                      backgroundColor: seatsLeft <= 3 ? '#EF4444' : '#8CC63F',
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>From</Text>
            <Text style={styles.price}>
              ₹{expedition.min_price?.toLocaleString('en-IN') ?? '—'}
            </Text>
          </View>
        </View>

        {/* Guide name */}
        {expedition.guide?.name && (
          <View style={styles.guideRow}>
            <Ionicons name="person-outline" size={12} color="#9CA3AF" />
            <Text style={styles.guideName}>Led by {expedition.guide.name}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: width - 32,
    height: 340,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    alignSelf: 'center',
    backgroundColor: '#0D1120',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  guideAvatarContainer: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  guideAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  guideAvatarFallback: {
    backgroundColor: '#8CC63F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  seatsInfo: {
    gap: 5,
    flex: 1,
    marginRight: 16,
  },
  seatsText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  seatsNumber: {
    color: '#FFF',
    fontWeight: '700',
  },
  seatBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seatBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  fullBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  fullBadgeText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  price: {
    color: '#8CC63F',
    fontSize: 22,
    fontWeight: '800',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  guideName: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});
