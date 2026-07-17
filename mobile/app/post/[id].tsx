import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import PostCard from '@/components/PostCard';

const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        timestamp: new Date(p.created_at).toLocaleDateString(),
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8CC63F" /></View>
      ) : notFound || !post ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.3)" />
          <Text style={styles.notFoundText}>This post is no longer available.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <PostCard
            post={post}
            onDelete={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  safeTop: { backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
});
