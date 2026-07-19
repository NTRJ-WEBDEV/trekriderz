import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
// NOTE: the in-card comments modal (likes/replies/reactions) was moved to
// the full-screen /post/[id] detail view — see mobile/hooks/useComments.ts.
// The comment icon and "View all N comments" below now navigate there
// instead of opening a local modal, consolidating to one comment UI.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePostRealtime } from '@/hooks/usePostRealtime';
import { AppColors, Radius, Spacing } from '@/constants/theme';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BottomSheet from '@/components/ui/BottomSheet';
import YouTubePlayer from './YouTubePlayer';
import PostShareSheet from './PostShareSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = Spacing.md;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

interface TripMeta {
  status: string;
  trip_type: string;
  destination: string;
  title?: string;
}

interface Post {
  id: string;
  user: { name: string; avatar: string; id?: string };
  images: string[];
  content: string;
  likes_count: number;
  comments_count: number;
  timestamp: string;
  liked?: boolean;
  saved?: boolean;
  location?: string;
  trip_id?: string;
  trip?: TripMeta;
  youtube_url?: string;
}

const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or bullying',
  'Hate speech',
  'Spam or scam',
  'Promotional content',
  'Other',
];

interface PostCardProps {
  post: Post;
  onCommentPress?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  // True when PostCard is already being rendered as the header of /post/[id]
  // itself — image/caption taps would otherwise push a redundant duplicate
  // of the current screen onto the nav stack.
  disableDetailNav?: boolean;
}

const TRIP_EMOJI: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒', weekend: '🌄',
};

function TripBanner({ trip }: { trip: TripMeta }) {
  const isCompleted = trip.status === 'completed';
  const emoji = TRIP_EMOJI[trip.trip_type] || '🗺️';
  const label = isCompleted
    ? `${emoji} ${trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1)} Completed`
    : `${emoji} ${trip.title || trip.destination}`;

  return (
    <View style={[
      tripBannerStyles.banner,
      { backgroundColor: isCompleted ? 'rgba(140,198,63,0.12)' : 'rgba(140,198,63,0.06)' },
    ]}>
      <View style={{ flex: 1 }}>
        <Text style={[tripBannerStyles.label, { color: AppColors.primary }]}>{label}</Text>
        <Text style={tripBannerStyles.dest} numberOfLines={1}>📍 {trip.destination}</Text>
      </View>
      {isCompleted && <Ionicons name="checkmark-circle" size={20} color={AppColors.primary} />}
    </View>
  );
}

const tripBannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  dest: { fontSize: 11, color: AppColors.subtext },
});

// Splits a caption on #hashtags and colors them, leaving everything else as
// plain caption text — purely a render-time split, doesn't touch post.content.
function renderCaptionWithHashtags(text: string) {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith('#') ? (
      <Text key={i} style={{ color: AppColors.primary, fontWeight: '700' }}>{part}</Text>
    ) : (
      part
    )
  );
}

export default function PostCard({ post, onCommentPress, onDelete, disableDetailNav }: PostCardProps) {
  const { user } = useAuthStore();
  const { likesCount, setLikesCount, commentsCount } = usePostRealtime(post.id, post.likes_count, post.comments_count);

  const [liked, setLiked] = useState(post.liked ?? false);
  const [saved, setSaved] = useState(post.saved ?? false);
  const [currentImage, setCurrentImage] = useState(0);
  const [caption, setCaption] = useState(post.content);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  const pop = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.25, duration: 100, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const handleSave = async () => {
    pop(saveScale);
    const newSaved = !saved;
    setSaved(newSaved);
    try {
      if (newSaved) {
        const { error } = await supabase.from('post_saves').insert({ post_id: post.id, user_id: user?.id });
        if (error) throw error;
      } else {
        await supabase.from('post_saves').delete().eq('post_id', post.id).eq('user_id', user?.id);
      }
    } catch {
      setSaved(!newSaved);
    }
  };

  const submitReport = async (reason: string) => {
    setReportVisible(false);
    try {
      const { error } = await supabase.from('post_reports').insert({
        post_id: post.id,
        reporter_id: user?.id,
        reason,
      });
      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already reported', "You've already reported this post. Our team will review it.");
          return;
        }
        throw error;
      }
      Alert.alert('Thanks for reporting', "We'll review this soon.");
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleLike = async () => {
    pop(likeScale);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    try {
      if (newLiked) {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user?.id });
      } else {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user?.id);
      }
    } catch (e) {
      // Revert on error
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    }
  };

  const handleOptions = () => {
    const isOwn = post.user.id === user?.id;
    if (isOwn) {
      Alert.alert('Post Options', undefined, [
        { text: 'Edit Caption', onPress: () => { setEditCaption(caption); setEditModalVisible(true); } },
        { text: 'Delete Post', style: 'destructive', onPress: handleDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Post Options', undefined, [
        { text: 'Report', onPress: () => setReportVisible(true) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleEditSave = async () => {
    try {
      const { error } = await supabase.from('posts').update({ content: editCaption }).eq('id', post.id);
      if (error) throw error;
      setCaption(editCaption);
      setEditModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not update caption.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Post', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('posts').delete().eq('id', post.id);
            if (error) throw error;
            onDelete?.(post.id);
          } catch {
            Alert.alert('Error', 'Could not delete post.');
          }
        },
      },
    ]);
  };

  const onScrollImage = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setCurrentImage(index);
  };

  const goToDetail = () => { if (!disableDetailNav) router.push(`/post/${post.id}` as any); };
  const goToComments = () => { onCommentPress ? onCommentPress(post.id) : router.push(`/post/${post.id}` as any); };

  return (
    <Card padded={false} elevated style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerUserRow}
          onPress={() => router.push(`/user/${post.user.id}` as any)}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: post.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.name}` }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{post.user.name}</Text>
            {post.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={10} color={AppColors.subtext} />
                <Text style={styles.location}>{post.location}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOptions} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={AppColors.subtext} />
        </TouchableOpacity>
      </View>

      {/* Trip Banner */}
      {post.trip && <TripBanner trip={post.trip} />}

      {/* Image Carousel */}
      {post.images.length > 0 && (
        <View style={styles.mediaWrap}>
          <FlatList
            data={post.images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScrollImage}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={1} onPress={goToDetail}>
                <Image source={{ uri: item }} style={styles.postImage} />
              </TouchableOpacity>
            )}
          />
          {/* Multi-image counter, e.g. "2/5" — replaces dot indicators with a
              more information-dense overlay */}
          {post.images.length > 1 && (
            <View style={styles.counterPill}>
              <Text style={styles.counterText}>{currentImage + 1}/{post.images.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* YouTube inline player */}
      {post.youtube_url && (
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}>
          <YouTubePlayer url={post.youtube_url} height={210} />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <View style={styles.actionGroup}>
            <TouchableOpacity onPress={handleLike} hitSlop={6}>
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={26}
                  color={liked ? '#ED4956' : AppColors.text}
                />
              </Animated.View>
            </TouchableOpacity>
            {likesCount > 0 && (
              <TouchableOpacity onPress={() => router.push(`/post/likes/${post.id}` as any)} hitSlop={6}>
                <Text style={styles.actionCount}>{likesCount}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={goToComments} style={styles.actionGroup} hitSlop={6}>
            <Ionicons name="chatbubble-outline" size={23} color={AppColors.text} />
            {commentsCount > 0 && <Text style={styles.actionCount}>{commentsCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShareVisible(true)} style={styles.actionGroup} hitSlop={6}>
            <Ionicons name="paper-plane-outline" size={23} color={AppColors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave} hitSlop={6}>
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color={saved ? AppColors.primary : AppColors.text} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.metaSection}>
        {/* Caption */}
        {caption ? (
          <Text style={styles.caption} onPress={goToDetail}>
            <Text style={styles.captionUser} onPress={() => router.push(`/user/${post.user.id}` as any)}>{post.user.name} </Text>
            {renderCaptionWithHashtags(caption)}
          </Text>
        ) : null}

        {/* Comments count */}
        {commentsCount > 0 && (
          <TouchableOpacity onPress={goToComments}>
            <Text style={styles.viewComments}>View all {commentsCount} comments</Text>
          </TouchableOpacity>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>{post.timestamp}</Text>
      </View>

      {/* Edit Caption */}
      <BottomSheet visible={editModalVisible} onClose={() => setEditModalVisible(false)} avoidKeyboard>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Edit Caption</Text>
          <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={8}>
            <Ionicons name="close" size={22} color={AppColors.text} />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.editInput}
          value={editCaption}
          onChangeText={setEditCaption}
          multiline
          autoFocus
          placeholder="Write a caption..."
          placeholderTextColor={AppColors.subtext}
        />
        <Button label="Save" onPress={handleEditSave} disabled={!editCaption.trim()} fullWidth />
      </BottomSheet>

      {/* Report Reasons */}
      <BottomSheet visible={reportVisible} onClose={() => setReportVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Report Post</Text>
          <TouchableOpacity onPress={() => setReportVisible(false)} hitSlop={8}>
            <Ionicons name="close" size={22} color={AppColors.text} />
          </TouchableOpacity>
        </View>
        {REPORT_REASONS.map((reason) => (
          <TouchableOpacity key={reason} style={styles.reportReasonRow} onPress={() => submitReport(reason)}>
            <Text style={styles.reportReasonText}>{reason}</Text>
            <Ionicons name="chevron-forward" size={18} color={AppColors.subtext} />
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* Share Sheet */}
      <BottomSheet visible={shareVisible} onClose={() => setShareVisible(false)}>
        <PostShareSheet postId={post.id} content={caption} onClose={() => setShareVisible(false)} />
      </BottomSheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: CARD_MARGIN,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerUserRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(140,198,63,0.35)',
  },
  userInfo: { flex: 1 },
  userName: { fontWeight: '700', fontSize: 14.5, color: AppColors.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  location: { fontSize: 11.5, color: AppColors.subtext },
  mediaWrap: { position: 'relative' },
  postImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.15,
    resizeMode: 'cover',
  },
  counterPill: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  leftActions: { flexDirection: 'row', gap: Spacing.lg },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 2 },
  actionCount: { fontSize: 13.5, fontWeight: '700', color: AppColors.text },
  metaSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 5,
  },
  caption: { fontSize: 14, lineHeight: 20, color: AppColors.text },
  captionUser: { fontWeight: '700' },
  viewComments: { fontSize: 13, marginTop: 1, color: AppColors.subtext },
  timestamp: {
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 3,
    color: AppColors.subtext,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  editInput: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    color: AppColors.text,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 14,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  reportReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppColors.border,
  },
  reportReasonText: { fontSize: 14.5, color: AppColors.text },
});
