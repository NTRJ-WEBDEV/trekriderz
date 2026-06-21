import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const BG = '#080C14';
const GREEN = '#8CC63F';

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

export default function ChatsScreen() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useFocusEffect(useCallback(() => {
    fetchConversations();
  }, [user?.id]));

  const fetchConversations = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Get all messages where user is sender or receiver
      const { data, error } = await supabase
        .from('direct_messages')
        .select(`
          id, content, created_at, is_read, sender_id, receiver_id,
          sender:sender_id(id, full_name, avatar_url),
          receiver:receiver_id(id, full_name, avatar_url)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group into conversations (one per partner)
      const seen = new Set<string>();
      const convos: Conversation[] = [];

      for (const msg of (data || [])) {
        const partner = msg.sender_id === user.id ? msg.receiver : msg.sender;
        if (!partner || seen.has(partner.id)) continue;
        seen.add(partner.id);

        // Count unread from this partner
        const unread = (data || []).filter(
          (m: any) => m.sender_id === partner.id && m.receiver_id === user.id && !m.is_read
        ).length;

        convos.push({
          partnerId: partner.id,
          partnerName: partner.full_name || 'Traveler',
          partnerAvatar: partner.avatar_url,
          lastMessage: msg.content,
          lastTime: msg.created_at,
          unread,
        });
      }

      setConversations(convos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = conversations.filter(c =>
    c.partnerName.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Text style={styles.subtitle}>Travel conversations only</Text>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={56} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyDesc}>
            Connect with guides, fellow trekkers, and homestay owners to start chatting about your next adventure.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.partnerId}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/dm/${item.partnerId}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                {item.partnerAvatar ? (
                  <Image source={{ uri: item.partnerAvatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{item.partnerName[0]?.toUpperCase()}</Text>
                  </View>
                )}
                {item.unread > 0 && <View style={styles.onlineDot} />}
              </View>

              <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                  <Text style={styles.partnerName} numberOfLines={1}>{item.partnerName}</Text>
                  <Text style={styles.time}>{formatTime(item.lastTime)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={[styles.lastMsg, item.unread > 0 && styles.lastMsgUnread]} numberOfLines={1}>
                    {item.lastMessage}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: GREEN, fontSize: 20, fontWeight: '700' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: GREEN, borderWidth: 2, borderColor: BG,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  partnerName: { color: '#FFF', fontWeight: '700', fontSize: 15, flex: 1, marginRight: 8 },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 12 },
  rowBottom: { flexDirection: 'row', alignItems: 'center' },
  lastMsg: { color: 'rgba(255,255,255,0.45)', fontSize: 13, flex: 1 },
  lastMsgUnread: { color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  badge: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: '#000', fontSize: 11, fontWeight: '800' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 82 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptyDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
