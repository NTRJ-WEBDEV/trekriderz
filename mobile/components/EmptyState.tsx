import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={48} color="rgba(255,255,255,0.12)" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 19 },
  btn: {
    marginTop: 16,
    backgroundColor: '#8CC63F',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  btnText: { color: '#080C14', fontWeight: '800', fontSize: 14 },
});
