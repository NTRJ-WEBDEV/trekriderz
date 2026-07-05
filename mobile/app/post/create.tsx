import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { moderationAgent } from '@/lib/moderation';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function CreatePostScreen() {
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !image) {
      Alert.alert('Empty post', 'Please add some text or an image to share your story.');
      return;
    }

    setPosting(true);
    try {
      // 1. Text safety + promo check
      if (content.trim()) {
        const textResult = await moderationAgent.inspectText(content, user?.id!, 'post');
        if (!textResult.safe) {
          Alert.alert(
            textResult.severity === 'flag' ? 'Account Flagged' : 'Content Not Allowed',
            textResult.message,
          );
          if (textResult.severity !== 'flag') return;
          router.replace('/(tabs)');
          return;
        }
      }

      // 2. Image safety check (before upload — don't waste storage)
      if (image) {
        setUploading(true);
        const imgResult = await moderationAgent.inspectImage(image, user?.id!);
        if (!imgResult.safe) {
          setUploading(false);
          Alert.alert(
            imgResult.severity === 'flag' ? 'Account Flagged' : 'Image Not Allowed',
            imgResult.message,
          );
          if (imgResult.severity !== 'flag') return;
          router.replace('/(tabs)');
          return;
        }
      }

      // 3. Upload image
      let imageUrl = null;
      if (image) {
        const path = `${user?.id}/${Date.now()}.jpg`;
        imageUrl = await uploadImage('posts', path, image);
        setUploading(false);
      }

      const ytId = extractYouTubeId(youtubeUrl);
      const postPayload: Record<string, any> = {
        user_id: user?.id,
        content: content.trim(),
        media: imageUrl ? [imageUrl] : [],
        visibility: 'public',
      };
      if (ytId) postPayload.youtube_url = youtubeUrl.trim();

      const { error } = await supabase.from('posts').insert(postPayload);

      if (error) throw error;
      router.replace('/(tabs)');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create your post.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#FFF" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity onPress={handlePost} disabled={posting || uploading} style={[styles.postBtn, (posting || uploading) && { opacity: 0.5 }]}>
          {posting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.userRow}>
          <Image 
            source={{ uri: user?.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=' + user?.user_metadata?.full_name }} 
            style={styles.avatar} 
          />
          <Text style={styles.userName}>{user?.user_metadata?.full_name}</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="What's happening on your trip?"
          placeholderTextColor="#6B7280"
          multiline
          autoFocus
          value={content}
          onChangeText={setContent}
        />

        {image && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: image }} style={styles.previewImage} resizeMode="contain" />
            <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* YouTube preview */}
        {extractYouTubeId(youtubeUrl) && (
          <View style={styles.ytPreview}>
            <Image
              source={{ uri: `https://img.youtube.com/vi/${extractYouTubeId(youtubeUrl)}/hqdefault.jpg` }}
              style={styles.ytThumb}
              resizeMode="cover"
            />
            <View style={styles.ytPlayOverlay}>
              <Ionicons name="logo-youtube" size={40} color="#FF0000" />
            </View>
            <TouchableOpacity style={styles.removeImg} onPress={() => setYoutubeUrl('')}>
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.toolRow}>
          <TouchableOpacity style={styles.addMedia} onPress={pickImage}>
            <Ionicons name="image-outline" size={22} color="#8CC63F" />
            <Text style={styles.addMediaText}>Photo</Text>
          </TouchableOpacity>

          <View style={styles.ytInput}>
            <Ionicons name="logo-youtube" size={20} color="#FF0000" />
            <TextInput
              style={styles.ytUrlInput}
              placeholder="Paste YouTube link..."
              placeholderTextColor="#6B7280"
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
            {youtubeUrl.length > 0 && (
              <TouchableOpacity onPress={() => setYoutubeUrl('')}>
                <Ionicons name="close-circle" size={18} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  postBtn: { backgroundColor: '#8CC63F', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  postBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  content: { padding: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  userName: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  input: { color: '#FFF', fontSize: 18, lineHeight: 28, textAlignVertical: 'top', minHeight: 150 },
  imageWrapper: { position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', marginVertical: 12, backgroundColor: '#000', minHeight: 180 },
  previewImage: { width: '100%', aspectRatio: undefined, minHeight: 180, maxHeight: 400 },
  removeImg: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12 },
  ytPreview: { position: 'relative', width: '100%', height: 190, borderRadius: 14, overflow: 'hidden', marginVertical: 12 },
  ytThumb: { width: '100%', height: '100%' },
  ytPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  toolRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
  addMedia: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#8CC63F', backgroundColor: 'rgba(140,198,63,0.05)' },
  addMediaText: { color: '#8CC63F', fontWeight: '700', fontSize: 14 },
  ytInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,0,0,0.2)' },
  ytUrlInput: { flex: 1, color: '#FFF', fontSize: 13 },
});
