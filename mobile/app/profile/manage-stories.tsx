import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors } from '@/constants/theme';
import ScreenHeader from '@/components/ui/ScreenHeader';

const ACCENT = '#EC4899';
const BG = AppColors.background;

type Story = {
  id: string;
  title: string | null;
  content: string;
  media: string[] | null;
  created_at: string;
  likes_count: number;
};

function StoryRow({ story, onEdit, onDelete }: { story: Story; onEdit: () => void; onDelete: () => void }) {
  const cover = story.media?.[0] ?? null;
  return (
    <TouchableOpacity style={styles.row} onPress={() => router.push(`/stories/${story.id}` as any)} activeOpacity={0.8}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="book-outline" size={22} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{story.title || story.content.slice(0, 60)}</Text>
        <Text style={styles.rowMeta}>
          {new Date(story.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {'  ·  '}{story.likes_count || 0} likes
        </Text>
      </View>
      <TouchableOpacity
        style={styles.rowMenuBtn}
        onPress={() => Alert.alert('Article Options', undefined, [
          { text: 'Edit Article', onPress: onEdit },
          { text: 'Delete Article', style: 'destructive', onPress: onDelete },
          { text: 'Cancel', style: 'cancel' },
        ])}
      >
        <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function ManageStoriesScreen() {
  const user = useAuthStore((s) => s.user);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('posts')
      .select('id, title, content, media, created_at, likes_count')
      .eq('user_id', user.id)
      .eq('post_type', 'trip_story')
      .order('created_at', { ascending: false });
    setStories(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const deleteStory = (story: Story) => {
    Alert.alert('Delete Article', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', story.id);
          if (error) {
            Alert.alert('Error', 'Could not delete article.');
            return;
          }
          setStories((prev) => prev.filter((s) => s.id !== story.id));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Manage Articles" />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={ACCENT} /></View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <StoryRow
              story={item}
              onEdit={() => router.push(`/stories/create?id=${item.id}` as any)}
              onDelete={() => deleteStory(item)}
            />
          )}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>You haven't written any articles yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, gap: 12, flexGrow: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: ACCENT + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { color: '#FFF', fontSize: 13.5, fontWeight: '700' },
  rowMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  rowMenuBtn: { padding: 8 },

  empty: { alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});
