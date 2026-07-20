import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadImage, uploadMedia } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { moderationAgent } from '@/lib/moderation';
import { AppColors, Radius, Spacing } from '@/constants/theme';

const MAX_IMAGES = 5;
const MAX_REEL_SECONDS = 60;

const ACTIVITY_TYPES = [
  'Trek', 'Bike Ride', 'Camping', 'Waterfall', 'Road Trip', 'Off-road',
  'Backpacking', 'Sunrise', 'Sunset', 'Wildlife', 'Expedition',
  'Travel Tips', 'Packing Tips', 'Hidden Places', 'Other',
];

type Mode = 'photo' | 'reel';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function ReelPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} style={styles.reelPreview} contentFit="cover" nativeControls={false} />;
}

interface TripOption { id: string; title: string; destination: string }

export default function CreatePostScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ focus?: string; mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'reel' ? 'reel' : 'photo');

  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(params.focus === 'location');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Adventure metadata (Reel mode) — location reuses the field above.
  // Activity Type and Trip Link are real (posts.tags, posts.trip_id).
  // Difficulty/Season/Guide/Homestay/Rental have no backing column yet —
  // see the "more options coming soon" note instead of fake pickers.
  const [showAdventureDetails, setShowAdventureDetails] = useState(false);
  const [activityType, setActivityType] = useState<string | null>(null);
  const [linkedTripId, setLinkedTripId] = useState<string | null>(null);
  const [myTrips, setMyTrips] = useState<TripOption[]>([]);

  useEffect(() => {
    if (mode !== 'reel' || !user?.id) return;
    supabase
      .from('trips')
      .select('id, title, destination')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setMyTrips(data || []));
  }, [mode, user?.id]);

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

  // Same picker call Stories already uses for video (mediaTypes: videos,
  // videoMaxDuration caps camera recording). Library-picked clips longer
  // than the cap are rejected explicitly rather than silently truncated —
  // uploading the full file just to play 60s of it would waste storage.
  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoMaxDuration: MAX_REEL_SECONDS,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.duration && Math.round(asset.duration / 1000) > MAX_REEL_SECONDS) {
        Alert.alert('Video too long', `Reels can be up to ${MAX_REEL_SECONDS} seconds. Please choose a shorter clip.`);
        return;
      }
      setVideoUri(asset.uri);
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const handlePost = async () => {
    if (mode === 'reel') {
      if (!videoUri) {
        Alert.alert('No video selected', 'Choose a video to share your reel.');
        return;
      }
    } else if (!content.trim() && images.length === 0 && !extractYouTubeId(youtubeUrl)) {
      Alert.alert('Empty post', 'Please add some text, a photo, or a YouTube link to share your story.');
      return;
    }

    setPosting(true);
    try {
      // 1. Text safety + promo check — same gate for every post type
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

      const postPayload: Record<string, any> = {
        user_id: user?.id,
        content: content.trim(),
        location: location.trim() || null,
        visibility: 'public',
      };

      if (mode === 'reel') {
        setUploading(true);
        const path = `${user?.id}/reel-${Date.now()}.mp4`;
        const url = await uploadMedia('feed-posts', path, videoUri!, 'video/mp4');
        setUploading(false);
        if (!url) {
          Alert.alert('Error', 'Could not upload your reel. Please try again.');
          return;
        }
        postPayload.media = [url];
        postPayload.post_type = 'reel';
        if (activityType) postPayload.tags = [activityType];
        if (linkedTripId) postPayload.trip_id = linkedTripId;
      } else {
        // Image moderation disabled for now (Gemini quota exhausted, no OpenAI fallback configured)
        if (images.length > 0) setUploading(true);

        // Upload images sequentially — keeps upload order stable for the carousel
        const imageUrls: string[] = [];
        for (const uri of images) {
          const path = `${user?.id}/${Date.now()}-${imageUrls.length}.jpg`;
          const url = await uploadImage('feed-posts', path, uri);
          if (url) imageUrls.push(url);
        }
        setUploading(false);

        postPayload.media = imageUrls;
        const ytId = extractYouTubeId(youtubeUrl);
        if (ytId) postPayload.youtube_url = youtubeUrl.trim();
      }

      const { error } = await supabase.from('posts').insert(postPayload);

      if (error) throw error;
      router.replace('/(tabs)/explore');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', `Failed to create your ${mode === 'reel' ? 'reel' : 'post'}.`);
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'))}><Ionicons name="close" size={28} color={AppColors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'reel' ? 'Create Reel' : 'Create Post'}</Text>
        <TouchableOpacity onPress={handlePost} disabled={posting || uploading}>
          {posting ? <ActivityIndicator size="small" color={AppColors.primary} /> : (
            <Text style={[styles.postBtnText, { opacity: uploading ? 0.5 : 1 }]}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Mode switch */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'photo' && styles.modeBtnActive]}
          onPress={() => setMode('photo')}
        >
          <Ionicons name="image-outline" size={16} color={mode === 'photo' ? AppColors.background : AppColors.subtext} />
          <Text style={[styles.modeBtnText, mode === 'photo' && styles.modeBtnTextActive]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'reel' && styles.modeBtnActive]}
          onPress={() => setMode('reel')}
        >
          <Ionicons name="videocam-outline" size={16} color={mode === 'reel' ? AppColors.background : AppColors.subtext} />
          <Text style={[styles.modeBtnText, mode === 'reel' && styles.modeBtnTextActive]}>Reel</Text>
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
          placeholder={mode === 'reel' ? 'Write a caption for your reel...' : "What's happening on your trip?"}
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

        {mode === 'reel' ? (
          <>
            {videoUri ? (
              <View style={styles.reelPreviewWrap}>
                <ReelPreview uri={videoUri} />
                {uploading && (
                  <View style={styles.reelProcessingOverlay}>
                    <ActivityIndicator size="large" color="#FFF" />
                    <Text style={styles.reelProcessingText}>Uploading reel…</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.removeImg} onPress={() => setVideoUri(null)} disabled={uploading}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.videoPicker} onPress={pickVideo}>
                <Ionicons name="videocam-outline" size={32} color={AppColors.primary} />
                <Text style={styles.videoPickerText}>Choose a video</Text>
                <Text style={styles.videoPickerSub}>Vertical video, up to {MAX_REEL_SECONDS}s</Text>
              </TouchableOpacity>
            )}

            {/* Adventure metadata — optional, collapsible */}
            <TouchableOpacity style={styles.adventureToggle} onPress={() => setShowAdventureDetails((s) => !s)}>
              <Ionicons name="trail-sign-outline" size={16} color={AppColors.primary} />
              <Text style={styles.adventureToggleText}>Adventure details (optional)</Text>
              <Ionicons name={showAdventureDetails ? 'chevron-up' : 'chevron-down'} size={16} color={AppColors.subtext} />
            </TouchableOpacity>

            {showAdventureDetails && (
              <View style={styles.adventureSection}>
                {!showLocationInput && (
                  <TouchableOpacity style={styles.addMedia} onPress={() => setShowLocationInput(true)}>
                    <Ionicons name="location-outline" size={18} color={AppColors.primary} />
                    <Text style={styles.addMediaText}>Add location</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.fieldLabel}>Activity Type</Text>
                <View style={styles.chipWrap}>
                  {ACTIVITY_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.chip, activityType === type && styles.chipActive]}
                      onPress={() => setActivityType(activityType === type ? null : type)}
                    >
                      <Text style={[styles.chipText, activityType === type && styles.chipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {myTrips.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>Link a Trip</Text>
                    <View style={styles.chipWrap}>
                      {myTrips.map((trip) => (
                        <TouchableOpacity
                          key={trip.id}
                          style={[styles.chip, linkedTripId === trip.id && styles.chipActive]}
                          onPress={() => setLinkedTripId(linkedTripId === trip.id ? null : trip.id)}
                        >
                          <Text style={[styles.chipText, linkedTripId === trip.id && styles.chipTextActive]} numberOfLines={1}>
                            {trip.title || trip.destination}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <Text style={styles.moreComingSoon}>
                  Difficulty, Season, Guide, Homestay and Rental links are coming soon.
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: AppColors.border },
  headerTitle: { fontSize: 18, fontWeight: '800', color: AppColors.text },
  postBtnText: { color: AppColors.primary, fontWeight: '800', fontSize: 15 },
  modeRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: AppColors.card, borderWidth: 1, borderColor: AppColors.border,
  },
  modeBtnActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  modeBtnText: { color: AppColors.subtext, fontWeight: '700', fontSize: 13 },
  modeBtnTextActive: { color: AppColors.background },
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

  videoPicker: {
    marginTop: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: AppColors.primary,
    backgroundColor: 'rgba(140,198,63,0.05)', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl * 1.5, gap: 6,
  },
  videoPickerText: { color: AppColors.primary, fontWeight: '700', fontSize: 15 },
  videoPickerSub: { color: AppColors.subtext, fontSize: 12 },
  reelPreviewWrap: { position: 'relative', marginTop: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  reelPreview: { width: '100%', height: 420, backgroundColor: '#000' },
  reelProcessingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  reelProcessingText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  adventureToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: Spacing.lg, paddingVertical: Spacing.sm,
  },
  adventureToggleText: { flex: 1, color: AppColors.primary, fontWeight: '700', fontSize: 13.5 },
  adventureSection: { gap: Spacing.md, paddingBottom: Spacing.lg },
  fieldLabel: { color: AppColors.subtext, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.pill,
    backgroundColor: AppColors.card, borderWidth: 1, borderColor: AppColors.border, maxWidth: 180,
  },
  chipActive: { backgroundColor: 'rgba(140,198,63,0.16)', borderColor: AppColors.primary },
  chipText: { color: AppColors.subtext, fontSize: 12.5, fontWeight: '600' },
  chipTextActive: { color: AppColors.primary },
  moreComingSoon: { color: AppColors.subtext, fontSize: 11.5, fontStyle: 'italic', marginTop: Spacing.xs },
});
