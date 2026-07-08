import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Share, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { haptic } from '@/lib/haptics';
import { translateText } from '@/lib/translate';

const { width } = Dimensions.get('window');
const ACCENT = '#EC4899';
const BG = '#080C14';

const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or bullying',
  'Hate speech',
  'Spam or scam',
  'Other',
];

type Story = {
  id: string;
  title: string | null;
  content: string;
  media: string[];
  location: string | null;
  tags: string[];
  created_at: string;
  likes_count: number;
  user_id: string;
  author: { full_name: string; avatar_url: string | null } | null;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function readTime(content: string) {
  const words = content?.trim().split(/\s+/).length || 0;
  return Math.max(1, Math.round(words / 200));
}

function renderContent(content: string, extraImages: string[]) {
  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  const elements: React.ReactNode[] = [];

  paragraphs.forEach((para, i) => {
    elements.push(
      <Text key={`p_${i}`} style={styles.paragraph}>{para.trim()}</Text>
    );
    if (extraImages[i]) {
      elements.push(
        <Image
          key={`img_${i}`}
          source={{ uri: extraImages[i] }}
          style={styles.inlineImage}
          contentFit="cover"
        />
      );
    }
  });

  return elements;
}

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('posts')
        .select(`
          id, title, content, media, location, tags, created_at, likes_count, user_id,
          author:users!user_id(full_name, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (data) {
        setStory(data as any);
        setLikeCount((data as any).likes_count || 0);
      }

      if (user?.id) {
        const { data: likeRow } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setLiked(!!likeRow);
      }

      setLoading(false);
    })();
  }, [id, user?.id]);

  const toggleLike = async () => {
    if (!user || liking) return;
    setLiking(true);
    haptic.light();
    if (liked) {
      setLiked(false);
      setLikeCount((c) => c - 1);
      await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from('post_likes').insert({ post_id: id, user_id: user.id });
    }
    setLiking(false);
  };

  const handleShare = async () => {
    if (!story) return;
    await Share.share({ message: `${story.title || 'A TrekRiderz Story'}\n\n${story.content.slice(0, 200)}…` });
  };

  const handleTranslate = async () => {
    if (translatedContent) {
      setTranslatedTitle(null);
      setTranslatedContent(null);
      return;
    }
    if (!story) return;
    setTranslating(true);
    const [title, content] = await Promise.all([
      story.title ? translateText(story.title) : Promise.resolve(null),
      translateText(story.content),
    ]);
    setTranslatedTitle(title);
    setTranslatedContent(content);
    setTranslating(false);
  };

  const submitReport = async (reason: string) => {
    setReportVisible(false);
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('post_reports').insert({
        post_id: id,
        reporter_id: user.id,
        reason,
      });
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already reported', "You've already reported this story. Our team will review it.");
          return;
        }
        throw error;
      }
      Alert.alert('Thanks for reporting', "We'll review this soon.");
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Story', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('posts').delete().eq('id', id);
            if (error) throw error;
            if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
          } catch {
            Alert.alert('Error', 'Could not delete story.');
          }
        },
      },
    ]);
  };

  const handleOptions = () => {
    const isOwn = story?.user_id === user?.id;
    if (isOwn) {
      Alert.alert('Story Options', undefined, [
        { text: 'Edit Story', onPress: () => router.push(`/stories/create?id=${id}` as any) },
        { text: 'Delete Story', style: 'destructive', onPress: handleDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Story Options', undefined, [
        { text: 'Report', onPress: () => setReportVisible(true) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Story not found.</Text>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backFallback}>
          <Text style={styles.backFallbackText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cover = story.media?.[0] ?? null;
  const extraImages = story.media?.slice(1) ?? [];
  const authorName = story.author?.full_name || 'Anonymous';
  const avatarUri = story.author?.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=EC4899&color=fff`;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[]} bounces>
        {/* Cover image */}
        <View style={styles.coverWrap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.noCover]}>
              <Ionicons name="book-outline" size={56} color={ACCENT} />
            </View>
          )}
          <View style={styles.coverOverlay} />
          <SafeAreaView edges={['top']} style={StyleSheet.absoluteFill}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.circleBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
                <Ionicons name="arrow-back" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.topBarRight}>
                <TouchableOpacity
                  style={[styles.circleBtn, translatedContent && styles.circleBtnActive]}
                  onPress={handleTranslate}
                  disabled={translating}
                >
                  {translating
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Ionicons name="language" size={20} color="#FFF" />
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.circleBtn} onPress={handleShare}>
                  <Ionicons name="share-outline" size={20} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.circleBtn} onPress={handleOptions}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {/* Location */}
          {story.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={13} color={ACCENT} />
              <Text style={styles.locationText}>{story.location}</Text>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{translatedTitle || story.title || 'Untitled Story'}</Text>
          {translatedContent && (
            <TouchableOpacity onPress={() => { setTranslatedTitle(null); setTranslatedContent(null); }}>
              <View style={styles.translatedBadge}>
                <Ionicons name="language" size={12} color={ACCENT} />
                <Text style={styles.translatedBadgeText}>Translated · Tap to show original</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Author row */}
          <View style={styles.authorRow}>
            <TouchableOpacity
              style={styles.authorTouch}
              onPress={() => router.push(`/user/${story.user_id}` as any)}
            >
              <Image source={{ uri: avatarUri }} style={styles.authorAvatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.authorName}>{authorName}</Text>
                <Text style={styles.authorMeta}>
                  {timeAgo(story.created_at)}  ·  {readTime(story.content)} min read
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.likeBtn, liked && styles.likeBtnActive]}
              onPress={toggleLike}
              disabled={liking}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#FFF' : ACCENT} />
              {likeCount > 0 && (
                <Text style={[styles.likeCount, liked && { color: '#FFF' }]}>{likeCount}</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Tags */}
          {story.tags?.length > 0 && (
            <View style={styles.tagsRow}>
              {story.tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Story content with interleaved photos */}
          <View style={styles.contentBlock}>
            {renderContent(translatedContent || story.content, extraImages)}
          </View>

          {/* Any remaining extra images */}
          {extraImages.length > story.content.split(/\n\n+/).length && (
            <View style={styles.galleryGrid}>
              {extraImages.slice(story.content.split(/\n\n+/).length).map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.galleryImg} contentFit="cover" />
              ))}
            </View>
          )}

          {/* Bottom like bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bigLikeBtn, liked && styles.bigLikeBtnActive]}
              onPress={toggleLike}
              disabled={liking}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#FFF' : ACCENT} />
              <Text style={[styles.bigLikeTxt, liked && { color: '#FFF' }]}>
                {liked ? 'Liked' : 'Like this story'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {reportVisible && (
        <View style={styles.reportSheet}>
          <Text style={styles.reportTitle}>Report Story</Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity key={reason} style={styles.reportRow} onPress={() => submitReport(reason)}>
              <Text style={styles.reportRowText}>{reason}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.reportCancel} onPress={() => setReportVisible(false)}>
            <Text style={styles.reportCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 16, color: 'rgba(255,255,255,0.5)' },
  backFallback: { padding: 12, backgroundColor: ACCENT, borderRadius: 12 },
  backFallbackText: { color: '#FFF', fontWeight: '700' },

  coverWrap: { position: 'relative', height: 340 },
  cover: { width: '100%', height: '100%' },
  noCover: { backgroundColor: ACCENT + '18', alignItems: 'center', justifyContent: 'center' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,12,20,0.35)',
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12,
  },
  topBarRight: { flexDirection: 'row', gap: 8 },
  circleBtnActive: { backgroundColor: ACCENT + 'CC' },
  translatedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: ACCENT + '15', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  translatedBadgeText: { fontSize: 11, color: ACCENT, fontStyle: 'italic', fontWeight: '600' },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(8,12,20,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  body: { padding: 20 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  locationText: { fontSize: 13, color: ACCENT, fontWeight: '700' },

  title: { fontSize: 26, fontWeight: '900', color: '#FFF', lineHeight: 34, marginBottom: 16 },

  authorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  authorTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorAvatar: { width: 42, height: 42, borderRadius: 21 },
  authorName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  authorMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  likeBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  likeCount: { fontSize: 13, fontWeight: '700', color: ACCENT },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },

  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
  tag: { backgroundColor: ACCENT + '18', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 11, fontWeight: '700', color: ACCENT },

  contentBlock: { gap: 16 },
  paragraph: { fontSize: 16, color: 'rgba(255,255,255,0.82)', lineHeight: 26 },
  inlineImage: {
    width: '100%', height: 220, borderRadius: 14,
    marginVertical: 4,
  },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  galleryImg: {
    width: (width - 52) / 2, height: 140, borderRadius: 12,
  },

  bottomBar: {
    flexDirection: 'row', gap: 12, marginTop: 28, alignItems: 'center',
  },
  bigLikeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14,
    paddingVertical: 14,
  },
  bigLikeBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  bigLikeTxt: { fontSize: 15, fontWeight: '800', color: ACCENT },
  shareBtn: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  reportSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  reportTitle: { color: '#FFF', fontWeight: '800', fontSize: 16, marginBottom: 12 },
  reportRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  reportRowText: { color: '#FFF', fontSize: 14.5 },
  reportCancel: { paddingVertical: 14, alignItems: 'center' },
  reportCancelText: { color: ACCENT, fontWeight: '700', fontSize: 14.5 },
});
