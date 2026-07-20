import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AppColors, Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 2;
const TILE_SIZE = (SCREEN_WIDTH - GAP * 2) / 3;

interface GridItem {
  id: string;
  cover: string | null;
}

interface Props {
  userId: string;
  variant: 'posts' | 'stories' | 'reels';
}

const EMPTY_ICON: Record<Props['variant'], keyof typeof Ionicons.glyphMap> = {
  posts: 'images-outline',
  stories: 'book-outline',
  reels: 'film-outline',
};
const EMPTY_TEXT: Record<Props['variant'], string> = {
  posts: 'No posts yet',
  stories: 'No travel stories yet',
  reels: 'No reels yet',
};

// Instagram-style 3-column thumbnail grid — same shape for the Posts,
// Travel Stories, and Reels profile tabs, just pointed at a different
// query/route. Reels open the full-screen viewer scoped to this profile
// (same data source, different query param) rather than a separate screen.
export default function PostsGrid({ userId, variant }: Props) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const query = supabase
        .from('posts')
        .select('id, media')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data } = variant === 'stories'
        ? await query.eq('post_type', 'trip_story')
        : variant === 'reels'
        ? await query.eq('post_type', 'reel')
        : await query.or('post_type.is.null,and(post_type.neq.trip_story,post_type.neq.reel)');

      if (cancelled) return;
      setItems((data || []).map((p: any) => ({
        id: p.id,
        cover: Array.isArray(p.media) && p.media.length > 0 ? p.media[0] : null,
      })));
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [userId, variant]);

  if (!loading && items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name={EMPTY_ICON[variant]} size={36} color={AppColors.subtext} />
        <Text style={styles.emptyText}>{EMPTY_TEXT[variant]}</Text>
      </View>
    );
  }

  const routeFor = (id: string) => {
    if (variant === 'stories') return `/stories/${id}`;
    if (variant === 'reels') return `/reels?postId=${id}&userId=${userId}`;
    return `/post/${id}`;
  };

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.tile}
          activeOpacity={0.85}
          onPress={() => router.push(routeFor(item.id) as any)}
        >
          {item.cover ? (
            variant === 'reels' ? (
              <View style={styles.thumb}>
                <Image source={{ uri: item.cover }} style={styles.thumb} contentFit="cover" />
                <Ionicons name="play" size={16} color="#FFF" style={styles.reelPlayIcon} />
              </View>
            ) : (
              <Image source={{ uri: item.cover }} style={styles.thumb} contentFit="cover" />
            )
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name={EMPTY_ICON[variant]} size={22} color="rgba(255,255,255,0.25)" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: TILE_SIZE, height: TILE_SIZE },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { backgroundColor: AppColors.card, alignItems: 'center', justifyContent: 'center' },
  reelPlayIcon: { position: 'absolute', top: 6, right: 6 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl * 1.5, gap: Spacing.sm },
  emptyText: { color: AppColors.subtext, fontSize: 13.5, fontWeight: '600' },
});
