import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { moderationAgent } from '@/lib/moderation';

const BG = '#080C14';
const GREEN = '#8CC63F';

export default function DMScreen() {
  const { userId: partnerId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuthStore();

  const [messages, setMessages] = useState<any[]>([]);
  const [partner, setPartner] = useState<any>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  // Deterministic channel name for this pair
  const channelName = [user?.id, partnerId].sort().join(':');

  useEffect(() => {
    fetchPartner();
    fetchMessages();
    markRead();
    setupRealtime();
    return () => { channelRef.current && supabase.removeChannel(channelRef.current); };
  }, [partnerId]);

  const fetchPartner = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, avatar_url, role')
      .eq('id', partnerId)
      .single();
    setPartner(data);
  };

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user?.id},receiver_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},receiver_id.eq.${user?.id})`
      )
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  const markRead = async () => {
    await supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', user?.id)
      .eq('is_read', false);
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel(`dm:${channelName}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
        filter: `receiver_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.new.sender_id === partnerId) {
          setMessages((prev) => [...prev, payload.new]);
          supabase.from('direct_messages').update({ is_read: true }).eq('id', payload.new.id);
        }
      })
      .subscribe();
    channelRef.current = channel;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Moderation check before sending
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
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_id: user?.id,
      receiver_id: partnerId,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({ sender_id: user?.id, receiver_id: partnerId, content: text })
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? data : m));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={GREEN} />
        </TouchableOpacity>
        {partner?.avatar_url ? (
          <Image source={{ uri: partner.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Text style={styles.headerAvatarText}>{partner?.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{partner?.full_name ?? 'Traveler'}</Text>
          {partner?.role && partner.role !== 'user' && (
            <Text style={styles.headerRole}>{partner.role.replace('_', ' ')}</Text>
          )}
        </View>
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.35)" />
        <Text style={styles.noticeText}>Keep conversations about travel, trekking & nature</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={GREEN} style={{ flex: 1 }} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item, index }) => {
              const isMine = item.sender_id === user?.id;
              const showDate = index === 0 ||
                new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();
              return (
                <>
                  {showDate && (
                    <Text style={styles.dateSep}>
                      {new Date(item.created_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
                    </Text>
                  )}
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
                    <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{formatTime(item.created_at)}</Text>
                  </View>
                </>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message about your trek..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="send" size={18} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarFallback: { backgroundColor: 'rgba(140,198,63,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { color: GREEN, fontWeight: '700', fontSize: 16 },
  headerInfo: { flex: 1 },
  headerName: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  headerRole: { color: GREEN, fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginTop: 1 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  noticeText: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  messageList: { padding: 16, gap: 8 },
  dateSep: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center',
    marginVertical: 12, fontWeight: '600',
  },
  bubble: {
    maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 4,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: GREEN, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#000' },
  bubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(0,0,0,0.5)' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: BG,
  },
  input: {
    flex: 1, color: '#FFF', fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
