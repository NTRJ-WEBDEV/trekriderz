import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  FlatList, Image, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import PostCard from '@/components/PostCard';
import { useComments, REACTION_EMOJI } from '@/hooks/useComments';
import { formatPostTime } from '@/lib/format';
import { AppColors, Radius, Spacing } from '@/constants/theme';
import BottomSheet from '@/components/ui/BottomSheet';
import ScreenHeader from '@/components/ui/ScreenHeader';

function CommentRow({
  item, liked, reactions, myUserId, onToggleLike, onReply, onLongPress, onTapReaction,
}: {
  item: any;
  liked: boolean;
  reactions: { userId: string; emoji: string }[];
  myUserId?: string;
  onToggleLike: () => void;
  onReply: () => void;
  onLongPress: () => void;
  onTapReaction: (emoji: string) => void;
}) {
  const isReply = !!item.parent_comment_id;
  const reactionGroups = Object.values(
    reactions.reduce((acc: Record<string, { emoji: string; count: number; mine: boolean }>, r) => {
      const g = acc[r.emoji] || { emoji: r.emoji, count: 0, mine: false };
      g.count += 1;
      if (r.userId === myUserId) g.mine = true;
      acc[r.emoji] = g;
      return acc;
    }, {})
  );

  return (
    <View style={[styles.commentRow, isReply && styles.commentRowReply]}>
      {/* Connector line grouping a reply visually under its parent comment */}
      {isReply && <View style={styles.replyConnector} />}
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={onLongPress}
        style={styles.commentRowInner}
      >
        <TouchableOpacity onPress={() => router.push(`/user/${item.user_id}` as any)}>
          <Image
            source={{ uri: item.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}` }}
            style={[styles.commentAvatar, isReply && styles.commentAvatarReply]}
          />
        </TouchableOpacity>
        <View style={styles.commentBubble}>
          <TouchableOpacity onPress={() => router.push(`/user/${item.user_id}` as any)}>
            <Text style={styles.commentUser}>{item.users?.full_name ?? 'User'}</Text>
          </TouchableOpacity>
          <Text style={styles.commentText}>{item.content}</Text>

          <View style={styles.commentActionsRow}>
            <TouchableOpacity style={styles.commentActionBtn} onPress={onToggleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? '#ED4956' : AppColors.subtext} />
              {item.likes_count > 0 && (
                <Text style={[styles.commentActionText, liked && { color: '#ED4956' }]}>{item.likes_count}</Text>
              )}
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity onPress={onReply}>
                <Text style={styles.commentActionText}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>

          {reactionGroups.length > 0 && (
            <View style={styles.reactionRow}>
              {reactionGroups.map((g) => (
                <TouchableOpacity
                  key={g.emoji}
                  style={[styles.reactionChip, g.mine && styles.reactionChipMine]}
                  onPress={() => onTapReaction(g.emoji)}
                >
                  <Text style={styles.reactionChipText}>{g.emoji} {g.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const {
    displayComments,
    loading: commentsLoading,
    myCommentLikes,
    commentReactions,
    replyingTo,
    newComment,
    setNewComment,
    reactionPickerFor,
    setReactionPickerFor,
    inputRef,
    load: loadComments,
    submitComment,
    toggleCommentLike,
    setCommentReaction,
    startReply,
    cancelReply,
  } = useComments(postId as string);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const { data: p, error } = await supabase
        .from('posts')
        .select('*, users(full_name, avatar_url, id)')
        .eq('id', postId)
        .single();

      if (error || !p) {
        setNotFound(true);
        return;
      }

      const { data: likeRow } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user?.id || '')
        .maybeSingle();

      let trip: any = undefined;
      if (p.trip_id) {
        const { data: tripData } = await supabase
          .from('trips')
          .select('id, status, trip_type, destination, title')
          .eq('id', p.trip_id)
          .maybeSingle();
        trip = tripData || undefined;
      }

      setPost({
        id: p.id,
        user: {
          name: p.users?.full_name || 'Traveler',
          avatar: p.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.users?.full_name}`,
          id: p.user_id,
        },
        images: Array.isArray(p.media) ? p.media : [],
        content: p.content || '',
        youtube_url: p.youtube_url,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        timestamp: formatPostTime(p.created_at),
        location: p.location,
        liked: !!likeRow,
        trip_id: p.trip_id,
        trip,
      });
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (postId) loadComments(); }, [postId, loadComments]);

  const handleSubmitComment = async () => {
    try {
      await submitComment();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not post comment');
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'));

  return (
    <View style={styles.container}>
      <ScreenHeader title="Post" onBack={goBack} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={AppColors.primary} /></View>
      ) : notFound || !post ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={AppColors.subtext} />
          <Text style={styles.notFoundText}>This post is no longer available.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Single FlatList for the whole screen — media/caption/actions is
              the ListHeaderComponent, comments are the list data. Avoids the
              classic ScrollView-wrapping-a-FlatList nested-scroll conflict
              entirely, rather than working around it. */}
          <FlatList
            data={displayComments}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Spacing.md }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                <PostCard
                  post={post}
                  disableDetailNav
                  onDelete={goBack}
                  onCommentPress={() => inputRef.current?.focus()}
                />
                <View style={styles.commentsSectionHeader}>
                  <Text style={styles.commentsSectionTitle}>Comments</Text>
                </View>
              </>
            }
            ListEmptyComponent={
              commentsLoading ? (
                <ActivityIndicator size="small" color={AppColors.primary} style={{ marginTop: Spacing.xxl }} />
              ) : (
                <Text style={styles.emptyText}>No comments yet. Be first!</Text>
              )
            }
            renderItem={({ item }) => (
              <CommentRow
                item={item}
                liked={myCommentLikes.has(item.id)}
                reactions={commentReactions[item.id] || []}
                myUserId={user?.id}
                onToggleLike={() => toggleCommentLike(item)}
                onReply={() => startReply(item)}
                onLongPress={() => setReactionPickerFor(item.id)}
                onTapReaction={(emoji) => setCommentReaction(item.id, emoji)}
              />
            )}
          />

          {replyingTo && (
            <View style={styles.replyingToRow}>
              <Text style={styles.replyingToText}>
                Replying to <Text style={{ fontWeight: '700', color: AppColors.text }}>{replyingTo.userName}</Text>
              </Text>
              <TouchableOpacity onPress={cancelReply}>
                <Ionicons name="close-circle" size={18} color={AppColors.subtext} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              ref={inputRef}
              style={styles.commentInput}
              placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : 'Add a comment...'}
              placeholderTextColor={AppColors.subtext}
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity onPress={handleSubmitComment} disabled={!newComment.trim()}>
              <Text style={[styles.postBtn, { opacity: newComment.trim() ? 1 : 0.4 }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Emoji reaction picker (long-press a comment) */}
      <BottomSheet visible={!!reactionPickerFor} onClose={() => setReactionPickerFor(null)}>
        <Text style={styles.reactionPickerTitle}>React with</Text>
        <View style={styles.reactionPickerGrid}>
          {REACTION_EMOJI.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionPickerItem}
              onPress={() => reactionPickerFor && setCommentReaction(reactionPickerFor, emoji)}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  notFoundText: { color: AppColors.subtext, fontSize: 14 },

  commentsSectionHeader: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.border,
  },
  commentsSectionTitle: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: AppColors.subtext, fontSize: 13.5, textAlign: 'center', marginTop: Spacing.xxl },

  commentRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  commentRowReply: { marginLeft: Spacing.xxl, paddingVertical: 5 },
  commentRowInner: { flexDirection: 'row', gap: Spacing.md, flex: 1 },
  replyConnector: {
    position: 'absolute', left: -Spacing.lg, top: 0, bottom: 0,
    width: 1.5, backgroundColor: AppColors.border,
  },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentAvatarReply: { width: 24, height: 24, borderRadius: 12 },
  commentBubble: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.md,
  },
  commentUser: { fontWeight: '700', fontSize: 13, color: AppColors.text },
  commentText: { fontSize: 13.5, marginTop: 3, lineHeight: 19, color: AppColors.text },
  commentActionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.sm },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12, fontWeight: '600', color: AppColors.subtext },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  reactionChipMine: { backgroundColor: 'rgba(140,198,63,0.2)' },
  reactionChipText: { fontSize: 12, color: AppColors.text },

  replyingToRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.border,
    backgroundColor: AppColors.background,
  },
  replyingToText: { fontSize: 12.5, color: AppColors.subtext },

  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppColors.border,
    backgroundColor: AppColors.background,
  },
  commentInput: {
    flex: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    fontSize: 13.5, maxHeight: 80, color: AppColors.text, backgroundColor: AppColors.card,
  },
  postBtn: { color: AppColors.primary, fontWeight: '700', fontSize: 14 },

  reactionPickerTitle: { color: AppColors.text, fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  reactionPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  reactionPickerItem: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  reactionPickerEmoji: { fontSize: 26 },
});
