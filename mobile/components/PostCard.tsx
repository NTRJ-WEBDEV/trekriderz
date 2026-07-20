import React, { useState } from 'react';
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
  Animated,
  Alert,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
// NOTE: the in-card comments modal (likes/replies/reactions) was moved to
// the full-screen /post/[id] detail view — see mobile/hooks/useComments.ts.
// The comment icon and "View all N comments" below now navigate there
// instead of opening a local modal, consolidating to one comment UI.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePostActions } from '@/hooks/usePostActions';
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
  // 'reel' branches media rendering to a paused/muted video preview that
  // opens the full-screen /reels viewer on tap, instead of the image
  // carousel — same Post shape, same card, no parallel component.
  post_type?: string;
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
  const {
    liked, likesCount, saved, commentsCount, caption,
    likeScale, saveScale, isOwn,
    handleLike, handleSave, handleDelete, submitReport, handleEditSave,
  } = usePostActions(post, onDelete);

  const [currentImage, setCurrentImage] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [reportVisible, setReportVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const isReel = post.post_type === 'reel';
  const videoUri = isReel ? post.images[0] : undefined;
  const videoPlayer = useVideoPlayer(videoUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    // Paused preview in-feed — the full-screen /reels viewer is where
    // playback actually happens, so the feed never runs multiple decoders
    // at once (see the Reels architecture audit, Section 7).
  });

  const handleOptions = () => {
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

  const onEditSave = async () => {
    const ok = await handleEditSave(editCaption);
    if (ok) setEditModalVisible(false);
  };

  const onSubmitReport = async (reason: string) => {
    setReportVisible(false);
    await submitReport(reason);
  };

  const onScrollImage = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setCurrentImage(index);
  };

  // Reels open the dedicated full-screen viewer instead of the post-detail
  // comment thread — everything else about the card (like/save/report/
  // delete) is identical between the two.
  const goToDetail = () => {
    if (disableDetailNav) return;
    router.push((isReel ? `/reels?postId=${post.id}` : `/post/${post.id}`) as any);
  };
  const goToComments = () => {
    if (isReel) { router.push(`/reels?postId=${post.id}` as any); return; }
    onCommentPress ? onCommentPress(post.id) : router.push(`/post/${post.id}` as any);
  };

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

      {/* Reel preview — paused/muted first frame, tap opens the full-screen
          autoplay viewer. Never plays inline in a scrolling feed (Section 7
          of the audit: no viewport-based mount/unmount exists yet, so N
          simultaneous decoders in a FlatList is a real risk). */}
      {isReel && videoUri ? (
        <TouchableOpacity activeOpacity={1} onPress={goToDetail} style={styles.mediaWrap}>
          <VideoView player={videoPlayer} style={styles.postImage} contentFit="cover" nativeControls={false} />
          <View style={styles.reelBadge}>
            <Ionicons name="play" size={13} color="#FFF" />
            <Text style={styles.reelBadgeText}>Reel</Text>
          </View>
        </TouchableOpacity>
      ) : post.images.length > 0 ? (
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
      ) : null}

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
        <Button label="Save" onPress={onEditSave} disabled={!editCaption.trim()} fullWidth />
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
          <TouchableOpacity key={reason} style={styles.reportReasonRow} onPress={() => onSubmitReport(reason)}>
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
  reelBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reelBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
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
