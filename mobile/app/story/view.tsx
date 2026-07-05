import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Animated,
  Dimensions, TextInput, Alert, KeyboardAvoidingView, Platform, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const REPORT_REASONS = ['Nudity or sexual content', 'Harassment or bullying', 'Hate speech', 'Spam or scam', 'Other'];

interface StoryItem {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  duration_seconds: number;
  created_at: string;
  user_id: string;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
}

function StoryVideo({ uri, onEnd }: { uri: string; onEnd: () => void }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);
  return <VideoView player={player} style={styles.media} contentFit="cover" nativeControls={false} />;
}

export default function StoryViewScreen() {
  const params = useLocalSearchParams<{ userId: string; name?: string; avatar?: string }>();
  const { user } = useAuthStore();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportVisible, setReportVisible] = useState(false);
  const [reply, setReply] = useState('');
  const progressAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('stories_24h')
        .select('id, media_url, media_type, caption, duration_seconds, created_at, user_id')
        .eq('user_id', params.userId)
        .eq('is_hidden', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (active) {
        setStories(data || []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [params.userId]);

  const current = stories[index];

  // Log a view + advance progress bar for the active story
  useEffect(() => {
    if (!current || !user?.id) return;

    supabase.from('story_views').insert({ story_id: current.id, viewer_id: user.id }).then(() => {});

    progressAnim.setValue(0);
    if (current.media_type === 'video') return; // video advances via onEnd

    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: (current.duration_seconds || 5) * 1000,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => { if (finished) goNext(); });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, user?.id]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= stories.length) {
        router.back();
        return i;
      }
      return i + 1;
    });
  }, [stories.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) {
          router.back();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const sendReaction = async (emoji: string) => {
    if (!current || !user?.id) return;
    await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: current.user_id,
      content: `${emoji} Reacted to your story`,
    });
  };

  const sendReply = async () => {
    if (!reply.trim() || !current || !user?.id) return;
    const text = reply.trim();
    setReply('');
    try {
      await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: current.user_id,
        content: text,
      });
      Alert.alert('Sent', 'Your reply was sent as a message.');
    } catch {
      Alert.alert('Error', 'Could not send reply.');
    }
  };

  const submitReport = async (reason: string) => {
    setReportVisible(false);
    if (!current || !user?.id) return;
    try {
      const { error } = await supabase.from('content_reports').insert({
        reporter_id: user.id,
        content_type: 'story',
        content_id: current.id,
        reason,
      });
      if (error && error.code !== '23505') throw error;
      Alert.alert('Thanks for reporting', "We'll review this soon.");
    } catch {
      Alert.alert('Error', 'Could not submit report.');
    }
  };

  const deleteStory = () => {
    if (!current) return;
    Alert.alert('Delete Story', 'This story will be removed immediately. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('stories_24h').delete().eq('id', current.id);
            if (error) throw error;
            setStories((prev) => {
              const next = prev.filter((s) => s.id !== current.id);
              if (next.length === 0) router.back();
              return next;
            });
          } catch {
            Alert.alert('Error', 'Could not delete story.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.overlay} />;
  }

  if (!current) {
    return (
      <View style={[styles.overlay, styles.center]}>
        <Text style={styles.emptyText}>No active stories</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeFallback}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Progress bars */}
        <View style={styles.progressRow}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  i < index && { width: '100%' },
                  i === index && {
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <Image
            source={{ uri: params.avatar || `https://ui-avatars.com/api/?name=${params.name || 'U'}` }}
            style={styles.avatar}
          />
          <Text style={styles.userName} numberOfLines={1}>{params.name || 'Traveler'}</Text>
          <Text style={styles.timer}>· {timeAgo(current.created_at)}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => Alert.alert('Story Options', undefined,
              current.user_id === user?.id
                ? [
                    { text: 'Delete', style: 'destructive', onPress: deleteStory },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                : [
                    { text: 'Report', onPress: () => setReportVisible(true) },
                    { text: 'Cancel', style: 'cancel' },
                  ]
            )}
            style={styles.iconBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Media */}
        <View style={styles.mediaWrap}>
          {current.media_type === 'video' ? (
            <StoryVideo uri={current.media_url} onEnd={goNext} />
          ) : (
            <Image source={{ uri: current.media_url }} style={styles.media} resizeMode="cover" />
          )}

          {/* Tap zones */}
          <TouchableOpacity style={styles.tapLeft} onPress={goPrev} activeOpacity={1} />
          <TouchableOpacity style={styles.tapRight} onPress={goNext} activeOpacity={1} />

          {current.caption ? (
            <Text style={styles.caption}>{current.caption}</Text>
          ) : null}
        </View>

        {/* Reply + reaction */}
        {current.user_id !== user?.id && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              placeholder="Reply..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={reply}
              onChangeText={setReply}
              onSubmitEditing={sendReply}
            />
            <TouchableOpacity onPress={() => sendReaction('❤️')} style={styles.iconBtn}>
              <Ionicons name="heart-outline" size={26} color="#FFF" />
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      {reportVisible && (
        <View style={styles.reportSheet}>
          <Text style={styles.reportTitle}>Report Story</Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity key={reason} style={styles.reportRow} onPress={() => submitReport(reason)}>
              <Text style={styles.reportRowText}>{reason}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.reportCancel} onPress={() => setReportVisible(false)}>
            <Text style={styles.reportCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: '#FFF', fontSize: 16 },
  closeFallback: { padding: 12 },
  safe: { flex: 1 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingTop: 6 },
  progressTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFF' },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 13.5, maxWidth: 140 },
  timer: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  iconBtn: { padding: 6 },
  mediaWrap: { flex: 1, position: 'relative' },
  media: { width: '100%', height: '100%' },
  tapLeft: { position: 'absolute', left: 0, top: 0, bottom: 80, width: SCREEN_W * 0.3 },
  tapRight: { position: 'absolute', right: 0, top: 0, bottom: 80, width: SCREEN_W * 0.7 },
  caption: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  replyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  replyInput: {
    flex: 1, color: '#FFF', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  reportSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  reportTitle: { color: '#FFF', fontWeight: '800', fontSize: 16, marginBottom: 12 },
  reportRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  reportRowText: { color: '#FFF', fontSize: 14.5 },
  reportCancel: { paddingVertical: 14, alignItems: 'center' },
  reportCancelText: { color: '#8CC63F', fontWeight: '700', fontSize: 14.5 },
});
