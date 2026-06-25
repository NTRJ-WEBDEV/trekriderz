import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { uploadImage } from '@/lib/storage';
import { haptic } from '@/lib/haptics';

const ACCENT = '#EC4899';
const BG = '#080C14';

const TAGS = [
  'Trek', 'Bike Ride', 'Road Trip', 'Wildlife', 'Spiritual',
  'Weekend Getaway', 'Photography', 'Backpacking', 'Snow Trek', 'Pilgrimage',
];

const VISIBILITY_OPTIONS = [
  { id: 'public', label: 'Public', icon: 'earth-outline' as const },
  { id: 'friends', label: 'Friends', icon: 'people-outline' as const },
  { id: 'private', label: 'Private', icon: 'lock-closed-outline' as const },
];

export default function CreateStoryScreen() {
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState('public');
  const [photos, setPhotos] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingText, setUploadingText] = useState('');

  const MAX_PHOTOS = 5;

  const toggleTag = (tag: string) => {
    haptic.light();
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add story images.');
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: remaining,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    haptic.light();
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your story a headline.');
      return;
    }
    if (!content.trim() || content.trim().length < 50) {
      Alert.alert('Story too short', 'Write at least 50 characters so readers can enjoy your story.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Cover photo required', 'Add at least one photo to your story.');
      return;
    }
    if (!user?.id) { Alert.alert('Not logged in'); return; }

    setLoading(true);

    try {
      // Upload photos
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setUploadingText(`Uploading photo ${i + 1} of ${photos.length}…`);
        const ext = photos[i].split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${user.id}/${Date.now()}_story_${i}.${ext}`;
        const url = await uploadImage('posts', path, photos[i]);
        if (url) uploadedUrls.push(url);
      }

      setUploadingText('Publishing story…');

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        post_type: 'trip_story',
        title: title.trim(),
        content: content.trim(),
        media: uploadedUrls,
        location: location.trim() || null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        visibility,
      });

      if (error) throw error;

      haptic.success();
      Alert.alert(
        'Story Published! 🎉',
        'Your journey is now live for the TrekRiderz community.',
        [{ text: 'View Stories', onPress: () => router.replace('/stories' as any) }],
      );
    } catch (err: any) {
      Alert.alert('Failed to publish', err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
      setUploadingText('');
    }
  };

  const coverPhoto = photos[0];
  const canAddMore = photos.length < MAX_PHOTOS;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} disabled={loading}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Write a Story</Text>
          <TouchableOpacity
            style={[styles.publishBtn, (!title.trim() || !content.trim() || loading) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={!title.trim() || !content.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.publishBtnText}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Photo */}
        <TouchableOpacity
          style={[styles.coverPickArea, coverPhoto && styles.coverPickAreaFilled]}
          onPress={!coverPhoto ? pickPhotos : undefined}
          activeOpacity={coverPhoto ? 1 : 0.8}
        >
          {coverPhoto ? (
            <>
              <Image source={{ uri: coverPhoto }} style={styles.coverPreview} contentFit="cover" />
              <View style={styles.coverOverlay} />
              <View style={styles.coverControls}>
                <TouchableOpacity style={styles.coverActionBtn} onPress={pickPhotos} disabled={!canAddMore}>
                  <Ionicons name="add-circle" size={18} color="#FFF" />
                  <Text style={styles.coverActionText}>Add more</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.coverActionBtn} onPress={() => removePhoto(0)}>
                  <Ionicons name="trash-outline" size={18} color="#FFF" />
                  <Text style={styles.coverActionText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.coverPickInner}>
              <View style={styles.coverPickIcon}>
                <Ionicons name="camera-outline" size={32} color={ACCENT} />
              </View>
              <Text style={styles.coverPickLabel}>Add Cover Photo</Text>
              <Text style={styles.coverPickHint}>Required · Tap to choose from gallery</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Additional photo thumbnails */}
        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
            {photos.slice(1).map((uri, i) => (
              <TouchableOpacity key={i} onPress={() => setPreviewIndex(i + 1)} style={styles.thumb}>
                <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removePhoto(i + 1)}>
                  <Ionicons name="close-circle" size={18} color="#FFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {canAddMore && (
              <TouchableOpacity style={styles.thumbAdd} onPress={pickPhotos}>
                <Ionicons name="add" size={22} color={ACCENT} />
                <Text style={styles.thumbAddText}>{MAX_PHOTOS - photos.length} left</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        {photos.length === 1 && canAddMore && (
          <TouchableOpacity style={styles.addMoreRow} onPress={pickPhotos}>
            <Ionicons name="images-outline" size={16} color={ACCENT} />
            <Text style={styles.addMoreText}>Add more photos ({MAX_PHOTOS - 1} remaining)</Text>
          </TouchableOpacity>
        )}

        <View style={styles.form}>
          {/* Title */}
          <TextInput
            style={styles.titleInput}
            placeholder="Your story headline…"
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={title}
            onChangeText={setTitle}
            multiline
            maxLength={120}
          />

          {/* Location */}
          <View style={styles.fieldRow}>
            <Ionicons name="location-outline" size={16} color={ACCENT} />
            <TextInput
              style={styles.fieldInput}
              placeholder="Destination / Location"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* Tags */}
          <Text style={styles.fieldLabel}>Tags</Text>
          <View style={styles.tagsWrap}>
            {TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Visibility */}
          <Text style={styles.fieldLabel}>Who can see this</Text>
          <View style={styles.visibilityRow}>
            {VISIBILITY_OPTIONS.map((opt) => {
              const active = visibility === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.visOption, active && styles.visOptionActive]}
                  onPress={() => setVisibility(opt.id)}
                >
                  <Ionicons name={opt.icon} size={15} color={active ? ACCENT : 'rgba(255,255,255,0.35)'} />
                  <Text style={[styles.visOptionText, active && styles.visOptionTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Story content */}
          <Text style={styles.fieldLabel}>Your Story</Text>
          <TextInput
            style={styles.contentInput}
            placeholder={`Share your experience in detail…\n\nWhat made this journey special? Describe the places, people, and moments that stayed with you.`}
            placeholderTextColor="rgba(255,255,255,0.22)"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{content.length} chars · {Math.max(1, Math.round(content.trim().split(/\s+/).length / 200))} min read</Text>

          {/* Upload progress text */}
          {uploadingText ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.uploadingText}>{uploadingText}</Text>
            </View>
          ) : null}

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Full-screen preview modal */}
      <Modal visible={previewIndex !== null} transparent animationType="fade">
        <Pressable style={styles.previewModal} onPress={() => setPreviewIndex(null)}>
          {previewIndex !== null && (
            <Image
              source={{ uri: photos[previewIndex] }}
              style={styles.previewFull}
              contentFit="contain"
            />
          )}
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewIndex(null)}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  cancelBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  publishBtn: {
    backgroundColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 9,
    minWidth: 80, alignItems: 'center',
  },
  publishBtnDisabled: { opacity: 0.4 },
  publishBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  coverPickArea: {
    height: 220, margin: 16, borderRadius: 18,
    borderWidth: 2, borderStyle: 'dashed', borderColor: ACCENT + '55',
    overflow: 'hidden',
    backgroundColor: ACCENT + '08',
    alignItems: 'center', justifyContent: 'center',
  },
  coverPickAreaFilled: { borderStyle: 'solid', borderColor: 'transparent', margin: 0 },
  coverPreview: { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,12,20,0.45)',
  },
  coverControls: {
    position: 'absolute', bottom: 16, right: 16,
    flexDirection: 'row', gap: 10,
  },
  coverActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  coverActionText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  coverPickInner: { alignItems: 'center', gap: 8 },
  coverPickIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: ACCENT + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  coverPickLabel: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  coverPickHint: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },

  thumbRow: { paddingHorizontal: 16, paddingVertical: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12, overflow: 'visible' },
  thumbImg: { width: 72, height: 72, borderRadius: 12 },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  thumbAdd: {
    width: 72, height: 72, borderRadius: 12,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: ACCENT + '55',
    backgroundColor: ACCENT + '08',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  thumbAddText: { fontSize: 9, color: ACCENT, fontWeight: '700' },

  addMoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
  },
  addMoreText: { fontSize: 13, color: ACCENT, fontWeight: '600' },

  form: { paddingHorizontal: 16, paddingTop: 8, gap: 6 },

  titleInput: {
    fontSize: 22, fontWeight: '900', color: '#FFF',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12, minHeight: 56,
    lineHeight: 30,
  },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 8,
  },
  fieldInput: { flex: 1, fontSize: 14, color: '#FFF' },

  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1, textTransform: 'uppercase', marginTop: 18, marginBottom: 8,
  },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tagChipActive: { borderColor: ACCENT, backgroundColor: ACCENT + '18' },
  tagChipText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  tagChipTextActive: { color: ACCENT },

  visibilityRow: { flexDirection: 'row', gap: 8 },
  visOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  visOptionActive: { borderColor: ACCENT, backgroundColor: ACCENT + '15' },
  visOptionText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)' },
  visOptionTextActive: { color: ACCENT },

  contentInput: {
    minHeight: 260, fontSize: 15, color: 'rgba(255,255,255,0.85)',
    lineHeight: 24, paddingTop: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  charCount: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)',
    textAlign: 'right', marginTop: 4,
  },

  uploadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12,
    backgroundColor: ACCENT + '12', borderRadius: 10,
  },
  uploadingText: { fontSize: 13, color: ACCENT, fontWeight: '600' },

  previewModal: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewFull: { width: '100%', height: '80%' },
  previewClose: {
    position: 'absolute', top: 52, right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
