import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { translateText } from '@/lib/translate';

export interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  created_at: string;
  users: {
    full_name: string;
    avatar_url?: string;
  };
}

interface MessageItemProps {
  message: ChatMessage;
  seenBy?: any[];
  isLast?: boolean;
}

export default function MessageItem({ message, seenBy, isLast }: MessageItemProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isMe = message.user_id === currentUser?.id;
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  const handleLongPress = () => {
    if (!message.content) return;
    Alert.alert(
      'Message Options',
      undefined,
      [
        {
          text: translatedContent ? 'Show Original' : 'Translate to English',
          onPress: async () => {
            if (translatedContent) {
              setTranslatedContent(null);
              return;
            }
            setTranslating(true);
            const result = await translateText(message.content);
            setTranslating(false);
            if (result) setTranslatedContent(result);
            else Alert.alert('Translation failed', 'Please check your connection and try again.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={[styles.container, isMe ? styles.myMessage : styles.theirMessage]}>
      {!isMe && (
        <Image
          source={message.users.avatar_url ? { uri: message.users.avatar_url } : require('@/assets/images/icon.png')}
          style={styles.avatar}
        />
      )}
      <View style={styles.messageContent}>
        {!isMe && <Text style={styles.senderName}>{message.users.full_name}</Text>}
        <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.85} delayLongPress={400}>
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
            {message.image_url && (
              <Image source={{ uri: message.image_url }} style={styles.messageImage} />
            )}
            {message.content ? (
              <>
                <Text style={[styles.text, isMe ? styles.myText : styles.theirText]}>
                  {translatedContent || message.content}
                </Text>
                {translatedContent && (
                  <View style={styles.translatedRow}>
                    <Ionicons name="language" size={10} color={isMe ? 'rgba(255,255,255,0.6)' : '#8CC63F'} />
                    <Text style={[styles.translatedLabel, isMe && styles.translatedLabelMe]}>
                      Translated
                    </Text>
                  </View>
                )}
              </>
            ) : null}
            {translating && (
              <ActivityIndicator size="small" color={isMe ? '#FFF' : '#8CC63F'} style={{ marginTop: 4 }} />
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.footer}>
          <Text style={[styles.time, isMe && styles.myTime]}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {seenBy && seenBy.length > 0 && (
            <View style={styles.seenContainer}>
              {seenBy.slice(0, 3).map((m, idx) => (
                <Image
                  key={idx}
                  source={m.users.avatar_url ? { uri: m.users.avatar_url } : require('@/assets/images/icon.png')}
                  style={styles.miniSeenAvatar}
                />
              ))}
              {seenBy.length > 3 && (
                <Text style={styles.plusSeen}>+{seenBy.length - 3}</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', marginBottom: 16, maxWidth: '85%' },
  myMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  theirMessage: { alignSelf: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, marginTop: 4 },
  messageContent: { flex: 1 },
  senderName: { fontSize: 12, color: '#9CA3AF', marginBottom: 4, marginLeft: 4 },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  myBubble: { backgroundColor: '#8CC63F', borderTopRightRadius: 4 },
  theirBubble: { backgroundColor: '#374151', borderTopLeftRadius: 4 },
  text: { fontSize: 15 },
  myText: { color: '#FFFFFF' },
  theirText: { color: '#F9FAFB' },
  messageImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 8 },
  translatedRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  translatedLabel: { fontSize: 10, color: '#8CC63F', fontStyle: 'italic' },
  translatedLabelMe: { color: 'rgba(255,255,255,0.65)' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  time: { fontSize: 10, color: '#9CA3AF', flex: 1 },
  myTime: { textAlign: 'right', marginRight: 4 },
  seenContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 6 },
  miniSeenAvatar: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#080C14', marginLeft: -4 },
  plusSeen: { fontSize: 8, color: '#9CA3AF', marginLeft: 2, fontWeight: 'bold' },
});
