import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import MessageItem from '@/components/MessageItem';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/storage';

export default function TripChatScreen() {
  const { tripId } = useLocalSearchParams();
  const currentUser = useAuthStore((state) => state.user);

  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchMessages();
    fetchMembers();
    setupRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [tripId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('trip_messages')
        .select(`*, users:user_id (id, full_name, avatar_url)`)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      if (data?.length > 0 && currentUser) {
        markAsRead(data[data.length - 1].id);
      }

      setTimeout(() => flatListRef.current?.scrollToEnd(), 500);
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('trip_members')
      .select('user_id, last_read_message_id, users(full_name, avatar_url)')
      .eq('trip_id', tripId);
    if (data) setMembers(data);
  };

  const markAsRead = async (messageId: string) => {
    await supabase.rpc('mark_messages_as_read', {
      target_trip_id: tripId,
      target_user_id: currentUser?.id,
      last_msg_id: messageId
    });
  };

  const setupRealtime = () => {
    const channel = supabase.channel(`chat:${tripId}`, {
      config: { presence: { key: currentUser?.id } }
    });

    channel
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}`
      }, async (payload) => {
        const { data } = await supabase
          .from('trip_messages')
          .select(`*, users:user_id (id, full_name, avatar_url)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => [...prev, data]);
          markAsRead(data.id);
          setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}`
      }, () => {
        fetchMembers();
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: string[] = [];
        Object.keys(state).forEach(key => {
          const userState: any = state[key][0];
          if (userState.isTyping && key !== currentUser?.id) {
            typing.push(userState.userName || 'Someone');
          }
        });
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userName: (currentUser as any)?.full_name || 'User', isTyping: false });
        }
      });

    channelRef.current = channel;
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    channelRef.current?.track({ userName: (currentUser as any)?.full_name || 'User', isTyping: text.length > 0 });
  };

  const sendMessage = async (imageUrl?: string) => {
    if ((!inputText.trim() && !imageUrl) || !currentUser) return;
    setSending(true);
    try {
      const { error } = await supabase.from('trip_messages').insert({
        trip_id: tripId,
        user_id: currentUser.id,
        content: inputText.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;
      setInputText('');
      handleTyping('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!res.canceled && res.assets?.[0].uri) {
      setSending(true);
      const url = await uploadImage('chat-images', `${tripId}/${Date.now()}.jpg`, res.assets[0].uri);
      if (url) sendMessage(url);
      else setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip Chat</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Trip Chat</Text>
            {typingUsers.length > 0 && (
              <Text style={styles.typingIndicator}>
                {typingUsers.join(', ')} typing...
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/trip-members/${tripId}` as any)}
            style={styles.backBtn}
          >
            <Ionicons name="people-outline" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Start the conversation with your trip members!
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const seenBy = members.filter(
                m => m.last_read_message_id === item.id && m.user_id !== item.user_id
              );
              return (
                <MessageItem
                  message={item}
                  seenBy={seenBy}
                  isLast={index === messages.length - 1}
                />
              );
            }}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.attachBtn}>
            <Ionicons name="image-outline" size={24} color="#9CA3AF" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            disabled={!inputText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Ionicons name="send" size={20} color="#FFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },
  typingIndicator: {
    color: '#8CC63F',
    fontSize: 11,
    marginTop: 1,
  },
  messageList: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
    backgroundColor: '#080C14',
  },
  attachBtn: {
    padding: 8,
    marginBottom: 2,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: 'white',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    backgroundColor: '#8CC63F',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(140,198,63,0.3)',
  },
});
