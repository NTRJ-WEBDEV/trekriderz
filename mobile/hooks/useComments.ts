import { useCallback, useMemo, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// A curated quick-reaction set rather than full OS emoji-keyboard
// integration — matches the WhatsApp long-press picker's own scope (a grid
// of common reactions, not a full keyboard swap).
export const REACTION_EMOJI = [
  '❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🔥',
  '🎉', '😍', '🙏', '💯', '😊', '😎', '🥳', '😭',
  '👏', '🤔', '😅', '🙌', '💪', '✨', '😴', '🤩',
  '😱', '🥺', '💀', '🤝', '👀', '🚀',
];

export interface ReplyTarget {
  id: string;
  userName: string;
}

// Shared by PostCard's feed-card context (indirectly, via navigation) and
// the full-screen post detail view — one comment implementation (fetch,
// like, react, reply) instead of maintaining two.
export function useComments(postId: string) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myCommentLikes, setMyCommentLikes] = useState<Set<string>>(new Set());
  const [commentReactions, setCommentReactions] = useState<Record<string, { userId: string; emoji: string }[]>>({});
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [newComment, setNewComment] = useState('');
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      // is_hidden may be NULL on older rows, neq(true) handles both false and null
      const { data: commentRows, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .neq('is_hidden', true)
        .order('created_at', { ascending: true });
      if (error) throw error;

      if (commentRows && commentRows.length > 0) {
        // post_comments.user_id → auth.users (not public.users), so fetch profiles separately
        const userIds = [...new Set(commentRows.map((c: any) => c.user_id))];
        const commentIds = commentRows.map((c: any) => c.id);
        const [{ data: profileRows }, { data: likeRows }, { data: reactionRows }] = await Promise.all([
          supabase.from('users').select('id, full_name, avatar_url').in('id', userIds),
          user?.id
            ? supabase.from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', commentIds)
            : Promise.resolve({ data: [] as any[] }),
          supabase.from('comment_reactions').select('comment_id, user_id, emoji').in('comment_id', commentIds),
        ]);
        const profileMap: Record<string, any> = {};
        (profileRows || []).forEach((u: any) => { profileMap[u.id] = u; });
        setComments(commentRows.map((c: any) => ({ ...c, users: profileMap[c.user_id] || null })));
        setMyCommentLikes(new Set((likeRows || []).map((l: any) => l.comment_id)));
        const reactionsByComment: Record<string, { userId: string; emoji: string }[]> = {};
        (reactionRows || []).forEach((r: any) => {
          (reactionsByComment[r.comment_id] ||= []).push({ userId: r.user_id, emoji: r.emoji });
        });
        setCommentReactions(reactionsByComment);
      } else {
        setComments([]);
        setMyCommentLikes(new Set());
        setCommentReactions({});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id]);

  const submitComment = useCallback(async () => {
    if (!newComment.trim() || !user?.id) return;
    const text = newComment.trim();
    const parentId = replyingTo?.id ?? null;
    const parentUserName = replyingTo?.userName;
    setNewComment('');
    setReplyingTo(null);
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, user_id: user.id, content: text, parent_comment_id: parentId })
        .select('*')
        .single();
      if (error) throw error;
      // Attach current user's profile manually (FK is to auth.users, not public.users)
      setComments(prev => [...prev, {
        ...data,
        users: {
          full_name: user.user_metadata?.full_name || 'You',
          avatar_url: user.user_metadata?.avatar_url || null,
        },
      }]);
    } catch (e: any) {
      setNewComment(text); // restore on error
      if (parentId && parentUserName) setReplyingTo({ id: parentId, userName: parentUserName });
      throw e;
    }
  }, [newComment, user, postId, replyingTo]);

  const toggleCommentLike = useCallback(async (comment: any) => {
    if (!user?.id) return;
    const wasLiked = myCommentLikes.has(comment.id);
    setMyCommentLikes(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(comment.id) : next.add(comment.id);
      return next;
    });
    setComments(prev => prev.map(c => c.id === comment.id
      ? { ...c, likes_count: Math.max(0, c.likes_count + (wasLiked ? -1 : 1)) }
      : c));
    try {
      if (wasLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_id', user.id);
      } else {
        await supabase.from('comment_likes').insert({ comment_id: comment.id, user_id: user.id });
      }
    } catch (e) {
      // Revert on error
      setMyCommentLikes(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(comment.id) : next.delete(comment.id);
        return next;
      });
      setComments(prev => prev.map(c => c.id === comment.id
        ? { ...c, likes_count: Math.max(0, c.likes_count + (wasLiked ? 1 : -1)) }
        : c));
    }
  }, [user, myCommentLikes]);

  const setCommentReaction = useCallback(async (commentId: string, emoji: string) => {
    if (!user?.id) return;
    setReactionPickerFor(null);
    const prevForComment = commentReactions[commentId] || [];
    const mine = prevForComment.find(r => r.userId === user.id);
    const isSameEmoji = mine?.emoji === emoji;

    setCommentReactions(prev => {
      const list = (prev[commentId] || []).filter(r => r.userId !== user.id);
      if (!isSameEmoji) list.push({ userId: user.id, emoji });
      return { ...prev, [commentId]: list };
    });

    try {
      if (isSameEmoji) {
        await supabase.from('comment_reactions').delete().eq('comment_id', commentId).eq('user_id', user.id);
      } else {
        await supabase.from('comment_reactions').upsert(
          { comment_id: commentId, user_id: user.id, emoji },
          { onConflict: 'comment_id,user_id' }
        );
      }
    } catch (e) {
      // Revert on error
      setCommentReactions(prev => ({ ...prev, [commentId]: prevForComment }));
    }
  }, [user, commentReactions]);

  const startReply = useCallback((comment: any) => {
    setReplyingTo({ id: comment.id, userName: comment.users?.full_name ?? 'User' });
    inputRef.current?.focus();
  }, []);

  const cancelReply = useCallback(() => setReplyingTo(null), []);

  // Top-level comments in original order, each immediately followed by its
  // own replies (also chronological) — one flat list, no nested FlatList,
  // so a comment and its replies stay visually grouped.
  const displayComments = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_comment_id);
    const repliesByParent: Record<string, any[]> = {};
    comments.filter(c => c.parent_comment_id).forEach(c => {
      (repliesByParent[c.parent_comment_id] ||= []).push(c);
    });
    const out: any[] = [];
    topLevel.forEach(c => {
      out.push(c);
      out.push(...(repliesByParent[c.id] || []));
    });
    return out;
  }, [comments]);

  return {
    comments,
    displayComments,
    loading,
    myCommentLikes,
    commentReactions,
    replyingTo,
    newComment,
    setNewComment,
    reactionPickerFor,
    setReactionPickerFor,
    inputRef,
    load,
    submitComment,
    toggleCommentLike,
    setCommentReaction,
    startReply,
    cancelReply,
  };
}
