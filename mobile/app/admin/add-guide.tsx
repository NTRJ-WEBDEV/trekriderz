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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/hooks/usePermissions';

export default function AddGuideScreen() {
  const { user } = useAuthStore();
  // Reachable directly via deep link/router.push by any signed-in user
  // regardless of role — the nav entry point being staff-only isn't
  // enough. Mirrors admin/index.tsx's guard.
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  useEffect(() => {
    if (!permissionsLoading && !hasPermission('guides.approve')) {
      router.replace('/(tabs)/explore');
    }
  }, [permissionsLoading, hasPermission]);

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    location: '',
    bio: '',
    rate_per_day: '',
    experience_years: '',
    contact_phone: '',
    languages: '', // comma separated
    specialties: '', // comma separated
  });

  const handleAddGuide = async () => {
    if (!form.name || !form.location || !form.rate_per_day) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const languagesArray = form.languages.split(',').map((s) => s.trim()).filter(Boolean);
      const specialtiesArray = form.specialties.split(',').map((s) => s.trim()).filter(Boolean);

      const { error } = await supabase.from('guides').insert({
        user_id: user?.id,
        name: form.name,
        location: form.location,
        bio: form.bio,
        rate_per_day: parseInt(form.rate_per_day),
        experience_years: parseInt(form.experience_years) || 0,
        contact_phone: form.contact_phone,
        languages: languagesArray,
        specialties: specialtiesArray,
        status: 'approved',
        is_verified: true,
        rating: 5.0,
      });

      if (error) throw error;

      Alert.alert('Success', 'Guide added successfully!', [
        { text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)')) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Guide</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Guide Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Amit Singh"
          placeholderTextColor="#6B7280"
          value={form.name}
          onChangeText={(t) => setForm({ ...form, name: t })}
        />

        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Manali, HP"
          placeholderTextColor="#6B7280"
          value={form.location}
          onChangeText={(t) => setForm({ ...form, location: t })}
        />

        <Text style={styles.label}>Daily Rate (₹) *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1500"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
          value={form.rate_per_day}
          onChangeText={(t) => setForm({ ...form, rate_per_day: t })}
        />

        <Text style={styles.label}>Experience (Years)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
          value={form.experience_years}
          onChangeText={(t) => setForm({ ...form, experience_years: t })}
        />

        <Text style={styles.label}>Languages (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="English, Hindi, Pahari"
          placeholderTextColor="#6B7280"
          value={form.languages}
          onChangeText={(t) => setForm({ ...form, languages: t })}
        />

        <Text style={styles.label}>Specialties (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="Trekking, Camping, Birding"
          placeholderTextColor="#6B7280"
          value={form.specialties}
          onChangeText={(t) => setForm({ ...form, specialties: t })}
        />

        <Text style={styles.label}>Contact Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="+91..."
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          value={form.contact_phone}
          onChangeText={(t) => setForm({ ...form, contact_phone: t })}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the guide's background and expertise..."
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={4}
          value={form.bio}
          onChangeText={(t) => setForm({ ...form, bio: t })}
        />

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleAddGuide}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Add Guide</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#fff',
    fontSize: 22,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  label: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  submitBtn: {
    backgroundColor: '#8CC63F',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
