import React from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useComments, REACTION_EMOJI } from '@/hooks/useComments';
import CommentRow from '@/components/CommentRow';
import BottomSheet from '@/components/ui/BottomSheet';
import { AppColors, Spacing } from '@/constants/theme';

interface Props {
  postId: string;
  visible: boolean;
  onClose: () => void;
}

// Same useComments hook and CommentRow component post/[id].tsx uses — a
// bottom sheet instead of a full screen so a reel viewer never has to
// navigate away from the video to show comments.
export default function ReelComments({ postId, visible, onClose }: Props) {
  const { user } = useAuthStore();
  const {
    displayComments, loading, myCommentLikes, commentReactions,
    replyingTo, newComment, setNewComment, reactionPickerFor, setReactionPickerFor,
    inputRef, load, submitComment, toggleCommentLike, setCommentReaction, startReply, cancelReply,
  } = useComments(postId);

  React.useEffect(() => { if (visible) load(); }, [visible, load]);

  return (
    <BottomSheet visible={visible} onClose={onClose} avoidKeyboard>
      <View style={styles.header}>
        <Text style={styles.title}>Comments</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={AppColors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayComments}
        keyExtractor={(item) => item.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="small" color={AppColors.primary} style={{ marginTop: Spacing.xl }} />
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

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : 'Add a comment...'}
          placeholderTextColor={AppColors.subtext}
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity onPress={submitComment} disabled={!newComment.trim()}>
          <Text style={[styles.postBtn, { opacity: newComment.trim() ? 1 : 0.4 }]}>Post</Text>
        </TouchableOpacity>
      </View>

      {reactionPickerFor && (
        <View style={styles.reactionPickerRow}>
          {REACTION_EMOJI.map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => setCommentReaction(reactionPickerFor, emoji)}>
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  title: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  list: { maxHeight: 380 },
  emptyText: { color: AppColors.subtext, fontSize: 13.5, textAlign: 'center', marginTop: Spacing.xl },
  replyingToRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: AppColors.card, borderRadius: 10, marginTop: Spacing.sm,
  },
  replyingToText: { color: AppColors.subtext, fontSize: 12.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: AppColors.border,
  },
  input: {
    flex: 1, color: AppColors.text, fontSize: 14,
    backgroundColor: AppColors.card, borderRadius: 20,
    paddingHorizontal: Spacing.lg, paddingVertical: 10, maxHeight: 90,
  },
  postBtn: { color: AppColors.primary, fontWeight: '700', fontSize: 14, paddingBottom: 10 },
  reactionPickerRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: AppColors.border,
  },
  reactionPickerEmoji: { fontSize: 26 },
});
