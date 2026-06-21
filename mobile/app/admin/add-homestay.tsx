import { useState } from 'react';
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

export default function AddHomestayScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    location: '',
    description: '',
    price_per_night: '',
    capacity: '',
    rooms: '',
    contact_phone: '',
    amenities: '', // comma separated
  });

  const handleAddHomestay = async () => {
    if (!form.name || !form.location || !form.price_per_night) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const amenitiesArray = form.amenities.split(',').map((s) => s.trim()).filter(Boolean);

      const { error } = await supabase.from('homestays').insert({
        owner_id: user?.id,
        name: form.name,
        location: form.location,
        description: form.description,
        price_per_night: parseInt(form.price_per_night),
        capacity: parseInt(form.capacity) || 2,
        rooms: parseInt(form.rooms) || 1,
        contact_phone: form.contact_phone,
        amenities: amenitiesArray,
        status: 'approved',
        is_active: true,
        rating: 5.0,
      });

      if (error) throw error;

      Alert.alert('Success', 'Homestay added successfully!', [
        { text: 'OK', onPress: () => router.back() },
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Homestay</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Property Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mountain View Cottage"
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

        <Text style={styles.label}>Price per Night (₹) *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2500"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
          value={form.price_per_night}
          onChangeText={(t) => setForm({ ...form, price_per_night: t })}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Capacity</Text>
            <TextInput
              style={styles.input}
              placeholder="4"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              value={form.capacity}
              onChangeText={(t) => setForm({ ...form, capacity: t })}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Rooms</Text>
            <TextInput
              style={styles.input}
              placeholder="2"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              value={form.rooms}
              onChangeText={(t) => setForm({ ...form, rooms: t })}
            />
          </View>
        </View>

        <Text style={styles.label}>Amenities (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="WiFi, Kitchen, Parking"
          placeholderTextColor="#6B7280"
          value={form.amenities}
          onChangeText={(t) => setForm({ ...form, amenities: t })}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the property..."
          placeholderTextColor="#6B7280"
          multiline
          numberOfLines={4}
          value={form.description}
          onChangeText={(t) => setForm({ ...form, description: t })}
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

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleAddHomestay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Add Homestay</Text>
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
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
