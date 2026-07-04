import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Switch, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const GREEN = '#8CC63F';
const BG = '#080C14';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isWithin(dateStr: string, periods: { start: string; end: string }[]) {
  return periods.some(p => dateStr >= p.start && dateStr <= p.end);
}

export default function ManagePropertyScreen() {
  const { user } = useAuthStore();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [property, setProperty] = useState<any>(null);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarRoomIdx, setCalendarRoomIdx] = useState(0);
  const [editingRoom, setEditingRoom] = useState<any | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let propQuery = supabase.from('properties').select('*').eq('owner_id', user.id).eq('status', 'approved');
      propQuery = id ? propQuery.eq('id', id) : propQuery.order('created_at', { ascending: false });
      const { data: prop, error: propErr } = await propQuery.limit(1).maybeSingle();
      if (propErr) throw propErr;
      if (!prop) { setProperty(null); setLoading(false); return; }
      setProperty(prop);

      const { data: rooms } = await supabase.from('room_types').select('*').eq('property_id', prop.id).order('created_at', { ascending: true });
      setRoomTypes(rooms || []);

      const { data: inq } = await supabase
        .from('property_inquiries')
        .select('*, room_types(name), users:user_id(full_name, avatar_url)')
        .eq('property_id', prop.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setInquiries(inq || []);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const toggleAvailability = async (room: any) => {
    const next = !room.is_available;
    setRoomTypes(prev => prev.map(r => r.id === room.id ? { ...r, is_available: next } : r));
    const { error } = await supabase.from('room_types').update({ is_available: next }).eq('id', room.id);
    if (error) {
      Alert.alert('Error', error.message);
      setRoomTypes(prev => prev.map(r => r.id === room.id ? { ...r, is_available: !next } : r));
    }
  };

  const saveRoomEdit = async () => {
    if (!editingRoom) return;
    setSavingRoom(true);
    try {
      const { error } = await supabase.from('room_types').update({
        name: editingRoom.name,
        description: editingRoom.description,
        base_price: parseFloat(editingRoom.base_price) || 0,
        weekend_price_enabled: editingRoom.weekend_price_enabled,
        weekend_price: parseFloat(editingRoom.weekend_price) || 0,
        peak_season_enabled: editingRoom.peak_season_enabled,
        peak_price: parseFloat(editingRoom.peak_price) || 0,
        off_season_enabled: editingRoom.off_season_enabled,
        off_season_price: parseFloat(editingRoom.off_season_price) || 0,
        total_units: parseInt(editingRoom.total_units) || 1,
        min_nights: parseInt(editingRoom.min_nights) || 1,
        is_available: editingRoom.is_available,
      }).eq('id', editingRoom.id);
      if (error) throw error;
      setRoomTypes(prev => prev.map(r => r.id === editingRoom.id ? editingRoom : r));
      setEditingRoom(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingRoom(false);
    }
  };

  const replyOnWhatsApp = (inquiry: any) => {
    if (!inquiry.contact_phone) {
      Alert.alert('No Phone Number', 'This guest did not leave a contact number.');
      return;
    }
    const msg = encodeURIComponent(
      `Hi ${inquiry.users?.full_name || 'there'}, thanks for your interest in ${property?.name} on TrekRiderz! Regarding your enquiry for ${inquiry.checkin_date} to ${inquiry.checkout_date}...`
    );
    Linking.openURL(`https://wa.me/${inquiry.contact_phone.replace(/\D/g, '')}?text=${msg}`).catch(() => {
      Alert.alert('WhatsApp Not Found', 'WhatsApp is not installed on this device.');
    });
  };

  const markInquiryStatus = async (inquiry: any, status: string) => {
    const { error } = await supabase.from('property_inquiries').update({ status }).eq('id', inquiry.id);
    if (error) { Alert.alert('Error', error.message); return; }
    setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, status } : i));
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={GREEN} /></View>;

  if (!property) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Manage Property</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="home-outline" size={48} color="rgba(255,255,255,0.15)" />
          <Text style={s.emptyText}>No approved property found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const thisMonthKey = new Date().toISOString().slice(0, 7);
  const confirmedThisMonth = inquiries.filter(i => i.status === 'confirmed' && i.created_at?.startsWith(thisMonthKey));
  const revenueThisMonth = confirmedThisMonth.reduce((sum, i) => sum + (i.total_estimate || 0) * 0.85, 0);
  const newInquiriesCount = inquiries.filter(i => i.status === 'new').length;

  const activeRoom = roomTypes[calendarRoomIdx];
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const calendarCells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const dayInfo = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = new Date(year, month, day).getDay();
    const isWeekend = dow === 5 || dow === 6;
    if (!activeRoom?.is_available) return { color: '#333', label: 'Unavailable', price: null };
    if (activeRoom.peak_season_enabled && isWithin(dateStr, activeRoom.peak_seasons || [])) {
      return { color: '#EF4444', label: 'Peak', price: activeRoom.peak_price };
    }
    if (activeRoom.off_season_enabled && isWithin(dateStr, activeRoom.off_season_periods || [])) {
      return { color: '#9CA3AF', label: 'Off-season', price: activeRoom.off_season_price };
    }
    if (activeRoom.weekend_price_enabled && isWeekend) {
      return { color: '#FBBF24', label: 'Weekend', price: activeRoom.weekend_price };
    }
    return { color: GREEN, label: 'Base', price: activeRoom.base_price };
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>{property.name}</Text>
          <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Dashboard stats */}
        <View style={s.statsRow}>
          <StatCard label="Bookings" value={confirmedThisMonth.length.toString()} icon="calendar-outline" />
          <StatCard label="New Enquiries" value={newInquiriesCount.toString()} icon="chatbubble-outline" color="#FBBF24" />
          <StatCard label="Revenue (mo)" value={`₹${(revenueThisMonth / 1000).toFixed(1)}k`} icon="cash-outline" color={GREEN} />
        </View>

        {/* Room type management */}
        <Text style={s.sectionTitle}>Room Types</Text>
        {roomTypes.map((rt) => (
          <View key={rt.id} style={s.roomCard}>
            {rt.photos?.[0] ? (
              <Image source={{ uri: rt.photos[0] }} style={s.roomImg} contentFit="cover" />
            ) : (
              <View style={[s.roomImg, s.roomImgFallback]}><Ionicons name="bed-outline" size={20} color="rgba(255,255,255,0.2)" /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.roomName} numberOfLines={1}>{rt.name}</Text>
              <Text style={s.roomPrice}>₹{rt.base_price?.toLocaleString('en-IN')}/night</Text>
            </View>
            <Switch value={rt.is_available} onValueChange={() => toggleAvailability(rt)} trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(140,198,63,0.5)' }} thumbColor={rt.is_available ? GREEN : '#888'} />
            <TouchableOpacity style={s.editRoomBtn} onPress={() => setEditingRoom({ ...rt })}>
              <Ionicons name="pencil-outline" size={16} color={GREEN} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.addRoomBtn} onPress={() => router.push('/host/create' as any)}>
          <Ionicons name="add-circle-outline" size={16} color={GREEN} />
          <Text style={s.addRoomBtnText}>Add another room type</Text>
        </TouchableOpacity>

        {/* Pricing calendar */}
        {roomTypes.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Pricing Calendar</Text>
            <View style={s.chipRow}>
              {roomTypes.map((rt, idx) => (
                <TouchableOpacity key={rt.id} style={[s.roomChip, calendarRoomIdx === idx && s.roomChipActive]} onPress={() => setCalendarRoomIdx(idx)}>
                  <Text style={[s.roomChipText, calendarRoomIdx === idx && s.roomChipTextActive]} numberOfLines={1}>{rt.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.calendarNav}>
              <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month - 1, 1))}>
                <Ionicons name="chevron-back" size={20} color={GREEN} />
              </TouchableOpacity>
              <Text style={s.calendarMonthLabel}>{MONTH_NAMES[month]} {year}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(new Date(year, month + 1, 1))}>
                <Ionicons name="chevron-forward" size={20} color={GREEN} />
              </TouchableOpacity>
            </View>

            <View style={s.calendarGrid}>
              {calendarCells.map((day, idx) => {
                if (!day) return <View key={idx} style={s.calCell} />;
                const info = dayInfo(day);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[s.calCell, s.calCellFilled, { borderColor: info.color }]}
                    onPress={() => Alert.alert(
                      `${MONTH_NAMES[month]} ${day}`,
                      info.price != null ? `${info.label}: ₹${Number(info.price).toLocaleString('en-IN')}/night` : info.label
                    )}
                  >
                    <View style={[s.calDot, { backgroundColor: info.color }]} />
                    <Text style={s.calDayText}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.legendRow}>
              <Legend color={GREEN} label="Base" />
              <Legend color="#FBBF24" label="Weekend" />
              <Legend color="#EF4444" label="Peak" />
              <Legend color="#9CA3AF" label="Off-season" />
              <Legend color="#333" label="Blocked" />
            </View>
            <Text style={s.calendarHint}>Tap a date to see the effective nightly price. Toggle room availability above to block a room entirely.</Text>
          </>
        )}

        {/* Inquiries */}
        <Text style={s.sectionTitle}>Booking Enquiries</Text>
        {inquiries.length === 0 ? (
          <View style={s.emptyInline}>
            <Ionicons name="chatbubble-outline" size={40} color="rgba(255,255,255,0.1)" />
            <Text style={s.emptyText}>No enquiries yet</Text>
          </View>
        ) : (
          inquiries.map((inq) => (
            <View key={inq.id} style={s.inquiryCard}>
              <View style={s.inquiryHeader}>
                <Image
                  source={{ uri: inq.users?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(inq.users?.full_name || 'Guest')}&background=1a2a1a&color=8CC63F` }}
                  style={s.inquiryAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.inquiryName}>{inq.users?.full_name || 'Guest'}</Text>
                  <Text style={s.inquiryMeta}>{inq.room_types?.name} · {inq.guests} guest{inq.guests !== 1 ? 's' : ''}</Text>
                </View>
                <View style={[s.inqStatusPill, { backgroundColor: inq.status === 'new' ? 'rgba(251,191,36,0.15)' : inq.status === 'confirmed' ? 'rgba(140,198,63,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                  <Text style={[s.inqStatusText, { color: inq.status === 'new' ? '#FBBF24' : inq.status === 'confirmed' ? GREEN : '#EF4444' }]}>{inq.status}</Text>
                </View>
              </View>
              <Text style={s.inquiryDates}>
                {inq.checkin_date} → {inq.checkout_date} · Est. ₹{inq.total_estimate?.toLocaleString('en-IN')}
              </Text>
              {inq.message ? <Text style={s.inquiryMessage} numberOfLines={2}>"{inq.message}"</Text> : null}
              <View style={s.inquiryActions}>
                <TouchableOpacity style={s.whatsappReplyBtn} onPress={() => replyOnWhatsApp(inq)}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={s.whatsappReplyText}>Reply on WhatsApp</Text>
                </TouchableOpacity>
                {inq.status === 'new' && (
                  <TouchableOpacity style={s.confirmBtn} onPress={() => markInquiryStatus(inq, 'confirmed')}>
                    <Text style={s.confirmBtnText}>Mark Confirmed</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Edit room modal */}
      <Modal visible={!!editingRoom} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <SafeAreaView style={s.modalSheet} edges={['bottom']}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Room Type</Text>
              <TouchableOpacity onPress={() => setEditingRoom(null)}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            {editingRoom && (
              <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                <Text style={s.fieldLabel}>Name</Text>
                <TextInput style={s.input} value={editingRoom.name} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, name: v }))} placeholderTextColor="#555" />

                <Text style={s.fieldLabel}>Base Price (₹/night)</Text>
                <TextInput style={s.input} keyboardType="numeric" value={String(editingRoom.base_price)} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, base_price: v }))} placeholderTextColor="#555" />

                <View style={s.toggleRow}>
                  <Text style={s.toggleLabel}>Weekend Pricing</Text>
                  <Switch value={editingRoom.weekend_price_enabled} onValueChange={(v) => setEditingRoom((r: any) => ({ ...r, weekend_price_enabled: v }))} trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(140,198,63,0.5)' }} thumbColor={GREEN} />
                </View>
                {editingRoom.weekend_price_enabled && (
                  <TextInput style={s.input} keyboardType="numeric" placeholder="Weekend price" value={String(editingRoom.weekend_price || '')} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, weekend_price: v }))} placeholderTextColor="#555" />
                )}

                <View style={s.toggleRow}>
                  <Text style={s.toggleLabel}>Peak Season Pricing</Text>
                  <Switch value={editingRoom.peak_season_enabled} onValueChange={(v) => setEditingRoom((r: any) => ({ ...r, peak_season_enabled: v }))} trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(140,198,63,0.5)' }} thumbColor={GREEN} />
                </View>
                {editingRoom.peak_season_enabled && (
                  <TextInput style={s.input} keyboardType="numeric" placeholder="Peak price" value={String(editingRoom.peak_price || '')} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, peak_price: v }))} placeholderTextColor="#555" />
                )}

                <View style={s.toggleRow}>
                  <Text style={s.toggleLabel}>Off-Season Pricing</Text>
                  <Switch value={editingRoom.off_season_enabled} onValueChange={(v) => setEditingRoom((r: any) => ({ ...r, off_season_enabled: v }))} trackColor={{ false: 'rgba(255,255,255,0.15)', true: 'rgba(140,198,63,0.5)' }} thumbColor={GREEN} />
                </View>
                {editingRoom.off_season_enabled && (
                  <TextInput style={s.input} keyboardType="numeric" placeholder="Off-season price" value={String(editingRoom.off_season_price || '')} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, off_season_price: v }))} placeholderTextColor="#555" />
                )}

                <Text style={s.fieldLabel}>Total Units</Text>
                <TextInput style={s.input} keyboardType="numeric" value={String(editingRoom.total_units)} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, total_units: v }))} placeholderTextColor="#555" />

                <Text style={s.fieldLabel}>Minimum Nights</Text>
                <TextInput style={s.input} keyboardType="numeric" value={String(editingRoom.min_nights)} onChangeText={(v) => setEditingRoom((r: any) => ({ ...r, min_nights: v }))} placeholderTextColor="#555" />

                <TouchableOpacity style={[s.saveBtn, savingRoom && { opacity: 0.6 }]} onPress={saveRoomEdit} disabled={savingRoom}>
                  {savingRoom ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>SAVE CHANGES</Text>}
                </TouchableOpacity>
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color = '#FFF' }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={20} color={color === '#FFF' ? GREEN : color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, gap: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  liveBadge: { backgroundColor: 'rgba(140,198,63,0.15)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  liveBadgeText: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  emptyInline: { alignItems: 'center', paddingVertical: 30, gap: 10 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', marginBottom: 14, marginTop: 8 },

  roomCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  roomImg: { width: 46, height: 46, borderRadius: 10 },
  roomImgFallback: { backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  roomName: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  roomPrice: { color: GREEN, fontSize: 12, fontWeight: '700', marginTop: 2 },
  editRoomBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(140,198,63,0.1)', alignItems: 'center', justifyContent: 'center' },
  addRoomBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, marginBottom: 8,
  },
  addRoomBtnText: { color: GREEN, fontSize: 13, fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roomChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxWidth: 160 },
  roomChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  roomChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  roomChipTextActive: { color: '#000' },

  calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 },
  calendarMonthLabel: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calCell: { width: '13.2%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calCellFilled: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, borderWidth: 1 },
  calDot: { width: 5, height: 5, borderRadius: 2.5, marginBottom: 2 },
  calDayText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  calendarHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 16, marginBottom: 20 },

  inquiryCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  inquiryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  inquiryAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(140,198,63,0.1)' },
  inquiryName: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  inquiryMeta: { color: '#9CA3AF', fontSize: 11, marginTop: 1 },
  inqStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inqStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  inquiryDates: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 6 },
  inquiryMessage: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontStyle: 'italic', marginBottom: 10 },
  inquiryActions: { flexDirection: 'row', gap: 8 },
  whatsappReplyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center',
    backgroundColor: 'rgba(37,211,102,0.1)', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(37,211,102,0.25)',
  },
  whatsappReplyText: { color: '#25D366', fontSize: 12, fontWeight: '700' },
  confirmBtn: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, justifyContent: 'center' },
  confirmBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0F1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: GREEN, letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase', marginTop: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  toggleLabel: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  saveBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
