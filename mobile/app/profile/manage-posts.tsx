import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';

type Post = {
  id: string;
  content: string;
  media: string[] | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
};

function PostRow({ post, onEdit, onDelete }: { post: Post; onEdit: () => void; onDelete: () => void }) {
  const cover = post.media?.[0] ?? null;
  return (
    <View style={styles.row}>
      {cover ? (
        <Image source={{ uri: cover }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="document-text-outline" size={22} color="rgba(255,255,255,0.3)" />
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowContent} numberOfLines={2}>{post.content || '(no caption)'}</Text>
        <Text style={styles.rowMeta}>
          {new Date(post.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {'  ·  '}{post.likes_count || 0} likes  ·  {post.comments_count || 0} comments
        </Text>
      </View>
      <TouchableOpacity
        style={styles.rowMenuBtn}
        onPress={() => Alert.alert('Post Options', undefined, [
          { text: 'Edit Caption', onPress: onEdit },
          { text: 'Delete Post', style: 'destructive', onPress: onDelete },
          { text: 'Cancel', style: 'cancel' },
        ])}
      >
        <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
    </View>
  );
}

export default function ManagePostsScreen() {
  const user = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<Post | null>(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('posts')
      .select('id, content, media, created_at, likes_count, comments_count')
      .eq('user_id', user.id)
      .or('post_type.is.null,post_type.neq.trip_story')
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (post: Post) => {
    setEditTarget(post);
    setEditText(post.content || '');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const { error } = await supabase.from('posts').update({ content: editText.trim() }).eq('id', editTarget.id);
    if (error) {
      Alert.alert('Error', 'Could not update post.');
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === editTarget.id ? { ...p, content: editText.trim() } : p)));
    setEditTarget(null);
  };

  const deletePost = (post: Post) => {
    Alert.alert('Delete Post', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', post.id);
          if (error) {
            Alert.alert('Error', 'Could not delete post.');
            return;
          }
          setPosts((prev) => prev.filter((p) => p.id !== post.id));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Posts</Text>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={GREEN} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PostRow post={item} onEdit={() => openEdit(item)} onDelete={() => deletePost(item)} />
          )}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="images-outline" size={40} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyText}>You haven't posted anything yet.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!editTarget} animationType="slide" transparent onRequestClose={() => setEditTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.editOverlay}>
            <View style={styles.editSheet}>
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Edit Caption</Text>
                <TouchableOpacity onPress={() => setEditTarget(null)}>
                  <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                placeholder="Write a caption..."
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
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
  container: { flex: 1, backgroundColor: BG },
  safeTop: { backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },

  list: { padding: 16, gap: 12, flexGrow: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowContent: { color: '#FFF', fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  rowMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  rowMenuBtn: { padding: 8 },

  empty: { alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  editOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  editSheet: { backgroundColor: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  editTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  editInput: {
    minHeight: 100, color: '#FFF', backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    padding: 14, fontSize: 14, textAlignVertical: 'top',
  },
  editSaveBtn: {
    marginTop: 14, backgroundColor: GREEN, borderRadius: 24,
    paddingVertical: 14, alignItems: 'center',
  },
  editSaveBtnText: { color: '#080C14', fontWeight: '800', fontSize: 15 },
});
