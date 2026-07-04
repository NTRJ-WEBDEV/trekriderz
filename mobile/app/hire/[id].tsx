import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Calendar } from 'react-native-calendars';

const GREEN = '#8CC63F';
const BG = '#080C14';
const TODAY = new Date().toISOString().split('T')[0];

// ─── Vehicle rental inquiry ───────────────────────────────────────────────────

type VehicleData = {
  id: string;
  make: string;
  model: string;
  vehicle_type: string;
  price_per_day: number;
  contact_phone: string;
  contact_whatsapp: string | null;
  local_enabled: boolean;
  local_base_price: number;
  local_included_km: number;
  local_extra_km_charge: number;
  outstation_enabled: boolean;
  outstation_base_price: number;
  outstation_included_km: number;
  outstation_extra_km_charge: number;
  outstation_min_days: number;
  driver_option: 'self' | 'driver' | 'both';
  driver_price_per_day: number;
  local_unlimited_km: boolean;
  outstation_unlimited_km: boolean;
};

function VehicleHireScreen({ id }: { id: string }) {
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [fetching, setFetching] = useState(true);

  const [rentalType, setRentalType] = useState<'local' | 'outstation'>('local');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<{ [k: string]: any }>({});
  const [estimatedKm, setEstimatedKm] = useState('');
  const [wantDriver, setWantDriver] = useState(false);

  useEffect(() => {
    supabase
      .from('rental_vehicles')
      .select('id, make, model, vehicle_type, price_per_day, contact_phone, contact_whatsapp, local_enabled, local_base_price, local_included_km, local_extra_km_charge, local_unlimited_km, outstation_enabled, outstation_base_price, outstation_included_km, outstation_extra_km_charge, outstation_min_days, outstation_unlimited_km, driver_option, driver_price_per_day')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setVehicle(data as VehicleData);
          setRentalType(data.local_enabled ? 'local' : 'outstation');
        }
        setFetching(false);
      });
  }, [id]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  }, [startDate, endDate]);

  const cost = useMemo(() => {
    if (!vehicle || days === 0) return { base: 0, extraKm: 0, driver: 0, total: 0 };
    const hasDetailed = rentalType === 'local'
      ? (vehicle.local_base_price > 0)
      : (vehicle.outstation_base_price > 0);

    if (!hasDetailed) {
      const total = vehicle.price_per_day * days;
      return { base: total, extraKm: 0, driver: 0, total };
    }
    const isUnlimited = rentalType === 'local' ? vehicle.local_unlimited_km : vehicle.outstation_unlimited_km;
    const baseRate = rentalType === 'local' ? vehicle.local_base_price : vehicle.outstation_base_price;
    const includedKm = rentalType === 'local' ? vehicle.local_included_km : vehicle.outstation_included_km;
    const extraRate = rentalType === 'local' ? vehicle.local_extra_km_charge : vehicle.outstation_extra_km_charge;
    const km = parseInt(estimatedKm) || 0;
    const base = baseRate * days;
    const extraKm = isUnlimited ? 0 : Math.max(0, km - includedKm * days) * extraRate;
    const driver = wantDriver && vehicle.driver_option !== 'self' ? vehicle.driver_price_per_day * days : 0;
    return { base, extraKm, driver, total: base + extraKm + driver };
  }, [vehicle, days, rentalType, estimatedKm, wantDriver]);

  const onDayPress = (day: { dateString: string }) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate(null);
      setSelectedDates({ [day.dateString]: { startingDay: true, color: GREEN, textColor: '#FFF' } });
    } else {
      if (day.dateString < startDate) {
        setStartDate(day.dateString);
        setEndDate(null);
        setSelectedDates({ [day.dateString]: { startingDay: true, color: GREEN, textColor: '#FFF' } });
      } else {
        setEndDate(day.dateString);
        const range: { [k: string]: any } = {};
        let cur = new Date(startDate);
        const last = new Date(day.dateString);
        while (cur <= last) {
          const ds = cur.toISOString().split('T')[0];
          if (ds === startDate) range[ds] = { startingDay: true, color: GREEN, textColor: '#FFF' };
          else if (ds === day.dateString) range[ds] = { endingDay: true, color: GREEN, textColor: '#FFF' };
          else range[ds] = { color: 'rgba(140,198,63,0.25)', textColor: '#FFF' };
          cur.setDate(cur.getDate() + 1);
        }
        setSelectedDates(range);
      }
    }
  };

  const openWhatsApp = () => {
    if (!vehicle) return;
    if (!startDate || !endDate) { Alert.alert('Select Dates', 'Please select your rental dates.'); return; }

    const vehicleName = `${vehicle.make} ${vehicle.model}`;
    const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const isUnlimited = rentalType === 'local' ? vehicle.local_unlimited_km : vehicle.outstation_unlimited_km;
    const kmLine = isUnlimited ? 'Unlimited KM plan selected' : (estimatedKm ? `${estimatedKm}km` : 'Not specified');
    const driverText = wantDriver && vehicle.driver_option !== 'self' ? 'Yes' : 'No';

    const msg = encodeURIComponent(
      `Hi! I want to rent your ${vehicleName}.\n` +
      `Type: ${rentalType === 'local' ? 'Local' : 'Outstation'}\n` +
      `Dates: ${fmt(startDate)} to ${fmt(endDate)} (${days} day${days > 1 ? 's' : ''})\n` +
      `Estimated km: ${kmLine}\n` +
      `Driver: ${driverText}\n` +
      `Estimated cost: ₹${cost.total.toLocaleString('en-IN')}\n` +
      `Please confirm availability.`
    );
    const phone = (vehicle.contact_whatsapp || vehicle.contact_phone).replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`).catch(() =>
      Linking.openURL(`https://wa.me/${phone}?text=${msg}`)
    );
  };

  if (fetching) return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={GREEN} />
    </View>
  );

  if (!vehicle) return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Vehicle not found</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={{ color: GREEN }}>Go back</Text></TouchableOpacity>
    </View>
  );

  const minDays = rentalType === 'outstation' ? (vehicle.outstation_min_days || 2) : 1;
  const hasDriver = vehicle.driver_option === 'both' || vehicle.driver_option === 'driver';

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={vStyles.header}>
          <TouchableOpacity style={vStyles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={vStyles.headerTitle}>Book Vehicle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={vStyles.scroll} keyboardShouldPersistTaps="handled">
          {/* Vehicle card */}
          <View style={vStyles.vehicleCard}>
            <View style={vStyles.vehicleIcon}>
              <Ionicons name="car-outline" size={24} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={vStyles.vehicleName}>{vehicle.make} {vehicle.model}</Text>
              <Text style={vStyles.vehicleType}>{vehicle.vehicle_type.toUpperCase()} · from ₹{vehicle.price_per_day.toLocaleString('en-IN')}/day</Text>
            </View>
          </View>

          {/* Rental type selector */}
          <Text style={vStyles.sectionTitle}>Rental Type</Text>
          <View style={vStyles.typeRow}>
            {vehicle.local_enabled && (
              <TouchableOpacity
                style={[vStyles.typeBtn, rentalType === 'local' && vStyles.typeBtnOn]}
                onPress={() => setRentalType('local')} activeOpacity={0.8}
              >
                <Ionicons name="navigate-outline" size={18} color={rentalType === 'local' ? GREEN : 'rgba(255,255,255,0.4)'} />
                <Text style={[vStyles.typeBtnText, rentalType === 'local' && { color: GREEN }]}>Local</Text>
                {vehicle.local_base_price > 0 && (
                  <Text style={vStyles.typeBtnPrice}>₹{vehicle.local_base_price}/day</Text>
                )}
              </TouchableOpacity>
            )}
            {vehicle.outstation_enabled && (
              <TouchableOpacity
                style={[vStyles.typeBtn, rentalType === 'outstation' && vStyles.typeBtnOn]}
                onPress={() => setRentalType('outstation')} activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={18} color={rentalType === 'outstation' ? GREEN : 'rgba(255,255,255,0.4)'} />
                <Text style={[vStyles.typeBtnText, rentalType === 'outstation' && { color: GREEN }]}>Outstation</Text>
                {vehicle.outstation_base_price > 0 && (
                  <Text style={vStyles.typeBtnPrice}>₹{vehicle.outstation_base_price}/day</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {rentalType === 'outstation' && minDays > 1 && (
            <Text style={vStyles.minDaysNote}>Minimum {minDays} days for outstation</Text>
          )}

          {/* Calendar */}
          <Text style={vStyles.sectionTitle}>Select Dates</Text>
          <View style={vStyles.calendarWrap}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={selectedDates}
              markingType="period"
              theme={{
                backgroundColor: 'transparent', calendarBackground: 'transparent',
                textSectionTitleColor: 'rgba(255,255,255,0.5)',
                selectedDayBackgroundColor: GREEN, selectedDayTextColor: '#FFF',
                todayTextColor: GREEN, dayTextColor: '#FFF',
                textDisabledColor: 'rgba(255,255,255,0.2)',
                monthTextColor: '#FFF', arrowColor: GREEN,
              }}
              minDate={TODAY}
            />
          </View>

          {(startDate || endDate) && (
            <View style={vStyles.dateSummary}>
              <View style={vStyles.dateBox}>
                <Text style={vStyles.dateBoxLabel}>From</Text>
                <Text style={vStyles.dateBoxValue}>{startDate || '—'}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.3)" />
              <View style={vStyles.dateBox}>
                <Text style={vStyles.dateBoxLabel}>To</Text>
                <Text style={vStyles.dateBoxValue}>{endDate || '—'}</Text>
              </View>
              {days > 0 && (
                <View style={[vStyles.dateBox, { backgroundColor: 'rgba(140,198,63,0.1)', borderColor: 'rgba(140,198,63,0.25)' }]}>
                  <Text style={[vStyles.dateBoxLabel, { color: GREEN }]}>Days</Text>
                  <Text style={[vStyles.dateBoxValue, { color: GREEN }]}>{days}</Text>
                </View>
              )}
            </View>
          )}

          {/* Estimated km */}
          {(rentalType === 'local' ? vehicle.local_unlimited_km : vehicle.outstation_unlimited_km) ? (
            <View style={vStyles.unlimitedBadge}>
              <Ionicons name="infinite-outline" size={16} color={GREEN} />
              <Text style={vStyles.unlimitedBadgeText}>Unlimited KM included</Text>
            </View>
          ) : (
            <>
              <Text style={vStyles.sectionTitle}>Estimated Kilometers</Text>
              <View style={vStyles.kmInput}>
                <Ionicons name="speedometer-outline" size={18} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={vStyles.kmTextInput}
                  placeholder="e.g. 200"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={estimatedKm}
                  onChangeText={setEstimatedKm}
                  keyboardType="numeric"
                />
                <Text style={vStyles.kmSuffix}>km total</Text>
              </View>
              {rentalType === 'local' && vehicle.local_included_km > 0 && (
                <Text style={vStyles.kmNote}>{vehicle.local_included_km}km/day included. Extra km charged at ₹{vehicle.local_extra_km_charge}/km</Text>
              )}
              {rentalType === 'outstation' && vehicle.outstation_included_km > 0 && (
                <Text style={vStyles.kmNote}>{vehicle.outstation_included_km}km/day included. Extra km charged at ₹{vehicle.outstation_extra_km_charge}/km</Text>
              )}
            </>
          )}

          {/* Driver option */}
          {hasDriver && (
            <>
              <Text style={vStyles.sectionTitle}>Driver</Text>
              <View style={vStyles.driverOptions}>
                <TouchableOpacity
                  style={[vStyles.driverBtn, !wantDriver && vStyles.driverBtnOn]}
                  onPress={() => setWantDriver(false)} activeOpacity={0.8}
                >
                  <Ionicons name="person-outline" size={16} color={!wantDriver ? GREEN : 'rgba(255,255,255,0.4)'} />
                  <Text style={[vStyles.driverBtnText, !wantDriver && { color: GREEN }]}>Self Drive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[vStyles.driverBtn, wantDriver && vStyles.driverBtnOn]}
                  onPress={() => setWantDriver(true)} activeOpacity={0.8}
                >
                  <Ionicons name="people-outline" size={16} color={wantDriver ? GREEN : 'rgba(255,255,255,0.4)'} />
                  <Text style={[vStyles.driverBtnText, wantDriver && { color: GREEN }]}>
                    With Driver {vehicle.driver_price_per_day > 0 ? `+₹${vehicle.driver_price_per_day}/day` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Cost breakdown */}
          {days > 0 && (
            <View style={vStyles.costCard}>
              <Text style={vStyles.costTitle}>Estimated Cost</Text>
              <View style={vStyles.costRow}>
                <Text style={vStyles.costLabel}>Base ({days} day{days > 1 ? 's' : ''})</Text>
                <Text style={vStyles.costValue}>₹{cost.base.toLocaleString('en-IN')}</Text>
              </View>
              {cost.extraKm > 0 && (
                <View style={vStyles.costRow}>
                  <Text style={vStyles.costLabel}>Extra km charge</Text>
                  <Text style={vStyles.costValue}>₹{cost.extraKm.toLocaleString('en-IN')}</Text>
                </View>
              )}
              {cost.driver > 0 && (
                <View style={vStyles.costRow}>
                  <Text style={vStyles.costLabel}>Driver ({days} day{days > 1 ? 's' : ''})</Text>
                  <Text style={vStyles.costValue}>₹{cost.driver.toLocaleString('en-IN')}</Text>
                </View>
              )}
              <View style={vStyles.costDivider} />
              <View style={vStyles.costRow}>
                <Text style={vStyles.costTotalLabel}>Estimated Total</Text>
                <Text style={vStyles.costTotalValue}>₹{cost.total.toLocaleString('en-IN')}</Text>
              </View>
              <Text style={vStyles.costNote}>Final price confirmed by vehicle owner. Pay directly.</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={vStyles.footer}>
          {days > 0 && (
            <Text style={vStyles.footerSummary}>
              {days} day{days > 1 ? 's' : ''} · ₹{cost.total.toLocaleString('en-IN')} estimated
            </Text>
          )}
          <TouchableOpacity style={vStyles.waBtn} onPress={openWhatsApp} activeOpacity={0.85}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
            <Text style={vStyles.waBtnText}>Book via WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const vStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(140,198,63,0.07)', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)' },
  vehicleIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(140,198,63,0.12)', justifyContent: 'center', alignItems: 'center' },
  vehicleName: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  vehicleType: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  typeBtnOn: { backgroundColor: 'rgba(140,198,63,0.1)', borderColor: 'rgba(140,198,63,0.35)' },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)', flex: 1 },
  typeBtnPrice: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  minDaysNote: { fontSize: 11, color: '#F59E0B', marginBottom: 16, marginTop: 4 },
  calendarWrap: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16 },
  dateSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  dateBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  dateBoxLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  dateBoxValue: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  kmInput: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 6 },
  kmTextInput: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '600' },
  kmSuffix: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  kmNote: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 20 },
  unlimitedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(140,198,63,0.25)', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  unlimitedBadgeText: { fontSize: 13, fontWeight: '700', color: GREEN },
  driverOptions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  driverBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  driverBtnOn: { backgroundColor: 'rgba(140,198,63,0.1)', borderColor: 'rgba(140,198,63,0.3)' },
  driverBtnText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  costCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  costTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  costLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
  costValue: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  costDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  costTotalLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  costTotalValue: { color: GREEN, fontSize: 22, fontWeight: '900' },
  costNote: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 10, fontStyle: 'italic' },
  footer: { padding: 20, paddingBottom: 30, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 10 },
  footerSummary: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' },
  waBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 16 },
  waBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

// ─── Guide hire (existing) ────────────────────────────────────────────────────

function GuideHireScreen({ id, name, price }: { id: string; name: string; price: string }) {
  const ratePerDay = parseInt(price || '0', 10);
  const [selectedDates, setSelectedDates] = useState<{ [key: string]: any }>({});
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [tripLocation, setTripLocation] = useState('');
  const [specializationNeeded, setSpecializationNeeded] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [cancellationPolicy, setCancellationPolicy] = useState('moderate');

  useEffect(() => {
    if (!id) return;
    const loadBlocked = async () => {
      const [{ data: avail }, { data: bookings }, { data: guide }] = await Promise.all([
        supabase.from('guide_availability').select('date').eq('guide_id', id).eq('is_available', false),
        supabase.from('bookings').select('start_date, end_date').eq('resource_id', id).eq('resource_type', 'guide').in('status', ['pending', 'confirmed']),
        supabase.from('guides').select('cancellation_policy').eq('id', id).single(),
      ]);
      const blocked = new Set<string>();
      (avail || []).forEach((r: any) => blocked.add(r.date));
      (bookings || []).forEach((b: any) => {
        const d = new Date(b.start_date);
        const end = new Date(b.end_date);
        while (d < end) { blocked.add(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
      });
      setBlockedDates(blocked);
      if (guide?.cancellation_policy) setCancellationPolicy(guide.cancellation_policy);
    };
    loadBlocked();
  }, [id]);

  const blockedMarks = useMemo(() => {
    const marks: { [key: string]: any } = {};
    blockedDates.forEach(d => {
      marks[d] = { disabled: true, disableTouchEvent: true, color: 'rgba(239,68,68,0.25)', textColor: '#EF4444' };
    });
    return marks;
  }, [blockedDates]);

  const markedDates = useMemo(() => ({ ...blockedMarks, ...selectedDates }), [blockedMarks, selectedDates]);

  const onDayPress = (day: { dateString: string }) => {
    if (blockedDates.has(day.dateString)) return;
    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate(null);
      setSelectedDates({ [day.dateString]: { startingDay: true, color: GREEN, textColor: 'white' } });
    } else {
      if (day.dateString < startDate) {
        setStartDate(day.dateString);
        setEndDate(null);
        setSelectedDates({ [day.dateString]: { startingDay: true, color: GREEN, textColor: 'white' } });
      } else {
        const rangeBlocked: string[] = [];
        let cur = new Date(startDate);
        const last = new Date(day.dateString);
        while (cur <= last) {
          const ds = cur.toISOString().split('T')[0];
          if (blockedDates.has(ds)) rangeBlocked.push(ds);
          cur.setDate(cur.getDate() + 1);
        }
        if (rangeBlocked.length > 0) {
          Alert.alert('Dates Unavailable', 'Your selected range includes blocked or booked dates.');
          return;
        }
        setEndDate(day.dateString);
        const range: { [key: string]: any } = {};
        let currentDate = new Date(startDate);
        while (currentDate <= last) {
          const dateStr = currentDate.toISOString().split('T')[0];
          if (dateStr === startDate) range[dateStr] = { startingDay: true, color: GREEN, textColor: 'white' };
          else if (dateStr === day.dateString) range[dateStr] = { endingDay: true, color: GREEN, textColor: 'white' };
          else range[dateStr] = { color: 'rgba(140,198,63,0.25)', textColor: 'white' };
          currentDate.setDate(currentDate.getDate() + 1);
        }
        setSelectedDates(range);
      }
    }
  };

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  }, [startDate, endDate]);

  const totalPrice = days * ratePerDay;

  const handleHire = async () => {
    if (!startDate || !endDate) { Alert.alert('Select Dates', 'Please select start and end dates.'); return; }
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) { Alert.alert('Login Required', 'You must be logged in to hire a guide.'); router.push('/login' as any); return; }
      const tripDates = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
      const { error } = await supabase.from('guide_inquiries').insert({
        guide_id: id,
        user_id: authData.user.id,
        trip_dates: tripDates,
        location: tripLocation || null,
        group_size: guests,
        specialization_needed: specializationNeeded || null,
        message: message || null,
        status: 'new',
      });
      if (error) throw error;
      Alert.alert(
        'Request Sent! 🧭',
        `Your inquiry has been sent to ${name}.\n\nTrekRiderz team will confirm your booking within 24 hours.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit inquiry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={gStyles.container}>
      <View style={gStyles.header}>
        <TouchableOpacity style={gStyles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={gStyles.headerTitle}>Hire Guide</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gStyles.scrollContent}>
        <View style={gStyles.guideCard}>
          <View style={gStyles.guideIconWrap}><Ionicons name="person-outline" size={24} color={GREEN} /></View>
          <View style={{ flex: 1 }}>
            <Text style={gStyles.guideName} numberOfLines={1}>{name || 'Guide'}</Text>
            <Text style={gStyles.guideRate}>₹{ratePerDay.toLocaleString('en-IN')} / day</Text>
          </View>
        </View>
        <View style={gStyles.section}>
          <Text style={gStyles.sectionTitle}>Select Trip Dates</Text>
          <View style={gStyles.calendarWrap}>
            <Calendar onDayPress={onDayPress} markedDates={markedDates} markingType="period"
              theme={{ backgroundColor: 'transparent', calendarBackground: 'transparent', textSectionTitleColor: 'rgba(255,255,255,0.5)', selectedDayBackgroundColor: GREEN, selectedDayTextColor: '#FFF', todayTextColor: GREEN, dayTextColor: '#FFF', textDisabledColor: 'rgba(255,255,255,0.2)', monthTextColor: '#FFF', arrowColor: GREEN }}
              minDate={TODAY}
            />
          </View>
          <View style={gStyles.calendarLegend}>
            <View style={gStyles.legendItem}><View style={[gStyles.legendDot, { backgroundColor: GREEN }]} /><Text style={gStyles.legendText}>Selected</Text></View>
            <View style={gStyles.legendItem}><View style={[gStyles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={gStyles.legendText}>Unavailable</Text></View>
          </View>
          <View style={gStyles.policyNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={GREEN} />
            <Text style={gStyles.policyNoteText}>
              {cancellationPolicy === 'flexible' ? 'Free cancellation up to 24h before start'
                : cancellationPolicy === 'moderate' ? 'Free cancellation up to 48h before start'
                : 'Non-refundable after booking'}
            </Text>
          </View>
        </View>
        {(startDate || endDate) && (
          <View style={gStyles.dateSummaryRow}>
            <View style={gStyles.dateSummaryBox}><Text style={gStyles.dateSummaryLabel}>Start Date</Text><Text style={gStyles.dateSummaryValue}>{startDate || '—'}</Text></View>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.3)" />
            <View style={gStyles.dateSummaryBox}><Text style={gStyles.dateSummaryLabel}>End Date</Text><Text style={gStyles.dateSummaryValue}>{endDate || '—'}</Text></View>
          </View>
        )}
        <View style={gStyles.section}>
          <Text style={gStyles.sectionTitle}>Group Size</Text>
          <View style={gStyles.counterRow}>
            <TouchableOpacity style={gStyles.counterBtn} onPress={() => setGuests(Math.max(1, guests - 1))}><Ionicons name="remove" size={20} color={GREEN} /></TouchableOpacity>
            <Text style={gStyles.counterValue}>{guests}</Text>
            <TouchableOpacity style={gStyles.counterBtn} onPress={() => setGuests(Math.min(20, guests + 1))}><Ionicons name="add" size={20} color={GREEN} /></TouchableOpacity>
            <Text style={gStyles.counterLabel}>{guests === 1 ? 'Person' : 'People'}</Text>
          </View>
        </View>
        <View style={gStyles.section}>
          <Text style={gStyles.sectionTitle}>Trip Location</Text>
          <TextInput
            style={gStyles.messageInput}
            placeholder="Where do you want to trek? e.g. Coorg, Chikmagalur"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={tripLocation}
            onChangeText={setTripLocation}
          />
        </View>
        <View style={gStyles.section}>
          <Text style={gStyles.sectionTitle}>Specialization Needed (Optional)</Text>
          <TextInput
            style={gStyles.messageInput}
            placeholder="e.g. Trekking, Bird Watching, Photography Tour"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={specializationNeeded}
            onChangeText={setSpecializationNeeded}
          />
        </View>
        <View style={gStyles.section}>
          <Text style={gStyles.sectionTitle}>Message (Optional)</Text>
          <TextInput style={gStyles.messageInput} placeholder="Tell the guide about your trip plans, experience level, etc." placeholderTextColor="rgba(255,255,255,0.3)" value={message} onChangeText={setMessage} multiline numberOfLines={4} textAlignVertical="top" />
        </View>
        {days > 0 && (
          <View style={gStyles.priceSummaryCard}>
            <Text style={gStyles.priceSummaryTitle}>Cost Estimate</Text>
            <View style={gStyles.priceRow}>
              <Text style={gStyles.priceRowLabel}>₹{ratePerDay.toLocaleString('en-IN')} × {days} {days === 1 ? 'day' : 'days'}</Text>
              <Text style={gStyles.priceRowValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <View style={gStyles.priceDivider} />
            <View style={gStyles.priceRow}>
              <Text style={gStyles.totalLabel}>Estimated Total</Text>
              <Text style={gStyles.totalValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <Text style={gStyles.paymentNote}>Payment to be settled directly with the guide.</Text>
          </View>
        )}
      </ScrollView>
      <View style={gStyles.footer}>
        {days > 0 && <Text style={gStyles.footerSummary}>{days} {days === 1 ? 'day' : 'days'} · ₹{totalPrice.toLocaleString('en-IN')}</Text>}
        <TouchableOpacity style={[gStyles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleHire} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={gStyles.submitBtnText}>Send Inquiry</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const gStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  guideCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  guideIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(140,198,63,0.12)', justifyContent: 'center', alignItems: 'center' },
  guideName: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  guideRate: { color: GREEN, fontSize: 14, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  calendarWrap: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  dateSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  dateSummaryBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dateSummaryLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  dateSummaryValue: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  counterValue: { color: '#FFF', fontSize: 22, fontWeight: '700', minWidth: 30, textAlign: 'center' },
  counterLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  messageInput: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#FFF', padding: 14, fontSize: 14, minHeight: 100 },
  priceSummaryCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  priceSummaryTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  priceRowLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  priceRowValue: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  priceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  totalLabel: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  totalValue: { color: GREEN, fontSize: 20, fontWeight: '800' },
  paymentNote: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  footer: { padding: 20, paddingBottom: 30, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 12 },
  footerSummary: { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center' },
  submitBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  calendarLegend: { flexDirection: 'row', gap: 16, paddingHorizontal: 4, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  policyNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(140,198,63,0.08)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(140,198,63,0.2)' },
  policyNoteText: { color: GREEN, fontSize: 12, flex: 1 },
});

// ─── Root: route by type param ────────────────────────────────────────────────

export default function HireScreen() {
  const { id, name, price, type } = useLocalSearchParams<{ id: string; name: string; price: string; type: string }>();

  if (type === 'vehicle') {
    return <VehicleHireScreen id={id} />;
  }
  return <GuideHireScreen id={id} name={name} price={price} />;
}
