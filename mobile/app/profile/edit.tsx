import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import PhoneInput, { splitPhone } from '@/components/PhoneInput';
import { AppColors } from '@/constants/theme';

const GREEN = AppColors.primary;
const BG = AppColors.background;

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    location: '',
    is_private: false,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (data) {
        const { countryCode: code, number } = splitPhone(data.phone || '');
        setCountryCode(code);
        setForm({
          full_name: data.full_name || '',
          phone: number,
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          location: data.location || '',
          is_private: !!data.is_private,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setSaving(true);
        const localUri = result.assets[0].uri;
        const path = `${user?.id}/avatar-${Date.now()}.jpg`;
        const publicUrl = await uploadImage('avatars', path, localUri);
        if (publicUrl) {
          setForm(prev => ({ ...prev, avatar_url: publicUrl }));
        } else {
          Alert.alert('Error', 'Failed to upload image');
        }
        setSaving(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    setSaving(true);
    try {
      const fullPhone = form.phone.trim() ? `${countryCode}${form.phone.trim()}` : '';

      const { error } = await supabase
        .from('users')
        .upsert({
          id: user?.id,
          email: user?.email,
          full_name: form.full_name.trim(),
          phone: fullPhone,
          bio: form.bio.trim(),
          avatar_url: form.avatar_url,
          location: form.location.trim(),
          is_private: form.is_private,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Sync to Supabase Auth metadata so it persists across re-login
      await supabase.auth.updateUser({
        data: {
          full_name: form.full_name.trim(),
          avatar_url: form.avatar_url,
        },
      });

      // Patch in-memory store
      if (user) {
        setUser({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            full_name: form.full_name.trim(),
            avatar_url: form.avatar_url,
          },
        });
      }

      Alert.alert('Saved', 'Profile updated successfully', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={GREEN} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper} disabled={saving}>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {form.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {saving
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Ionicons name="camera" size={16} color="#FFF" />}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        <View style={styles.formSection}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="person-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor="#6B7280"
                value={form.full_name}
                onChangeText={v => setForm(prev => ({ ...prev, full_name: v }))}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone with Country Code */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <PhoneInput
              countryCode={countryCode}
              onChangeCountryCode={setCountryCode}
              number={form.phone}
              onChangeNumber={v => setForm(prev => ({ ...prev, phone: v }))}
            />
          </View>

          {/* Bio */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <View style={[styles.fieldRow, styles.bioRow]}>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Tell the community about yourself — your favourite trails, adventure style..."
                placeholderTextColor="#6B7280"
                value={form.bio}
                onChangeText={v => setForm(prev => ({ ...prev, bio: v }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>
            <Text style={styles.charCount}>{form.bio.length}/300</Text>
          </View>

          {/* Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Location</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="location-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="City, State"
                placeholderTextColor="#6B7280"
                value={form.location}
                onChangeText={v => setForm(prev => ({ ...prev, location: v }))}
              />
            </View>
          </View>

          {/* Private Account */}
          <View style={styles.fieldGroup}>
            <View style={styles.privacyRow}>
              <View style={styles.privacyTextWrap}>
                <Text style={styles.fieldLabel}>Private Account</Text>
                <Text style={styles.privacyHint}>
                  When on, new followers need your approval before they're added. This only
                  affects who can follow you — your posts stay visible to everyone for now.
                </Text>
              </View>
              <Switch
                value={form.is_private}
                onValueChange={v => setForm(prev => ({ ...prev, is_private: v }))}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: GREEN }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: GREEN, borderRadius: 20, minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { color: BG, fontSize: 14, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: GREEN },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: GREEN + '20', borderWidth: 2.5, borderColor: GREEN,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: GREEN, fontSize: 36, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: BG,
  },
  avatarHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  formSection: { gap: 4 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600',
    marginBottom: 8, letterSpacing: 0.4,
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, height: 52,
  },
  bioRow: { height: 'auto', paddingVertical: 14, alignItems: 'flex-start' },
  fieldIcon: { marginRight: 10 },
  input: { flex: 1, color: '#FFF', fontSize: 15 },
  bioInput: { minHeight: 90, lineHeight: 22 },
  charCount: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'right', marginTop: 4 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  privacyTextWrap: { flex: 1 },
  privacyHint: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4, lineHeight: 17 },
  cancelBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
});
