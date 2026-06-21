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
  Modal,
  Alert,
  Animated,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePostRealtime } from '@/hooks/usePostRealtime';
import YouTubePlayer from './YouTubePlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  location?: string;
  trip_id?: string;
  trip?: TripMeta;
  youtube_url?: string;
}

interface PostCardProps {
  post: Post;
  onCommentPress?: (postId: string) => void;
  onDelete?: (postId: string) => void;
}

const TRIP_EMOJI: Record<string, string> = {
  trek: '⛰️', bike: '🏍️', temple: '🛕', backpacking: '🎒', weekend: '🌄',
};

function TripBanner({ trip, colors }: { trip: TripMeta; colors: any }) {
  const isCompleted = trip.status === 'completed';
  const emoji = TRIP_EMOJI[trip.trip_type] || '🗺️';
  const label = isCompleted
    ? `${emoji} ${trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1)} Completed`
    : `${emoji} ${trip.title || trip.destination}`;

  return (
    <View style={[
      tripBannerStyles.banner,
      { backgroundColor: isCompleted ? 'rgba(140,198,63,0.1)' : 'rgba(56,151,240,0.08)' },
    ]}>
      <View style={{ flex: 1 }}>
        <Text style={[tripBannerStyles.label, { color: isCompleted ? '#8CC63F' : '#3897F0' }]}>
          {label}
        </Text>
        <Text style={[tripBannerStyles.dest, { color: colors.subtext }]} numberOfLines={1}>
          📍 {trip.destination}
        </Text>
      </View>
      {isCompleted && (
        <Ionicons name="checkmark-circle" size={20} color="#8CC63F" />
      )}
    </View>
  );
}

const tripBannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  dest: {
    fontSize: 11,
  },
});

export default function PostCard({ post, onCommentPress, onDelete }: PostCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#000',
    subtext: isDark ? '#A8A8A8' : '#737373',
    border: isDark ? '#262626' : '#DBDBDB',
    input: isDark ? '#1C1C1C' : '#FAFAFA',
  };

  const { user } = useAuthStore();
  const { likesCount, setLikesCount, commentsCount } = usePostRealtime(post.id, post.likes_count, post.comments_count);

  const [liked, setLiked] = useState(post.liked ?? false);
  const [currentImage, setCurrentImage] = useState(0);
  const [commentVisible, setCommentVisible] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [caption, setCaption] = useState(post.content);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLike = async () => {
    // Heart pop animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

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

  const openComments = async () => {
    setCommentVisible(true);
    setLoadingComments(true);
    try {
      // Fetch comments — is_hidden may be NULL on older rows, neq(true) handles both false and null
      const { data: commentRows, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', post.id)
        .neq('is_hidden', true)
        .order('created_at', { ascending: true });
      if (error) throw error;

      if (commentRows && commentRows.length > 0) {
        // post_comments.user_id → auth.users (not public.users), so fetch profiles separately
        const userIds = [...new Set(commentRows.map((c: any) => c.user_id))];
        const { data: profileRows } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        const profileMap: Record<string, any> = {};
        (profileRows || []).forEach((u: any) => { profileMap[u.id] = u; });
        setComments(commentRows.map((c: any) => ({ ...c, users: profileMap[c.user_id] || null })));
      } else {
        setComments([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingComments(false);
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
        { text: 'Report', onPress: () => Alert.alert('Reported', 'Thanks for your report. We will review it.') },
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

  const submitComment = async () => {
    if (!newComment.trim() || !user?.id) return;
    const text = newComment.trim();
    setNewComment('');
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id: post.id, user_id: user.id, content: text })
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
      Alert.alert('Error', e?.message || 'Could not post comment');
    }
  };

  const onScrollImage = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentImage(index);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: post.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.name}` }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>{post.user.name}</Text>
          {post.location && (
            <Text style={[styles.location, { color: colors.subtext }]}>{post.location}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleOptions}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.subtext} />
        </TouchableOpacity>
      </View>

      {/* Trip Banner */}
      {post.trip && <TripBanner trip={post.trip} colors={colors} />}

      {/* Image Carousel */}
      {post.images.length > 0 && (
        <View>
          <FlatList
            data={post.images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScrollImage}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.postImage} />
            )}
          />
          {/* Dot Indicators */}
          {post.images.length > 1 && (
            <View style={styles.dotsContainer}>
              {post.images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === currentImage ? '#3897F0' : 'rgba(0,0,0,0.2)' }
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* YouTube inline player */}
      {post.youtube_url && (
        <View style={{ paddingHorizontal: 12 }}>
          <YouTubePlayer url={post.youtube_url} height={210} />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={26}
                color={liked ? '#ED4956' : colors.text}
              />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { onCommentPress ? onCommentPress(post.id) : openComments(); }}
            style={styles.actionBtn}
          >
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity>
          <Ionicons name="bookmark-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Likes Count */}
      <View style={styles.metaSection}>
        <Text style={[styles.likesText, { color: colors.text }]}>
          {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </Text>

        {/* Caption */}
        {caption ? (
          <Text style={[styles.caption, { color: colors.text }]}>
            <Text style={styles.captionUser}>{post.user.name} </Text>
            {caption}
          </Text>
        ) : null}

        {/* Comments count */}
        {commentsCount > 0 && (
          <TouchableOpacity onPress={() => { onCommentPress ? onCommentPress(post.id) : openComments(); }}>
            <Text style={[styles.viewComments, { color: colors.subtext }]}>
              View all {commentsCount} comments
            </Text>
          </TouchableOpacity>
        )}

        {/* Timestamp */}
        <Text style={[styles.timestamp, { color: colors.subtext }]}>{post.timestamp}</Text>
      </View>

      {/* Comments Modal */}
      <Modal
        visible={commentVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCommentVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.commentsModal, { backgroundColor: colors.bg }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={() => setCommentVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading...</Text>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                style={styles.commentsList}
                ListEmptyComponent={
                  <Text style={[styles.loadingText, { color: colors.subtext }]}>No comments yet. Be first!</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <Image
                      source={{ uri: item.users?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}` }}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <Text style={[styles.commentUser, { color: colors.text }]}>
                        {item.users?.full_name ?? 'User'}
                      </Text>
                      <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            {/* Comment Input */}
            <View style={[styles.commentInputRow, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
              <TextInput
                style={[styles.commentInput, { color: colors.text, backgroundColor: colors.input }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.subtext}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity onPress={submitComment} disabled={!newComment.trim()}>
                <Text style={[styles.postBtn, { opacity: newComment.trim() ? 1 : 0.4 }]}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Caption Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editOverlay}>
            <View style={[styles.editSheet, { backgroundColor: colors.bg }]}>
              <View style={styles.commentsHeader}>
                <Text style={[styles.commentsTitle, { color: colors.text }]}>Edit Caption</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.editInput, { color: colors.text, backgroundColor: colors.input, borderColor: colors.border }]}
                value={editCaption}
                onChangeText={setEditCaption}
                multiline
                autoFocus
                placeholder="Write a caption..."
                placeholderTextColor={colors.subtext}
              />
              <TouchableOpacity
                style={[styles.editSaveBtn, { opacity: editCaption.trim() ? 1 : 0.5 }]}
                onPress={handleEditSave}
                disabled={!editCaption.trim()}
              >
                <Text style={styles.editSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    fontSize: 13.5,
  },
  location: {
    fontSize: 11,
    marginTop: 1,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    resizeMode: 'cover',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 14,
  },
  actionBtn: {
    padding: 2,
  },
  metaSection: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  likesText: {
    fontWeight: '600',
    fontSize: 13.5,
  },
  caption: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  captionUser: {
    fontWeight: '600',
  },
  viewComments: {
    fontSize: 13,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  commentsModal: {
    flex: 1,
    paddingTop: 48,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontWeight: '600',
    fontSize: 13,
  },
  commentText: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13.5,
    maxHeight: 80,
  },
  postBtn: {
    color: '#3897F0',
    fontWeight: '600',
    fontSize: 14,
  },
  editOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  editSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  editInput: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  editSaveBtn: {
    backgroundColor: '#3897F0',
    borderRadius: 20,
    paddingVertical: 13,
    alignItems: 'center',
  },
  editSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
