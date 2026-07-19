import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { moderationAgent } from '@/lib/moderation';
import { AppColors, Radius, Spacing } from '@/constants/theme';

const MAX_IMAGES = 5;

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function CreatePostScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(params.focus === 'location');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const handlePost = async () => {
    if (!content.trim() && images.length === 0 && !extractYouTubeId(youtubeUrl)) {
      Alert.alert('Empty post', 'Please add some text, a photo, or a YouTube link to share your story.');
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
          router.replace('/(tabs)/explore');
          return;
        }
      }

      // Image moderation disabled for now (Gemini quota exhausted, no OpenAI fallback configured)
      if (images.length > 0) {
        setUploading(true);
      }

      // 3. Upload images (sequential — keeps upload order stable for the carousel)
      const imageUrls: string[] = [];
      for (const uri of images) {
        const path = `${user?.id}/${Date.now()}-${imageUrls.length}.jpg`;
        const url = await uploadImage('feed-posts', path, uri);
        if (url) imageUrls.push(url);
      }
      setUploading(false);

      const ytId = extractYouTubeId(youtubeUrl);
      const postPayload: Record<string, any> = {
        user_id: user?.id,
        content: content.trim(),
        media: imageUrls,
        location: location.trim() || null,
        visibility: 'public',
      };
      if (ytId) postPayload.youtube_url = youtubeUrl.trim();

      const { error } = await supabase.from('posts').insert(postPayload);

      if (error) throw error;
      router.replace('/(tabs)/explore');
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'))}><Ionicons name="close" size={28} color={AppColors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity onPress={handlePost} disabled={posting || uploading}>
          {posting ? <ActivityIndicator size="small" color={AppColors.primary} /> : (
            <Text style={[styles.postBtnText, { opacity: uploading ? 0.5 : 1 }]}>Post</Text>
          )}
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
          placeholderTextColor={AppColors.subtext}
          multiline
          autoFocus={params.focus !== 'location'}
          value={content}
          onChangeText={setContent}
        />

        {showLocationInput && (
          <View style={styles.locationField}>
            <Ionicons name="location-sharp" size={16} color={AppColors.primary} />
            <TextInput
              style={styles.locationInput}
              placeholder="Add location…"
              placeholderTextColor={AppColors.subtext}
              value={location}
              onChangeText={setLocation}
              autoFocus={params.focus === 'location'}
            />
            {location.length > 0 && (
              <TouchableOpacity onPress={() => setLocation('')}>
                <Ionicons name="close-circle" size={18} color={AppColors.subtext} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageStrip}>
            {images.map((uri, i) => (
              <View key={uri + i} style={styles.imageThumbWrap}>
                <Image source={{ uri }} style={styles.imageThumb} />
                <TouchableOpacity style={styles.removeImg} onPress={() => removeImage(i)}>
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <TouchableOpacity style={styles.addMoreThumb} onPress={pickImages}>
                <Ionicons name="add" size={26} color={AppColors.primary} />
              </TouchableOpacity>
            )}
          </ScrollView>
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
          {images.length === 0 && (
            <TouchableOpacity style={styles.addMedia} onPress={pickImages}>
              <Ionicons name="image-outline" size={22} color={AppColors.primary} />
              <Text style={styles.addMediaText}>Photo</Text>
            </TouchableOpacity>
          )}
          {!showLocationInput && (
            <TouchableOpacity style={styles.addMedia} onPress={() => setShowLocationInput(true)}>
              <Ionicons name="location-outline" size={22} color={AppColors.primary} />
              <Text style={styles.addMediaText}>Location</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.ytInput}>
          <Ionicons name="logo-youtube" size={20} color="#FF0000" />
          <TextInput
            style={styles.ytUrlInput}
            placeholder="Paste YouTube link..."
            placeholderTextColor={AppColors.subtext}
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          {youtubeUrl.length > 0 && (
            <TouchableOpacity onPress={() => setYoutubeUrl('')}>
              <Ionicons name="close-circle" size={18} color={AppColors.subtext} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: AppColors.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: AppColors.text },
  postBtnText: { color: AppColors.primary, fontWeight: '800', fontSize: 15 },
  content: { padding: Spacing.xl },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: Spacing.md },
  userName: { color: AppColors.text, fontWeight: '700', fontSize: 16 },
  input: { color: AppColors.text, fontSize: 18, lineHeight: 28, textAlignVertical: 'top', minHeight: 120 },
  locationField: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: AppColors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: AppColors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.md,
  },
  locationInput: { flex: 1, color: AppColors.text, fontSize: 14 },
  imageStrip: { marginTop: Spacing.lg },
  imageThumbWrap: { position: 'relative', marginRight: Spacing.md },
  imageThumb: { width: 100, height: 130, borderRadius: Radius.md, backgroundColor: '#000' },
  addMoreThumb: {
    width: 100, height: 130, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: AppColors.primary, backgroundColor: 'rgba(140,198,63,0.05)',
  },
  removeImg: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12 },
  ytPreview: { position: 'relative', width: '100%', height: 190, borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.lg },
  ytThumb: { width: '100%', height: '100%' },
  ytPlayOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  toolRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  addMedia: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: AppColors.primary, backgroundColor: 'rgba(140,198,63,0.05)' },
  addMediaText: { color: AppColors.primary, fontWeight: '700', fontSize: 14 },
  ytInput: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: AppColors.card, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: 'rgba(255,0,0,0.2)', marginTop: Spacing.lg },
  ytUrlInput: { flex: 1, color: AppColors.text, fontSize: 13 },
});
