import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';

interface Props {
  visible: boolean;
  targetId: string;
  targetType: 'guide' | 'homestay' | 'expedition';
  targetName: string;
  reviewerId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function ReviewSheet({ visible, targetId, targetType, targetName, reviewerId, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (rating === 0) { Alert.alert('Rate first', 'Please select a star rating.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        target_id: targetId,
        target_type: targetType,
        reviewer_id: reviewerId,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      haptic.success();
      onSubmitted();
      onClose();
      setRating(0);
      setComment('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Write a Review</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.targetName}>{targetName}</Text>

          {/* Star rating */}
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => { haptic.select(); setRating(s); }}>
                <Ionicons
                  name={s <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={s <= rating ? '#FCD34D' : 'rgba(255,255,255,0.2)'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating] || 'Tap to rate'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Share your experience (optional)..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, (loading || rating === 0) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={loading || rating === 0}
          >
            {loading ? <ActivityIndicator color="#080C14" /> : <Text style={styles.submitText}>Submit Review</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0F1724',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 44,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  targetName: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  stars: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  ratingLabel: { textAlign: 'center', color: '#FCD34D', fontWeight: '700', fontSize: 14, marginBottom: 20, minHeight: 20 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14,
    color: '#FFF', fontSize: 14, lineHeight: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 100, marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#8CC63F', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  submitText: { color: '#080C14', fontWeight: '800', fontSize: 15 },
});
