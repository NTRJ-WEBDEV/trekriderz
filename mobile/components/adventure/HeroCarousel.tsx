import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  colors: [string, string];
  ctaLabel: string;
  onPress: () => void;
}

interface Props {
  slides: HeroSlide[];
}

// Promotional banner carousel — content here is editorial/navigational
// (seasonal pushes, founder offers), not a data-backed listing, so it's a
// static slide array today rather than a CMS-fetched one.
export default function HeroCarousel({ slides }: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<HeroSlide>>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    if (i !== index) setIndex(i);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg }}
        snapToInterval={SLIDE_WIDTH + Spacing.sm}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.slide} onPress={item.onPress} activeOpacity={0.9}>
            <LinearGradient colors={item.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={styles.textWrap}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{item.ctaLabel}</Text>
                <Ionicons name="arrow-forward" size={14} color="#080C14" />
              </View>
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ width: Spacing.sm }} />}
      />
      <View style={styles.dots}>
        {slides.map((s, i) => (
          <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    width: SLIDE_WIDTH,
    height: 170,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: Spacing.lg,
    justifyContent: 'flex-end',
  },
  emoji: { position: 'absolute', top: Spacing.lg, right: Spacing.lg, fontSize: 40, opacity: 0.9 },
  textWrap: { gap: 4 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '600' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: '#FFF',
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8,
  },
  ctaText: { color: '#080C14', fontSize: 12, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AppColors.border },
  dotActive: { backgroundColor: AppColors.primary, width: 18 },
});
