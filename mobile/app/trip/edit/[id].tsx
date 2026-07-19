import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { AppColors } from '@/constants/theme';

const GREEN = AppColors.primary;
const BG = AppColors.background;

// Focused edit screen — covers the fields organizers actually change after
// creation (title, description, dates, group size, budget, meeting point,
// visibility). Deliberately does not cover photo management, destination
// re-geocoding, trip_type, or partner-matching fields — those stay
// create-time-only for now to keep this screen's scope tight.
export default function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [budget, setBudget] = useState('');
  const [budgetType, setBudgetType] = useState<'total' | 'per_person'>('total');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const [dateModal, setDateModal] = useState(false);
  const [pickingField, setPickingField] = useState<'start' | 'end'>('start');

  useEffect(() => {
    loadTrip();
  }, [id]);

  const loadTrip = async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('title, description, start_date, end_date, group_size, budget, budget_type, meeting_point, is_public')
        .eq('id', id)
        .single();

      if (error) throw error;

      setTitle(data.title || '');
      setDescription(data.description || '');
      setStartDate(data.start_date || '');
      setEndDate(data.end_date || '');
      setGroupSize(data.group_size ? String(data.group_size) : '');
      setBudget(data.budget ? String(data.budget) : '');
      setBudgetType(data.budget_type || 'total');
      setMeetingPoint(data.meeting_point || '');
      setIsPublic(!!data.is_public);
    } catch (error) {
      console.error('Error loading trip for edit:', error);
      Alert.alert('Error', 'Failed to load trip');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate || !endDate) {
      Alert.alert('Missing Fields', 'Title and dates are required.');
      return;
    }
    if (groupSize && (!Number.isInteger(Number(groupSize)) || Number(groupSize) < 1 || Number(groupSize) > 9999)) {
      Alert.alert('Invalid Group Size', 'Enter a group size between 1 and 9999.');
      return;
    }
    if (budget && (!Number.isInteger(Number(budget)) || Number(budget) < 1 || Number(budget) > 9999999)) {
      Alert.alert('Invalid Budget', 'Enter a budget up to ₹99,99,999.');
      return;
    }

    haptic.medium();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('trips')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          start_date: startDate,
          end_date: endDate,
          group_size: groupSize ? parseInt(groupSize) : 1,
          budget: budget ? parseInt(budget) : null,
          budget_type: budgetType,
          meeting_point: meetingPoint.trim() || null,
          is_public: isPublic,
        })
        .eq('id', id);

      if (error) throw error;

      haptic.success();
      Alert.alert('Saved', 'Trip updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Trip</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Trip title"
          placeholderTextColor="rgba(255,255,255,0.25)"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add details about the trip"
          placeholderTextColor="rgba(255,255,255,0.25)"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Dates</Text>
        <TouchableOpacity style={styles.dateRow} onPress={() => { setPickingField('start'); setDateModal(true); }}>
          <Ionicons name="calendar-outline" size={16} color={GREEN} />
          <Text style={styles.dateText}>
            {startDate && endDate ? `${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}` : 'Select dates'}
          </Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Group Size</Text>
            <TextInput
              style={styles.input}
              value={groupSize}
              onChangeText={setGroupSize}
              keyboardType="numeric"
              maxLength={4}
              placeholder="People"
              placeholderTextColor="rgba(255,255,255,0.25)"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>{budgetType === 'per_person' ? 'Budget / Person (₹)' : 'Total Budget (₹)'}</Text>
            <TextInput
              style={styles.input}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              maxLength={7}
              placeholder="Amount"
              placeholderTextColor="rgba(255,255,255,0.25)"
            />
          </View>
        </View>

        <View style={styles.chipRow}>
          {(['total', 'per_person'] as const).map((bt) => (
            <TouchableOpacity
              key={bt}
              style={[styles.chip, budgetType === bt && styles.chipActive]}
              onPress={() => { haptic.select(); setBudgetType(bt); }}
            >
              <Text style={[styles.chipText, budgetType === bt && styles.chipTextActive]}>
                {bt === 'total' ? 'Overall budget' : 'Per head budget'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Meeting Point</Text>
        <TextInput
          style={styles.input}
          value={meetingPoint}
          onChangeText={setMeetingPoint}
          placeholder="e.g. Railway station main gate"
          placeholderTextColor="rgba(255,255,255,0.25)"
        />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Public Trip</Text>
            <Text style={styles.switchSub}>Visible to others in Discover</Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(140,198,63,0.4)' }}
            thumbColor={isPublic ? GREEN : 'rgba(255,255,255,0.6)'}
          />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#080C14" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Calendar Modal — must live outside ScrollView, matches create.tsx's pattern */}
      <Modal visible={dateModal} transparent animationType="slide">
        <View style={styles.calModalOverlay}>
          <View style={styles.calModal}>
            <View style={styles.calHeader}>
              <Text style={styles.calTitle}>
                {pickingField === 'start' ? 'Select Start Date' : 'Select End Date'}
              </Text>
              <TouchableOpacity onPress={() => setDateModal(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <Calendar
              minDate={pickingField === 'end' && startDate ? startDate : undefined}
              onDayPress={(day: any) => {
                if (pickingField === 'start') {
                  setStartDate(day.dateString);
                  if (endDate && day.dateString > endDate) setEndDate('');
                  setPickingField('end');
                } else {
                  setEndDate(day.dateString);
                  setDateModal(false);
                }
              }}
              markedDates={{
                ...(startDate ? { [startDate]: { selected: true, selectedColor: GREEN, startingDay: true } } : {}),
                ...(endDate ? { [endDate]: { selected: true, selectedColor: GREEN, endingDay: true } } : {}),
              }}
              markingType="period"
              theme={{
                backgroundColor: '#111827',
                calendarBackground: '#111827',
                textSectionTitleColor: 'rgba(255,255,255,0.4)',
                selectedDayBackgroundColor: GREEN,
                selectedDayTextColor: '#000',
                todayTextColor: GREEN,
                dayTextColor: '#FFF',
                textDisabledColor: 'rgba(255,255,255,0.2)',
                dotColor: GREEN,
                arrowColor: GREEN,
                monthTextColor: '#FFF',
                textMonthFontWeight: '800',
                textDayFontSize: 14,
                textMonthFontSize: 16,
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { padding: 4, width: 36 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1, padding: 20 },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  multiline: { minHeight: 90 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateText: { color: '#FFF', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { borderColor: GREEN, backgroundColor: GREEN + '18' },
  chipText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  chipTextActive: { color: GREEN },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  switchLabel: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  switchSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  saveBtn: {
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#080C14', fontSize: 15, fontWeight: '800' },
  calModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  calModal: {
    backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 30,
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
