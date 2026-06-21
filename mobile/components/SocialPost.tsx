import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import YouTubePlayer from './YouTubePlayer';

export default function SocialPost({ post, onRefresh }: any) {
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false); // Should check from post_likes table
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);

  const handleLike = async () => {
    try {
      const newLiked = !liked;
      setLiked(newLiked);
      setLikesCount((prev: number) => newLiked ? prev + 1 : prev - 1);
      
      if (newLiked) {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user?.id });
      } else {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user?.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post.content}\n\nCheck out this adventure on TrekRiderz: trekriderz://post/${post.id}`,
        url: `https://trekriderz.app/post/${post.id}`
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      {/* Post Header */}
      <View style={styles.header}>
        <Image 
          source={{ uri: post.users?.avatar_url || 'https://ui-avatars.com/api/?name=' + post.users?.full_name }} 
          style={styles.avatar} 
        />
        <View style={styles.headerText}>
          <Text style={styles.userName}>{post.users?.full_name}</Text>
          <Text style={styles.time}>{new Date(post.created_at).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" /></TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.content}>{post.content}</Text>
      
      {post.media && post.media.length > 0 && (
        <Image source={{ uri: post.media[0] }} style={styles.postImage} resizeMode="contain" />
      )}

      {/* YouTube inline player */}
      {post.youtube_url && (
        <YouTubePlayer url={post.youtube_url} height={220} />
      )}

      {/* Post Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? "#EF4444" : "#B8BCC8"} />
          <Text style={[styles.actionText, liked && { color: '#EF4444' }]}>{likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={20} color="#B8BCC8" />
          <Text style={styles.actionText}>{post.comments_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={20} color="#B8BCC8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0D132050', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerText: { flex: 1 },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  time: { color: '#6B7280', fontSize: 12 },
  content: { color: '#E5E7EB', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  postImage: { width: '100%', minHeight: 180, maxHeight: 420, borderRadius: 16, marginBottom: 12, backgroundColor: '#000' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#B8BCC8', fontSize: 13, fontWeight: '600' },
});
