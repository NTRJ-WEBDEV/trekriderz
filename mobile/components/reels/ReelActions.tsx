import React from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Props {
  userId?: string;
  avatarUrl: string;
  liked: boolean;
  likesCount: number;
  likeScale: Animated.Value;
  onLike: () => void;
  onLikesPress: () => void;
  commentsCount: number;
  onCommentPress: () => void;
  onSharePress: () => void;
  saved: boolean;
  saveScale: Animated.Value;
  onSave: () => void;
}

// Right-side action column — same like/comment/share/save calls as
// PostCard's action row (via usePostActions, owned by the caller), just
// laid out vertically for the full-screen reel viewer instead of PostCard's
// horizontal row.
export default function ReelActions({
  userId, avatarUrl, liked, likesCount, likeScale, onLike, onLikesPress,
  commentsCount, onCommentPress, onSharePress, saved, saveScale, onSave,
}: Props) {
  return (
    <View style={styles.col}>
      <TouchableOpacity onPress={() => userId && router.push(`/user/${userId}` as any)} style={styles.avatarWrap}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      </TouchableOpacity>

      <View style={styles.action}>
        <TouchableOpacity onPress={onLike} hitSlop={10}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? '#ED4956' : '#FFF'} />
          </Animated.View>
        </TouchableOpacity>
        {likesCount > 0 && (
          <TouchableOpacity onPress={onLikesPress} hitSlop={8}>
            <Text style={styles.count}>{likesCount}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.action}>
        <TouchableOpacity onPress={onCommentPress} hitSlop={10}>
          <Ionicons name="chatbubble-outline" size={29} color="#FFF" />
        </TouchableOpacity>
        {commentsCount > 0 && <Text style={styles.count}>{commentsCount}</Text>}
      </View>

      <View style={styles.action}>
        <TouchableOpacity onPress={onSharePress} hitSlop={10}>
          <Ionicons name="paper-plane-outline" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.action}>
        <TouchableOpacity onPress={onSave} hitSlop={10}>
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={28} color={saved ? '#8CC63F' : '#FFF'} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center', gap: 22 },
  avatarWrap: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: '#FFF',
    marginBottom: 4,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 21 },
  action: { alignItems: 'center', gap: 4 },
  count: { color: '#FFF', fontSize: 12.5, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
});
