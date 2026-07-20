import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Dimensions, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePostActions } from '@/hooks/usePostActions';
import { AppColors, Spacing } from '@/constants/theme';
import Button from '@/components/ui/Button';
import BottomSheet from '@/components/ui/BottomSheet';
import ReelActions from './ReelActions';
import ReelInfo from './ReelInfo';
import ReelComments from './ReelComments';
import PostShareSheet from '@/components/PostShareSheet';
import { router } from 'expo-router';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const REPORT_REASONS = [
  'Nudity or sexual content',
  'Harassment or bullying',
  'Hate speech',
  'Spam or scam',
  'Promotional content',
  'Other',
];

export interface ReelPostData {
  id: string;
  user: { id?: string; name: string; avatar: string };
  videoUri: string;
  content: string;
  likes_count: number;
  comments_count: number;
  liked?: boolean;
  saved?: boolean;
  location?: string;
  activityType?: string | null;
}

interface Props {
  post: ReelPostData;
  isActive: boolean;
  onDeleted?: (postId: string) => void;
}

// One full-screen reel — the genuinely new piece of this feature (Section 9
// of the audit). Everything it does to a post (like/save/report/delete/
// edit caption) goes through usePostActions, the same hook PostCard uses;
// comments go through the same useComments-backed sheet as post/[id].tsx.
export default function ReelPlayerItem({ post, isActive, onDeleted }: Props) {
  const {
    liked, likesCount, saved, commentsCount, caption,
    likeScale, saveScale, isOwn,
    handleLike, handleSave, handleDelete, submitReport, handleEditSave,
  } = usePostActions(
    { id: post.id, user: post.user, content: post.content, likes_count: post.likes_count, comments_count: post.comments_count, liked: post.liked, saved: post.saved },
    onDeleted
  );

  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editCaption, setEditCaption] = useState('');

  const player = useVideoPlayer(post.videoUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (isActive && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, paused, player]);

  // Leaving the reel resets the manual-pause override, so scrolling back
  // to it later autoplays again instead of staying paused forever.
  useEffect(() => {
    if (!isActive) setPaused(false);
  }, [isActive]);

  const togglePause = () => setPaused((p) => !p);

  const handleOptions = () => {
    if (isOwn) {
      Alert.alert('Reel Options', undefined, [
        { text: 'Edit Caption', onPress: () => { setEditCaption(caption); setEditVisible(true); } },
        { text: 'Delete Reel', style: 'destructive', onPress: handleDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Reel Options', undefined, [
        { text: 'Report', onPress: () => setReportVisible(true) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const onEditSave = async () => {
    const ok = await handleEditSave(editCaption);
    if (ok) setEditVisible(false);
  };

  const onSubmitReport = async (reason: string) => {
    setReportVisible(false);
    await submitReport(reason);
  };

  return (
    <View style={styles.screen}>
      <TouchableOpacity activeOpacity={1} onPress={togglePause} style={StyleSheet.absoluteFill}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </TouchableOpacity>

      {paused && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
        </View>
      )}

      <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={styles.topGradient} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.bottomGradient} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <TouchableOpacity onPress={() => setMuted((m) => !m)} hitSlop={10}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOptions} hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom overlay */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <ReelInfo
          userId={post.user.id}
          userName={post.user.name}
          caption={caption}
          location={post.location}
          activityType={post.activityType}
        />
      </View>

      <View style={styles.actionsWrap} pointerEvents="box-none">
        <ReelActions
          userId={post.user.id}
          avatarUrl={post.user.avatar}
          liked={liked}
          likesCount={likesCount}
          likeScale={likeScale}
          onLike={handleLike}
          onLikesPress={() => router.push(`/post/likes/${post.id}` as any)}
          commentsCount={commentsCount}
          onCommentPress={() => setCommentsVisible(true)}
          onSharePress={() => setShareVisible(true)}
          saved={saved}
          saveScale={saveScale}
          onSave={handleSave}
        />
      </View>

      <ReelComments postId={post.id} visible={commentsVisible} onClose={() => setCommentsVisible(false)} />

      <BottomSheet visible={shareVisible} onClose={() => setShareVisible(false)}>
        <PostShareSheet postId={post.id} content={caption} onClose={() => setShareVisible(false)} />
      </BottomSheet>

      <BottomSheet visible={editVisible} onClose={() => setEditVisible(false)} avoidKeyboard>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Edit Caption</Text>
          <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={8}>
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

      <BottomSheet visible={reportVisible} onClose={() => setReportVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Report Reel</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000' },
  pauseOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },
  topBar: {
    position: 'absolute', top: 54, left: Spacing.lg, right: Spacing.lg,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  bottomBar: { position: 'absolute', left: Spacing.lg, right: 90, bottom: 34 },
  actionsWrap: { position: 'absolute', right: Spacing.md, bottom: 40 },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  editInput: {
    borderRadius: 12, borderWidth: 1, borderColor: AppColors.border,
    backgroundColor: AppColors.surface, color: AppColors.text,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 14,
    minHeight: 100, maxHeight: 200, textAlignVertical: 'top', marginBottom: Spacing.lg,
  },
  reportReasonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppColors.border,
  },
  reportReasonText: { fontSize: 14.5, color: AppColors.text },
});
