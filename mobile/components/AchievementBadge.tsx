import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: boolean;
  color: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_trek', emoji: '⛰️', title: 'First Summit', desc: 'Complete your first trek', earned: false, color: '#8CC63F' },
  { id: 'social_butterfly', emoji: '👥', title: 'Social Butterfly', desc: 'Join 3 group trips', earned: false, color: '#3B82F6' },
  { id: 'trail_blazer', emoji: '🔥', title: 'Trail Blazer', desc: 'Create 5 trips', earned: false, color: '#F97316' },
  { id: 'guide_friend', emoji: '🧭', title: 'Guide Friend', desc: 'Book a verified guide', earned: false, color: '#8B5CF6' },
  { id: 'photo_story', emoji: '📸', title: 'Story Teller', desc: 'Post 10 trek photos', earned: false, color: '#EC4899' },
  { id: 'himalayan', emoji: '🏔️', title: 'Himalayan', desc: 'Trek above 4000m', earned: false, color: '#06B6D4' },
  { id: 'night_trekker', emoji: '🌙', title: 'Night Trekker', desc: 'Start a trek before dawn', earned: false, color: '#7C3AED' },
  { id: 'solo_warrior', emoji: '🗡️', title: 'Solo Warrior', desc: 'Complete a solo trek', earned: false, color: '#EF4444' },
  { id: 'eco_warrior', emoji: '🌿', title: 'Eco Warrior', desc: 'Join a clean-up trek', earned: false, color: '#10B981' },
  { id: 'century', emoji: '💯', title: 'Century', desc: 'Trek 100km total', earned: false, color: '#FCD34D' },
];

interface Props {
  achievement: Achievement;
  size?: 'sm' | 'lg';
  onPress?: () => void;
}

export default function AchievementBadge({ achievement: a, size = 'lg', onPress }: Props) {
  const isLarge = size === 'lg';
  return (
    <TouchableOpacity
      style={[styles.badge, isLarge ? styles.large : styles.small, !a.earned && styles.locked]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <Text style={[styles.emoji, isLarge ? styles.emojiLg : styles.emojiSm, !a.earned && styles.dimmed]}>
        {a.earned ? a.emoji : '🔒'}
      </Text>
      {isLarge && (
        <>
          <Text style={[styles.title, !a.earned && styles.lockedText]} numberOfLines={1}>{a.title}</Text>
          <Text style={[styles.desc, !a.earned && styles.lockedText]} numberOfLines={2}>{a.desc}</Text>
        </>
      )}
      {a.earned && (
        <View style={[styles.earnedDot, { backgroundColor: a.color }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center', borderRadius: 16,
    borderWidth: 1, position: 'relative',
  },
  large: {
    width: 100, padding: 14, gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  small: {
    width: 52, height: 52, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  locked: { opacity: 0.45 },
  emoji: { textAlign: 'center' },
  emojiLg: { fontSize: 30 },
  emojiSm: { fontSize: 22 },
  dimmed: { opacity: 0.5 },
  title: { fontSize: 11, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  desc: { fontSize: 9, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 13 },
  lockedText: { color: 'rgba(255,255,255,0.3)' },
  earnedDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
});
