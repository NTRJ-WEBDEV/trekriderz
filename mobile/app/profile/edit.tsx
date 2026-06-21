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

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setForm({
          full_name: data.full_name || '',
          phone: data.phone || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
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

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setSaving(true);
        const localUri = result.assets[0].uri;
        const path = `${user?.id}/avatar-${Date.now()}.jpg`;
        const publicUrl = await uploadImage('avatars', path, localUri);

        if (publicUrl) {
          setForm(prev => ({ ...prev, avatar_url: publicUrl }));
        } else {
          Alert.alert('Error', 'Failed to upload image');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    } finally {
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
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user?.id,
          email: user?.email,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          bio: form.bio.trim(),
          avatar_url: form.avatar_url,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

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

      Alert.alert('Success', 'Profile updated successfully', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update profile.');
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
      {/* Header */}
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
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper} disabled={saving}>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="rgba(255,255,255,0.3)" />
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

        {/* Form Fields */}
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
                onChangeText={(v) => setForm(prev => ({ ...prev, full_name: v }))}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.fieldRow}>
              <Ionicons name="call-outline" size={18} color="#6B7280" style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                placeholderTextColor="#6B7280"
                value={form.phone}
                onChangeText={(v) => setForm(prev => ({ ...prev, phone: v }))}
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
                placeholder="Tell the community about yourself — your favourite trails, adventure style, or anything you'd like to share..."
                placeholderTextColor="#6B7280"
                value={form.bio}
                onChangeText={(v) => setForm(prev => ({ ...prev, bio: v }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>
            <Text style={styles.charCount}>{form.bio.length}/300</Text>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: GREEN,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    color: BG,
    fontSize: 14,
    fontWeight: '800',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: GREEN,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  avatarHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },

  // Form
  formSection: {
    gap: 4,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    height: 52,
  },
  bioRow: {
    height: 'auto',
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  bioInput: {
    minHeight: 90,
    lineHeight: 22,
  },
  charCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },

  cancelBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
  },
});
