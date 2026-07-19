import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { AppColors } from '@/constants/theme';

const BG = AppColors.background;
const GREEN = AppColors.primary;

const CATEGORIES = [
  { id: 'trek', label: 'Trekking', emoji: '⛰️' },
  { id: 'wildlife', label: 'Wildlife', emoji: '🦁' },
  { id: 'spiritual', label: 'Spiritual', emoji: '🙏' },
  { id: 'backpacking', label: 'Backpacking', emoji: '🎒' },
  { id: 'photography', label: 'Photography', emoji: '📸' },
  { id: 'cycling', label: 'Cycling', emoji: '🚴' },
  { id: 'camping', label: 'Camping', emoji: '⛺' },
  { id: 'general', label: 'General', emoji: '🌍' },
];

export default function CreateCommunityScreen() {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('trek');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Community name is required.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          category,
          is_private: isPrivate,
          created_by: user?.id,
          member_count: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join creator as admin member
      await supabase.from('community_members').insert({
        community_id: data.id,
        user_id: user?.id,
        role: 'admin',
      });

      Alert.alert('Community Created!', `"${name}" is now live.`, [
        { text: 'Open', onPress: () => router.replace(`/community/${data.id}` as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create community.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Community</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={handleCreate}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Create</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={16} color={GREEN} />
          <Text style={styles.noticeText}>
            Only verified premium guides and admins can create communities.
          </Text>
        </View>

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Community Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Himalayan Trekkers, Kerala Nature Club"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
          <Text style={styles.charCount}>{name.length}/60</Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What is this community about? Who should join?"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={styles.charCount}>{description.length}/300</Text>
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, category === cat.id && styles.catChipActive]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, category === cat.id && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Private toggle */}
        <TouchableOpacity
          style={styles.toggle}
          onPress={() => setIsPrivate((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.toggleLeft}>
            <Ionicons
              name={isPrivate ? 'lock-closed-outline' : 'earth-outline'}
              size={22}
              color={GREEN}
            />
            <View>
              <Text style={styles.toggleTitle}>{isPrivate ? 'Private' : 'Public'}</Text>
              <Text style={styles.toggleDesc}>
                {isPrivate
                  ? 'Only invited members can join'
                  : 'Anyone can discover and join'}
              </Text>
            </View>
          </View>
          <View style={[styles.toggleSwitch, isPrivate && styles.toggleSwitchOn]}>
            <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  saveBtn: {
    backgroundColor: GREEN, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  content: { padding: 20, gap: 24 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)',
  },
  noticeText: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 },
  field: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: { minHeight: 100, paddingTop: 13 },
  charCount: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'right' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  catChipActive: { borderColor: GREEN, backgroundColor: 'rgba(140,198,63,0.12)' },
  catEmoji: { fontSize: 14 },
  catLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  catLabelActive: { color: GREEN },
  toggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleTitle: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  toggleDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  toggleSwitch: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', padding: 3,
  },
  toggleSwitchOn: { backgroundColor: GREEN },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
