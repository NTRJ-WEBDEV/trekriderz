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
    address: '',
    city: '',
    state: '',
    description: '',
    price_per_night: '',
    capacity: '',
    rooms: '',
    contact_phone: '',
    amenities: '', // comma separated
  });

  const handleAddHomestay = async () => {
    if (!form.name || !form.address || !form.city || !form.state || !form.price_per_night) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const amenitiesArray = form.amenities.split(',').map((s) => s.trim()).filter(Boolean);

      const { data: property, error } = await supabase
        .from('properties')
        .insert({
          owner_id: user?.id,
          name: form.name,
          address: form.address,
          city: form.city,
          state: form.state,
          description: form.description,
          contact_phone: form.contact_phone,
          amenities: amenitiesArray,
          status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) throw error;

      const { error: roomTypeError } = await supabase.from('room_types').insert({
        property_id: property.id,
        name: 'Standard Room',
        room_category: 'private_room',
        base_price: parseInt(form.price_per_night),
        max_occupancy: parseInt(form.capacity) || 2,
        total_units: parseInt(form.rooms) || 1,
        amenities: amenitiesArray,
      });

      if (roomTypeError) throw roomTypeError;

      Alert.alert('Success', 'Homestay added successfully!', [
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

        <Text style={styles.label}>Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Old Manali Road, near river"
          placeholderTextColor="#6B7280"
          value={form.address}
          onChangeText={(t) => setForm({ ...form, address: t })}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="Manali"
              placeholderTextColor="#6B7280"
              value={form.city}
              onChangeText={(t) => setForm({ ...form, city: t })}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={styles.input}
              placeholder="Himachal Pradesh"
              placeholderTextColor="#6B7280"
              value={form.state}
              onChangeText={(t) => setForm({ ...form, state: t })}
            />
          </View>
        </View>

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
