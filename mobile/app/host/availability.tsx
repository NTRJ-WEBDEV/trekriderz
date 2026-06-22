import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const TODAY = new Date().toISOString().split('T')[0];
const GREEN = '#8CC63F';

type MarkedDates = Record<string, any>;

export default function HostAvailabilityScreen() {
  const { user } = useAuthStore();
  const [homestayId, setHomestayId] = useState<string | null>(null);
  const [homestayName, setHomestayName] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState<'flexible' | 'moderate' | 'strict'>('moderate');
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHomestayData(); }, [user]);

  const fetchHomestayData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: homestay } = await supabase
        .from('homestays')
        .select('id, name, cancellation_policy')
        .eq('user_id', user.id)
        .single();

      if (!homestay) { Alert.alert('No property found', 'Register a homestay first.'); router.back(); return; }
      setHomestayId(homestay.id);
      setHomestayName(homestay.name);
      setCancellationPolicy(homestay.cancellation_policy || 'moderate');

      const [{ data: avail }, { data: bookings }] = await Promise.all([
        supabase.from('homestay_availability').select('date, is_available').eq('homestay_id', homestay.id),
        supabase.from('bookings').select('start_date, end_date')
          .eq('resource_id', homestay.id).eq('resource_type', 'homestay')
          .in('status', ['pending', 'confirmed']),
      ]);

      const blocked = new Set<string>();
      (avail || []).filter((r: any) => !r.is_available).forEach((r: any) => blocked.add(r.date));
      setBlockedDates(blocked);

      const booked = new Set<string>();
      (bookings || []).forEach((b: any) => {
        const d = new Date(b.start_date);
        const end = new Date(b.end_date);
        while (d < end) {
          booked.add(d.toISOString().split('T')[0]);
          d.setDate(d.getDate() + 1);
        }
      });
      setBookedDates(booked);
    } finally {
      setLoading(false);
    }
  };

  const onDayPress = (day: { dateString: string }) => {
    const date = day.dateString;
    if (date < TODAY || bookedDates.has(date)) return;
    setPendingToggles(prev => {
      const next = new Set(prev);
      if (next.has(date)) { next.delete(date); } else { next.add(date); }
      return next;
    });
  };

  const getMarkedDates = useCallback((): MarkedDates => {
    const marks: MarkedDates = {};
    bookedDates.forEach(d => {
      marks[d] = { disabled: true, disableTouchEvent: true, marked: true,
        dotColor: '#F59E0B', customStyles: { container: { backgroundColor: 'rgba(245,158,11,0.2)' }, text: { color: '#F59E0B' } } };
    });
    blockedDates.forEach(d => {
      if (!bookedDates.has(d)) {
        const toggled = pendingToggles.has(d);
        marks[d] = { selected: true, selectedColor: toggled ? GREEN : '#EF4444',
          customStyles: { container: { backgroundColor: toggled ? 'rgba(140,198,63,0.2)' : 'rgba(239,68,68,0.2)' }, text: { color: toggled ? GREEN : '#EF4444' } } };
      }
    });
    pendingToggles.forEach(d => {
      if (!blockedDates.has(d) && !bookedDates.has(d)) {
        marks[d] = { selected: true, selectedColor: '#EF4444',
          customStyles: { container: { backgroundColor: 'rgba(239,68,68,0.2)' }, text: { color: '#EF4444' } } };
      }
    });
    return marks;
  }, [blockedDates, bookedDates, pendingToggles]);

  const saveChanges = async () => {
    if (!homestayId || pendingToggles.size === 0) return;
    setSaving(true);
    try {
      const upserts = Array.from(pendingToggles).map(date => ({
        homestay_id: homestayId,
        date,
        is_available: blockedDates.has(date),
      }));
      const { error } = await supabase.from('homestay_availability').upsert(upserts, { onConflict: 'homestay_id,date' });
      if (error) throw error;

      await supabase.from('homestays').update({ cancellation_policy: cancellationPolicy }).eq('id', homestayId);

      const newBlocked = new Set(blockedDates);
      pendingToggles.forEach(d => {
        if (newBlocked.has(d)) { newBlocked.delete(d); } else { newBlocked.add(d); }
      });
      setBlockedDates(newBlocked);
      setPendingToggles(new Set());
      Alert.alert('Saved', 'Your property availability has been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const POLICY_OPTIONS: { key: 'flexible' | 'moderate' | 'strict'; label: string; desc: string }[] = [
    { key: 'flexible', label: 'Flexible', desc: 'Free cancel up to 24h before check-in' },
    { key: 'moderate', label: 'Moderate', desc: 'Free cancel up to 48h before check-in' },
    { key: 'strict', label: 'Strict', desc: 'Non-refundable after booking' },
  ];

  if (loading) return (
    <SafeAreaView style={s.container}>
      <ActivityIndicator size="large" color={GREEN} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>Availability</Text>
          <View style={{ width: 40 }} />
        </View>

        {homestayName ? <Text style={s.propertyName}>{homestayName}</Text> : null}

        {/* Legend */}
        <View style={s.legend}>
          {[
            { color: GREEN, label: 'Available' },
            { color: '#EF4444', label: 'Blocked' },
            { color: '#F59E0B', label: 'Booked' },
          ].map(l => (
            <View key={l.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: l.color }]} />
              <Text style={s.legendLabel}>{l.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.hint}>Tap dates to block/unblock. Booked dates cannot be changed.</Text>

        <Calendar
          minDate={TODAY}
          onDayPress={onDayPress}
          markedDates={getMarkedDates()}
          markingType="custom"
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'rgba(255,255,255,0.04)',
            textSectionTitleColor: '#6B7280',
            dayTextColor: '#FFF',
            todayTextColor: GREEN,
            selectedDayTextColor: '#FFF',
            monthTextColor: '#FFF',
            arrowColor: GREEN,
            textDisabledColor: 'rgba(255,255,255,0.2)',
          }}
          style={s.calendar}
        />

        {pendingToggles.size > 0 && (
          <View style={s.pendingBanner}>
            <Ionicons name="information-circle-outline" size={16} color={GREEN} />
            <Text style={s.pendingText}>{pendingToggles.size} change{pendingToggles.size > 1 ? 's' : ''} pending — tap Save to apply</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Cancellation Policy</Text>
        {POLICY_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[s.policyRow, cancellationPolicy === opt.key && s.policyRowActive]}
            onPress={() => setCancellationPolicy(opt.key)}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.policyLabel}>{opt.label}</Text>
              <Text style={s.policyDesc}>{opt.desc}</Text>
            </View>
            <View style={[s.radio, cancellationPolicy === opt.key && s.radioActive]}>
              {cancellationPolicy === opt.key && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[s.saveBtn, (saving || pendingToggles.size === 0) && s.saveBtnDisabled]}
          onPress={saveChanges}
          disabled={saving || pendingToggles.size === 0}
        >
          {saving ? <ActivityIndicator color="#FFF" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
              <Text style={s.saveBtnText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  propertyName: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 4 },
  legend: { flexDirection: 'row', gap: 20, paddingHorizontal: 20, paddingTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  hint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, paddingHorizontal: 20, marginTop: 8, marginBottom: 12 },
  calendar: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)' },
  pendingText: { color: GREEN, fontSize: 13, flex: 1 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginHorizontal: 20, marginTop: 24, marginBottom: 12 },
  policyRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  policyRowActive: { borderColor: GREEN, backgroundColor: 'rgba(140,198,63,0.08)' },
  policyLabel: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  policyDesc: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: GREEN, marginHorizontal: 20, marginTop: 24, paddingVertical: 16, borderRadius: 14 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
