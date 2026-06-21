import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { moderationAgent } from '@/lib/moderation';

const BG = '#080C14';
const GREEN = '#8CC63F';

type Tab = 'posts' | 'chat';

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [community, setCommunity] = useState<any>(null);
  const [memberStatus, setMemberStatus] = useState<'none' | 'pending' | 'approved'>('none');
  const isMember = memberStatus === 'approved';
  const isOwner = community?.created_by === user?.id;
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchCommunity();
    fetchPosts();
    fetchMessages();
    setupRealtime();
    return () => { channelRef.current && supabase.removeChannel(channelRef.current); };
  }, [id]);

  const fetchCommunity = async () => {
    const { data } = await supabase
      .from('communities')
      .select('*')
      .eq('id', id)
      .single();
    setCommunity(data);

    const { data: member } = await supabase
      .from('community_members')
      .select('status')
      .eq('community_id', id)
      .eq('user_id', user?.id)
      .maybeSingle();
    setMemberStatus((member?.status as any) ?? 'none');
    setLoading(false);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('community_posts')
      .select('*, users:user_id(id, full_name, avatar_url)')
      .eq('community_id', id)
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('community_messages')
      .select('*, users:user_id(id, full_name, avatar_url)')
      .eq('community_id', id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel(`community:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_messages',
        filter: `community_id=eq.${id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('community_messages')
          .select('*, users:user_id(id, full_name, avatar_url)')
          .eq('id', payload.new.id)
          .single();
        if (data) setMessages((prev) => [...prev, data]);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_posts',
        filter: `community_id=eq.${id}`,
      }, () => { fetchPosts(); })
      .subscribe();
    channelRef.current = channel;
  };

  const requestJoin = async () => {
    setMemberStatus('pending');
    const { error } = await supabase.from('community_members').insert({
      community_id: id,
      user_id: user?.id,
      status: 'pending',
    });
    if (error) {
      setMemberStatus('none');
      Alert.alert('Error', 'Failed to send join request.');
      return;
    }
    // Notify owner
    if (community?.created_by) {
      await supabase.from('notifications').insert({
        user_id: community.created_by,
        type: 'community_join_request',
        title: 'New Join Request',
        message: `${user?.user_metadata?.full_name || 'Someone'} wants to join "${community.name}"`,
        data: { community_id: id },
      }).throwOnError().catch(() => {});
    }
    Alert.alert('Request Sent', 'The community owner will review your request.');
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;

    const result = await moderationAgent.inspectText(text, user?.id!, 'chat');
    if (!result.safe) {
      Alert.alert(
        result.severity === 'flag' ? 'Account Flagged' : 'Message Blocked',
        result.message,
      );
      if (result.severity === 'flag') router.replace('/(tabs)');
      return;
    }

    setSending(true);
    setChatInput('');
    try {
      await supabase.from('community_messages').insert({
        community_id: id,
        user_id: user?.id,
        content: text,
      });
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={GREEN} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={GREEN} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.communityName} numberOfLines={1}>{community?.name}</Text>
          <Text style={styles.communityMeta}>{community?.member_count} members</Text>
        </View>
        {isOwner ? (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => router.push(`/community/manage/${id}` as any)}
          >
            <Ionicons name="settings-outline" size={16} color={GREEN} />
            <Text style={styles.manageBtnText}>Manage</Text>
          </TouchableOpacity>
        ) : memberStatus === 'none' ? (
          <TouchableOpacity style={styles.joinBtn} onPress={requestJoin}>
            <Text style={styles.joinBtnText}>Request</Text>
          </TouchableOpacity>
        ) : memberStatus === 'pending' ? (
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        ) : null}
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['posts', 'chat'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === 'posts' ? 'newspaper-outline' : 'chatbubbles-outline'}
              size={16}
              color={tab === t ? GREEN : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'posts' ? 'Posts' : 'Group Chat'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Posts tab */}
      {tab === 'posts' && (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.postList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={44} color="rgba(255,255,255,0.1)" />
              <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                {item.users?.avatar_url ? (
                  <Image source={{ uri: item.users.avatar_url }} style={styles.postAvatar} />
                ) : (
                  <View style={[styles.postAvatar, styles.postAvatarFallback]}>
                    <Text style={styles.postAvatarText}>{item.users?.full_name?.[0] ?? '?'}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.postUser}>{item.users?.full_name}</Text>
                  <Text style={styles.postTime}>
                    {new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>
              {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
              {item.media?.length > 0 && (
                <Image source={{ uri: item.media[0] }} style={styles.postImage} resizeMode="cover" />
              )}
            </View>
          )}
        />
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {!isMember ? (
            <View style={styles.joinPrompt}>
              <Ionicons
                name={memberStatus === 'pending' ? 'time-outline' : 'lock-closed-outline'}
                size={40}
                color="rgba(255,255,255,0.2)"
              />
              {memberStatus === 'pending' ? (
                <>
                  <Text style={styles.joinPromptTitle}>Request Pending</Text>
                  <Text style={styles.joinPromptText}>
                    The community owner will review your request. You'll be notified when approved.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.joinPromptTitle}>Members Only</Text>
                  <Text style={styles.joinPromptText}>
                    Request to join this community to access posts and group chat.
                  </Text>
                  <TouchableOpacity style={styles.joinBtn} onPress={requestJoin}>
                    <Text style={styles.joinBtnText}>Request to Join</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={styles.chatList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>Say hello to the community! 👋</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isMine = item.user_id === user?.id;
                  return (
                    <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                      {!isMine && (
                        item.users?.avatar_url ? (
                          <Image source={{ uri: item.users.avatar_url }} style={styles.msgAvatar} />
                        ) : (
                          <View style={[styles.msgAvatar, styles.postAvatarFallback]}>
                            <Text style={styles.postAvatarText}>{item.users?.full_name?.[0] ?? '?'}</Text>
                          </View>
                        )
                      )}
                      <View style={styles.msgBubbleWrap}>
                        {!isMine && (
                          <Text style={styles.msgName}>{item.users?.full_name}</Text>
                        )}
                        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleTheirs]}>
                          <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
                        </View>
                        <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{formatTime(item.created_at)}</Text>
                      </View>
                    </View>
                  );
                }}
              />

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Chat about treks, routes, tips..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!chatInput.trim() || sending) && styles.sendBtnDisabled]}
                  onPress={sendMessage}
                  disabled={!chatInput.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Ionicons name="send" size={17} color="#000" />
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4 },
  communityName: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  communityMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  joinBtn: {
    backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
  },
  joinBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: GREEN },
  tabLabel: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontSize: 14 },
  tabLabelActive: { color: GREEN },
  postList: { padding: 16, gap: 12 },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postAvatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', alignItems: 'center', justifyContent: 'center' },
  postAvatarText: { color: GREEN, fontWeight: '700' },
  postUser: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  postTime: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  postContent: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  postImage: { width: '100%', height: 180, borderRadius: 10 },
  chatList: { padding: 12, gap: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15 },
  msgBubbleWrap: { maxWidth: '72%' },
  msgName: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 3, marginLeft: 4 },
  msgBubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  msgBubbleMine: { backgroundColor: GREEN, borderBottomRightRadius: 4 },
  msgBubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 4 },
  msgText: { color: '#FFF', fontSize: 14, lineHeight: 19 },
  msgTextMine: { color: '#000' },
  msgTime: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 3, marginLeft: 4 },
  msgTimeMine: { textAlign: 'right', marginRight: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: BG,
  },
  chatInput: {
    flex: 1, color: '#FFF', fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  joinPrompt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 },
  joinPromptTitle: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  joinPromptText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  pendingBadgeText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: GREEN, backgroundColor: 'rgba(140,198,63,0.08)',
  },
  manageBtnText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', paddingTop: 50, gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
});
