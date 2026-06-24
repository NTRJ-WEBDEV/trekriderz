import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  isPremium?: boolean;
  size?: 'sm' | 'md';
}

export default function VerifiedBadge({ isPremium = false, size = 'md' }: Props) {
  const isSmall = size === 'sm';
  return (
    <View style={[styles.badge, isPremium ? styles.premium : styles.verified, isSmall && styles.small]}>
      <Ionicons
        name={isPremium ? 'star' : 'checkmark-circle'}
        size={isSmall ? 10 : 12}
        color={isPremium ? '#FCD34D' : '#8CC63F'}
      />
      <Text style={[styles.text, isSmall && styles.textSm, { color: isPremium ? '#FCD34D' : '#8CC63F' }]}>
        {isPremium ? 'PRO' : 'Verified'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  verified: {
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderColor: 'rgba(140,198,63,0.3)',
  },
  premium: {
    backgroundColor: 'rgba(252,211,77,0.12)',
    borderColor: 'rgba(252,211,77,0.3)',
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 11, fontWeight: '700' },
  textSm: { fontSize: 9 },
});
