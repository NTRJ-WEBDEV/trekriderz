import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';
import Button from './ui/Button';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  // Most call sites are a FlatList's ListEmptyComponent inside a screen that
  // already centers content itself — flex:1 there fights the parent's own
  // layout. Only opt into it for a genuinely standalone full-screen state.
  fillScreen?: boolean;
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction, fillScreen }: Props) {
  return (
    <View style={[styles.container, fillScreen && styles.fillScreen]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={44} color={AppColors.subtext} style={{ opacity: 0.5 }} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: Spacing.md }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  fillScreen: { flex: 1 },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: AppColors.card,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: { fontSize: 17, fontWeight: '800', color: AppColors.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: AppColors.subtext, textAlign: 'center', lineHeight: 19 },
});
