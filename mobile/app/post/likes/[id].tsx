import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import UserAvatar from '@/components/UserAvatar';

const GREEN = '#8CC63F';
const BG = '#080C14';
const CARD = 'rgba(255,255,255,0.05)';
const BORDER = 'rgba(255,255,255,0.07)';

interface Person {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export default function PostLikesScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (postId) load(); }, [postId]);

  const load = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const { data: rows } = await supabase.from('post_likes').select('user_id').eq('post_id', postId);
      const ids = (rows || []).map((r: any) => r.user_id);
      if (ids.length === 0) {
        setPeople([]);
        return;
      }
      const { data: users } = await supabase.from('users').select('id, full_name, avatar_url, bio').in('id', ids);
      setPeople(users || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Likes</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      ) : people.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={64} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyText}>No likes yet</Text>
        </View>
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => router.push(`/user/${item.id}` as any)}
            >
              <UserAvatar userId={item.id} avatarUrl={item.avatar_url ?? undefined} fullName={item.full_name ?? undefined} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.full_name || 'Traveler'}</Text>
                {item.bio ? <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center' },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  name: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  bio: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
});
