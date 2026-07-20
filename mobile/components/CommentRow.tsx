import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppColors, Radius, Spacing } from '@/constants/theme';

interface Props {
  item: any;
  liked: boolean;
  reactions: { userId: string; emoji: string }[];
  myUserId?: string;
  onToggleLike: () => void;
  onReply: () => void;
  onLongPress: () => void;
  onTapReaction: (emoji: string) => void;
}

// Extracted from post/[id].tsx so the same comment row (avatar, bubble,
// like/reply actions, reaction chips, reply-connector line) renders
// identically wherever comments show up — the post detail screen and the
// Reels comment sheet — instead of two components doing the same job.
export default function CommentRow({
  item, liked, reactions, myUserId, onToggleLike, onReply, onLongPress, onTapReaction,
}: Props) {
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

const styles = StyleSheet.create({
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
});
