import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadImage } from '@/lib/storage';
import { moderationAgent } from '@/lib/moderation';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

const VISIBILITY_OPTIONS = [
  { id: 'public', label: 'Public', icon: 'earth-outline' as const, desc: 'Anyone can see' },
  { id: 'friends', label: 'Friends', icon: 'people-outline' as const, desc: 'Only followers' },
  { id: 'private', label: 'Private', icon: 'lock-closed-outline' as const, desc: 'Only you' },
];

export default function CreatePostScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = {
    bg: '#080C14',
    text: '#fff',
    subtext: '#A0AEC0',
    border: 'rgba(255,255,255,0.08)',
    input: 'rgba(255,255,255,0.05)',
  };

  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, 10));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!content.trim() && images.length === 0 && !extractYouTubeId(youtubeUrl)) {
      Alert.alert('Empty Post', 'Please write something, add a photo, or add a YouTube link.');
      return;
    }

    setLoading(true);
    try {
      // 1. Text safety + promo check
      if (content.trim()) {
        const textResult = await moderationAgent.inspectText(content, user?.id!, 'post');
        if (!textResult.safe) {
          setLoading(false);
          Alert.alert(
            textResult.severity === 'flag' ? 'Account Flagged' : 'Content Not Allowed',
            textResult.message,
          );
          if (textResult.severity !== 'flag') return;
          router.replace('/(tabs)');
          return;
        }
      }

      // 2. Image safety check before upload
      for (const uri of images) {
        const imgResult = await moderationAgent.inspectImage(uri, user?.id!);
        if (!imgResult.safe) {
          setLoading(false);
          Alert.alert(
            imgResult.severity === 'flag' ? 'Account Flagged' : 'Image Not Allowed',
            imgResult.message,
          );
          if (imgResult.severity !== 'flag') return;
          router.replace('/(tabs)');
          return;
        }
      }

      // 3. Upload images
      const uploadedUrls: string[] = [];
      for (const uri of images) {
        const path = `${user?.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const url = await uploadImage('posts', path, uri);
        if (url) uploadedUrls.push(url);
      }

      // Create post
      const ytId = extractYouTubeId(youtubeUrl);
      const postPayload: Record<string, any> = {
        user_id: user?.id,
        content: content.trim(),
        media: uploadedUrls,
        location: location.trim() || null,
        visibility,
      };
      if (ytId) postPayload.youtube_url = youtubeUrl.trim();

      const { error: postError } = await supabase.from('posts').insert(postPayload);

      if (postError) throw postError;

      Alert.alert('Posted!', 'Your post is live.', [
        { text: 'View Feed', onPress: () => router.replace('/(tabs)/feed') },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancelBtn, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Post</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={loading}
          style={[styles.shareBtn, loading && styles.shareBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.shareBtnText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Text input */}
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder="What's on your trek today?"
          placeholderTextColor={colors.subtext}
          multiline
          value={content}
          onChangeText={setContent}
          autoFocus
        />

        {/* Image grid */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* YouTube link */}
        <View style={[styles.locationRow, { borderColor: 'rgba(255,0,0,0.25)', marginTop: 12 }]}>
          <Ionicons name="logo-youtube" size={18} color="#FF0000" />
          <TextInput
            style={[styles.locationInput, { color: colors.text }]}
            placeholder="Paste YouTube link (optional)"
            placeholderTextColor={colors.subtext}
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
          {youtubeUrl.length > 0 && (
            <TouchableOpacity onPress={() => setYoutubeUrl('')}>
              <Ionicons name="close-circle" size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
        </View>

        {/* YouTube thumbnail preview */}
        {extractYouTubeId(youtubeUrl) && (
          <TouchableOpacity
            style={styles.ytPreview}
            onPress={() => router.push({ pathname: '/watch-video', params: { url: youtubeUrl } })}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: `https://img.youtube.com/vi/${extractYouTubeId(youtubeUrl)}/hqdefault.jpg` }}
              style={styles.ytThumb}
              resizeMode="cover"
            />
            <View style={styles.ytPlayOverlay}>
              <Ionicons name="logo-youtube" size={44} color="#FF0000" />
            </View>
          </TouchableOpacity>
        )}

        {/* Location */}
        <View style={[styles.locationRow, { borderColor: colors.border }]}>
          <Ionicons name="location-outline" size={18} color="#8CC63F" />
          <TextInput
            style={[styles.locationInput, { color: colors.text }]}
            placeholder="Add location"
            placeholderTextColor={colors.subtext}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Visibility selector */}
        <Text style={[styles.sectionLabel, { color: colors.subtext }]}>Audience</Text>
        <View style={styles.visibilityRow}>
          {VISIBILITY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.visibilityBtn,
                { borderColor: colors.border },
                visibility === opt.id && styles.visibilityBtnActive,
              ]}
              onPress={() => setVisibility(opt.id)}
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={visibility === opt.id ? '#8CC63F' : colors.subtext}
              />
              <Text
                style={[
                  styles.visibilityLabel,
                  { color: visibility === opt.id ? '#8CC63F' : colors.subtext },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom toolbar */}
      <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={pickImages}>
          <Ionicons name="image-outline" size={24} color="#8CC63F" />
          <Text style={styles.toolbarBtnLabel}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn}>
          <Ionicons name="camera-outline" size={24} color="#8CC63F" />
          <Text style={styles.toolbarBtnLabel}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn}>
          <Ionicons name="trail-sign-outline" size={24} color="#8CC63F" />
          <Text style={styles.toolbarBtnLabel}>Route</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cancelBtn: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  shareBtn: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    padding: 16,
    flexGrow: 1,
  },
  textInput: {
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imageRow: {
    marginVertical: 12,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  ytPreview: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    backgroundColor: '#000',
  },
  ytThumb: { width: '100%', height: '100%' },
  ytPlayOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
    gap: 8,
  },
  locationInput: {
    flex: 1,
    fontSize: 15,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visibilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  visibilityBtnActive: {
    borderColor: '#8CC63F',
    backgroundColor: 'rgba(140,198,63,0.08)',
  },
  visibilityLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  toolbarBtnLabel: {
    color: '#8CC63F',
    fontSize: 11,
    fontWeight: '600',
  },
});
