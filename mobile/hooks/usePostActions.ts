import { useState, useRef } from 'react';
import { Animated, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePostRealtime } from '@/hooks/usePostRealtime';

interface PostLike {
  id: string;
  user: { id?: string };
  content: string;
  likes_count: number;
  comments_count: number;
  liked?: boolean;
  saved?: boolean;
}

// Like/save/delete/report/edit-caption — the exact logic PostCard has always
// had, pulled out so ReelActions (a completely different vertical layout)
// can drive the same Supabase calls instead of reimplementing them. No
// behavior change for existing PostCard callers.
export function usePostActions(post: PostLike, onDelete?: (postId: string) => void) {
  const { user } = useAuthStore();
  const { likesCount, setLikesCount, commentsCount } = usePostRealtime(post.id, post.likes_count, post.comments_count);

  const [liked, setLiked] = useState(post.liked ?? false);
  const [saved, setSaved] = useState(post.saved ?? false);
  const [caption, setCaption] = useState(post.content);
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  const pop = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.25, duration: 100, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
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
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    }
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

  const handleEditSave = async (newCaption: string) => {
    try {
      const { error } = await supabase.from('posts').update({ content: newCaption }).eq('id', post.id);
      if (error) throw error;
      setCaption(newCaption);
      return true;
    } catch {
      Alert.alert('Error', 'Could not update caption.');
      return false;
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

  const isOwn = post.user.id === user?.id;

  return {
    liked, likesCount, saved, commentsCount, caption,
    likeScale, saveScale,
    isOwn,
    handleLike, handleSave, handleDelete, submitReport, handleEditSave,
  };
}
