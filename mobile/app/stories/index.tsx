import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';

const { width } = Dimensions.get('window');
const ACCENT = '#EC4899';
const BG = '#080C14';

type Story = {
  id: string;
  title: string | null;
  content: string;
  media: string[];
  location: string | null;
  tags: string[];
  created_at: string;
  user_id: string;
  author: { full_name: string; avatar_url: string | null } | null;
};

function readTime(content: string) {
  const words = content?.trim().split(/\s+/).length || 0;
  return Math.max(1, Math.round(words / 200));
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StoryCard({ item, index }: { item: Story; index: number }) {
  const cover = item.media?.[0] ?? null;
  const title = item.title || item.content.slice(0, 60);
  const mins = readTime(item.content);
  const authorName = item.author?.full_name || 'Anonymous';
  const avatarUri = item.author?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=EC4899&color=fff`;

  const isFeatured = index === 0;

  return (
    <TouchableOpacity
      style={[styles.card, isFeatured && styles.featuredCard]}
      onPress={() => { haptic.light(); router.push(`/stories/${item.id}` as any); }}
      activeOpacity={0.88}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={[styles.cardImg, isFeatured && styles.featuredImg]} contentFit="cover" />
      ) : (
        <View style={[styles.cardImg, styles.noImg, isFeatured && styles.featuredImg]}>
          <Ionicons name="book-outline" size={32} color={ACCENT} />
        </View>
      )}

      <View style={styles.cardBody}>
        {isFeatured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={9} color={ACCENT} />
            <Text style={styles.featuredBadgeText}>FEATURED</Text>
          </View>
        )}

        {item.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={ACCENT} />
            <Text style={styles.locationText} numberOfLines={1}>{item.location}</Text>
          </View>
        )}

        <Text style={[styles.cardTitle, isFeatured && styles.featuredTitle]} numberOfLines={2}>
          {title}
        </Text>

        {isFeatured && (
          <Text style={styles.excerpt} numberOfLines={2}>
            {item.content.replace(/\n+/g, ' ').slice(0, 120)}
          </Text>
        )}

        <View style={styles.cardMeta}>
          <Image source={{ uri: avatarUri }} style={styles.authorAvatar} contentFit="cover" />
          <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.35)" />
          <Text style={styles.metaText}>{mins} min read</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{timeAgo(item.created_at)}</Text>
        </View>

        {item.tags?.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 3).map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function StoriesScreen() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, content, media, location, tags, created_at, user_id,
        author:users!user_id(full_name, avatar_url)
      `)
      .eq('post_type', 'trip_story')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setStories(data as any);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Stories</Text>
            <Text style={styles.headerSub}>Trek & travel journeys</Text>
          </View>
          <TouchableOpacity
            style={styles.writeBtn}
            onPress={() => { haptic.medium(); router.push('/stories/create' as any); }}
          >
            <Ionicons name="pencil" size={15} color="#FFF" />
            <Text style={styles.writeBtnText}>Write</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        data={stories}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <StoryCard item={item} index={index} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={ACCENT}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyTitle}>No Stories Yet</Text>
            <Text style={styles.emptySub}>
              Be the first to share your trekking journey or travel experience.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => { haptic.medium(); router.push('/stories/create' as any); }}
            >
              <Text style={styles.emptyBtnText}>Write Your Story</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safeTop: { backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 19, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  writeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  writeBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  list: { padding: 16, gap: 16, paddingBottom: 40 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  featuredCard: {
    borderColor: ACCENT + '33',
    backgroundColor: 'rgba(236,72,153,0.05)',
  },

  cardImg: { width: '100%', height: 160 },
  featuredImg: { height: 220 },
  noImg: {
    backgroundColor: ACCENT + '15',
    alignItems: 'center', justifyContent: 'center',
  },

  cardBody: { padding: 14, gap: 8 },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ACCENT + '20', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  featuredBadgeText: { fontSize: 9, fontWeight: '900', color: ACCENT, letterSpacing: 1 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 11, color: ACCENT, fontWeight: '600', flex: 1 },

  cardTitle: { fontSize: 15, fontWeight: '800', color: '#FFF', lineHeight: 22 },
  featuredTitle: { fontSize: 18, lineHeight: 26 },
  excerpt: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19 },

  cardMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    flexWrap: 'nowrap',
  },
  authorAvatar: { width: 20, height: 20, borderRadius: 10 },
  authorName: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600',
    flex: 1, maxWidth: 100,
  },
  metaDot: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },

  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  tag: {
    backgroundColor: 'rgba(236,72,153,0.12)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 10, fontWeight: '600', color: ACCENT },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  emptySub: {
    fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 32,
  },
  emptyBtn: {
    marginTop: 8, backgroundColor: ACCENT,
    borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
