'use client';
import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonLoader width="60%" height={14} />
          <SkeletonLoader width="40%" height={11} />
        </View>
      </View>
      <SkeletonLoader height={12} style={{ marginTop: 12 }} />
      <SkeletonLoader width="80%" height={12} style={{ marginTop: 6 }} />
      <SkeletonLoader height={180} borderRadius={14} style={{ marginTop: 12 }} />
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={styles.listItem}>
      <SkeletonLoader width={42} height={42} borderRadius={12} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonLoader width="55%" height={14} />
        <SkeletonLoader width="75%" height={11} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: 'rgba(255,255,255,0.12)' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
});
