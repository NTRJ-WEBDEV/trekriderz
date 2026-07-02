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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#8CC63F';
const BG = '#080C14';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+975', flag: '🇧🇹', name: 'Bhutan' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+855', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
];

function splitPhone(full: string): { code: string; number: string } {
  for (const c of COUNTRY_CODES) {
    if (full.startsWith(c.code)) {
      return { code: c.code, number: full.slice(c.code.length).trim() };
    }
  }
  return { code: '+91', number: full.replace(/^\+\d{1,4}\s?/, '') };
}

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [showPicker, setShowPicker] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    location: '',
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
        const { code, number } = splitPhone(data.phone || '');
        setCountryCode(code);
        setForm({
          full_name: data.full_name || '',
          phone: number,
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          location: data.location || '',
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
        { text: 'OK', onPress: () => router.back() },
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

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
            <View style={styles.phoneRow}>
              <TouchableOpacity style={styles.countryCodeBtn} onPress={() => setShowPicker(true)}>
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
                <Ionicons name="chevron-down" size={14} color="#6B7280" />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                placeholder="98765 43210"
                placeholderTextColor="#6B7280"
                value={form.phone}
                onChangeText={v => setForm(prev => ({ ...prev, phone: v }))}
                keyboardType="phone-pad"
              />
            </View>
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
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Country Code Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.codeItem, item.code === countryCode && styles.codeItemActive]}
                  onPress={() => { setCountryCode(item.code); setShowPicker(false); }}
                >
                  <Text style={styles.codeFlag}>{item.flag}</Text>
                  <Text style={styles.codeName}>{item.name}</Text>
                  <Text style={[styles.codeValue, item.code === countryCode && { color: GREEN }]}>
                    {item.code}
                  </Text>
                  {item.code === countryCode && (
                    <Ionicons name="checkmark" size={16} color={GREEN} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countryCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, height: 52,
  },
  countryFlag: { fontSize: 20 },
  countryCodeText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  phoneInput: { flex: 1 },
  cancelBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  codeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  codeItemActive: { backgroundColor: GREEN + '10' },
  codeFlag: { fontSize: 24 },
  codeName: { flex: 1, color: '#FFF', fontSize: 15 },
  codeValue: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
});
