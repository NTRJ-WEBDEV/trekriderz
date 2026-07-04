import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadMedia } from '@/lib/storage';
import { moderationAgent } from '@/lib/moderation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GREEN = '#8CC63F';
const MAX_VIDEO_SECONDS = 30;

type Picked = { uri: string; type: 'image' | 'video'; durationSeconds?: number };

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={styles.preview} contentFit="cover" nativeControls={false} />;
}

export default function StoryCreateScreen() {
  const { user } = useAuthStore();
  const [media, setMedia] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setMedia({
        uri: asset.uri,
        type: isVideo ? 'video' : 'image',
        durationSeconds: isVideo && asset.duration
          ? Math.min(MAX_VIDEO_SECONDS, Math.round(asset.duration / 1000))
          : undefined,
      });
    }
  };

  const handlePost = async () => {
    if (!media || !user?.id) return;

    setPosting(true);
    try {
      // Text (caption) moderation
      if (caption.trim()) {
        const textResult = await moderationAgent.inspectText(caption, user.id, 'post');
        if (!textResult.safe) {
          Alert.alert(textResult.severity === 'flag' ? 'Account Flagged' : 'Content Not Allowed', textResult.message);
          setPosting(false);
          return;
        }
      }

      // Image moderation (video frames aren't sent to the vision API — caption + reports cover video)
      if (media.type === 'image') {
        const imgResult = await moderationAgent.inspectImage(media.uri, user.id);
        if (!imgResult.safe) {
          Alert.alert(imgResult.severity === 'flag' ? 'Account Flagged' : 'Image Not Allowed', imgResult.message);
          setPosting(false);
          return;
        }
      }

      const ext = media.type === 'video' ? 'mp4' : 'jpg';
      const path = `stories/${user.id}/${Date.now()}.${ext}`;
      const contentType = media.type === 'video' ? 'video/mp4' : 'image/jpeg';
      const mediaUrl = await uploadMedia('posts', path, media.uri, contentType);

      if (!mediaUrl) throw new Error('Upload failed');

      const { error } = await supabase.from('stories_24h').insert({
        user_id: user.id,
        media_url: mediaUrl,
        media_type: media.type,
        caption: caption.trim() || null,
        duration_seconds: media.type === 'video' ? (media.durationSeconds || 15) : 5,
      });

      if (error) throw error;
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to post your story.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to Story</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={!media || posting}
          style={[styles.postBtn, (!media || posting) && { opacity: 0.4 }]}
        >
          {posting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>

      {media ? (
        <View style={styles.previewWrap}>
          {media.type === 'video' ? (
            <VideoPreview uri={media.uri} />
          ) : (
            <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="cover" />
          )}

          <TextInput
            style={styles.captionOverlay}
            placeholder="Add a caption..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={caption}
            onChangeText={setCaption}
            multiline
          />

          <TouchableOpacity style={styles.removeBtn} onPress={() => setMedia(null)}>
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.removeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.pickerBox} onPress={pickMedia}>
          <Ionicons name="images-outline" size={48} color={GREEN} />
          <Text style={styles.pickerText}>Choose a photo or video</Text>
          <Text style={styles.pickerSub}>Videos up to {MAX_VIDEO_SECONDS}s · disappears after 24h</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  postBtn: { backgroundColor: GREEN, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  pickerBox: {
    flex: 1, margin: 20, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: 'rgba(140,198,63,0.4)', backgroundColor: 'rgba(140,198,63,0.05)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  pickerText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  pickerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  previewWrap: { flex: 1, margin: 12, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  preview: { width: '100%', height: '100%' },
  captionOverlay: {
    position: 'absolute', left: 16, right: 16, bottom: 90,
    color: '#FFF', fontSize: 17, fontWeight: '600', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
  removeBtn: {
    position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
  },
  removeBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
});
