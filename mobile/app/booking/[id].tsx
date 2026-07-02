import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Calendar } from 'react-native-calendars';

export default function BookingScreen() {
  const { id, name, price, type } = useLocalSearchParams<{
    id: string;
    name: string;
    price: string;
    type: string;
  }>();

  const { user } = useAuthStore();
  const [userProfile, setUserProfile] = useState<{ email: string; phone: string } | null>(null);

  const pricePerNight = parseInt(price || '0', 10);
  const [selectedDates, setSelectedDates] = useState<{ [key: string]: any }>({});
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [loading, setLoading] = useState(false);
  const [blockedDates, setBlockedDates] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    fetchBlockedDates();
    fetchUserProfile();
  }, [id, user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('email, phone')
        .eq('id', user.id)
        .single();
      if (data) {
        setUserProfile({
          email: data.email || user.email || '',
          phone: data.phone || '',
        });
      } else {
        setUserProfile({ email: user.email || '', phone: '' });
      }
    } catch (e) {
      setUserProfile({ email: user.email || '', phone: '' });
    }
  };

  const [cancellationPolicy, setCancellationPolicy] = useState('moderate');

  const fetchBlockedDates = async () => {
    try {
      const [{ data: bookings }, { data: avail }, { data: homestay }] = await Promise.all([
        supabase.from('bookings').select('start_date, end_date')
          .eq('resource_id', id).in('status', ['pending', 'confirmed']),
        supabase.from('homestay_availability').select('date')
          .eq('homestay_id', id).eq('is_available', false),
        supabase.from('homestays').select('cancellation_policy').eq('id', id).single(),
      ]);

      const blocked: { [key: string]: any } = {};
      const markBlocked = (dateStr: string) => {
        blocked[dateStr] = { disabled: true, disableTouchEvent: true, color: '#374151', textColor: '#9CA3AF' };
      };
      (bookings || []).forEach((b: any) => {
        let current = new Date(b.start_date);
        const end = new Date(b.end_date);
        while (current <= end) { markBlocked(current.toISOString().split('T')[0]); current.setDate(current.getDate() + 1); }
      });
      (avail || []).forEach((r: any) => markBlocked(r.date));
      setBlockedDates(blocked);
      if (homestay?.cancellation_policy) setCancellationPolicy(homestay.cancellation_policy);
    } catch (e) {
      if (__DEV__) console.log('Error fetching blocked dates', e);
    }
  };

  const markedDates = { ...blockedDates, ...selectedDates };

  const onDayPress = (day: { dateString: string }) => {
    if (blockedDates[day.dateString]) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate(null);
      setSelectedDates({
        [day.dateString]: { startingDay: true, color: '#8CC63F', textColor: 'white' },
      });
    } else {
      if (day.dateString < startDate) {
        setStartDate(day.dateString);
        setEndDate(null);
        setSelectedDates({
          [day.dateString]: { startingDay: true, color: '#8CC63F', textColor: 'white' },
        });
      } else {
        setEndDate(day.dateString);
        const range: { [key: string]: any } = {};
        let currentDate = new Date(startDate);
        const lastDate = new Date(day.dateString);
        while (currentDate <= lastDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          if (dateStr === startDate) {
            range[dateStr] = { startingDay: true, color: '#8CC63F', textColor: 'white' };
          } else if (dateStr === day.dateString) {
            range[dateStr] = { endingDay: true, color: '#8CC63F', textColor: 'white' };
          } else {
            range[dateStr] = { color: 'rgba(140,198,63,0.25)', textColor: 'white' };
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        setSelectedDates(range);
      }
    }
  };

  const nights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  const totalPrice = nights * pricePerNight;

  const handleBooking = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Select Dates', 'Please select check-in and check-out dates');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_booking_request', {
        p_resource_id: id,
        p_type: type || 'homestay',
        p_start_date: startDate,
        p_end_date: endDate,
        p_guests: guests,
        p_total_price: totalPrice,
      });

      if (error) throw error;

      if (data.success) {
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment', {
          body: {
            bookingId: data.booking_id,
            amount: totalPrice,
            description: `Booking for ${name}`,
            userEmail: userProfile?.email || user?.email || '',
            userPhone: userProfile?.phone || '',
          },
        });

        if (paymentError) {
          Alert.alert(
            'Payment Error',
            'Booking created but payment link failed. Please try again from My Bookings.'
          );
          router.push('/(tabs)/profile');
          return;
        }

        if (paymentData?.paymentLink) {
          const { Linking } = require('react-native');
          Linking.openURL(paymentData.paymentLink);
          Alert.alert(
            'Payment Started',
            'Please complete the payment in the browser. Your booking will be confirmed once paid.',
            [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
          );
        }
      } else {
        Alert.alert('Booking Failed', data.message || 'Dates might be unavailable');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      Alert.alert('Error', error.message || 'Failed to submit booking request');
    } finally {
      setLoading(false);
    }
  };

  const unitLabel = type === 'guide' ? 'day' : 'night';
  const unitLabelPlural = type === 'guide' ? 'days' : 'nights';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Now</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Property / Guide Info */}
        <View style={styles.propertyCard}>
          <View style={styles.propertyIconWrap}>
            <Ionicons
              name={type === 'guide' ? 'person-outline' : 'home-outline'}
              size={24}
              color="#8CC63F"
            />
          </View>
          <View style={styles.propertyInfo}>
            <Text style={styles.propertyName} numberOfLines={2}>{name || 'Property'}</Text>
            <Text style={styles.propertyRate}>
              ₹{pricePerNight.toLocaleString('en-IN')} / {unitLabel}
            </Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Dates</Text>
          <View style={styles.calendarWrap}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={markedDates}
              markingType="period"
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: 'transparent',
                textSectionTitleColor: 'rgba(255,255,255,0.5)',
                selectedDayBackgroundColor: '#8CC63F',
                selectedDayTextColor: '#FFF',
                todayTextColor: '#8CC63F',
                dayTextColor: '#FFF',
                textDisabledColor: 'rgba(255,255,255,0.2)',
                dotColor: '#8CC63F',
                monthTextColor: '#FFF',
                arrowColor: '#8CC63F',
                indicatorColor: '#8CC63F',
              }}
              minDate={new Date().toISOString().split('T')[0]}
            />
          </View>
          <View style={styles.policyNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#8CC63F" />
            <Text style={styles.policyNoteText}>
              {cancellationPolicy === 'flexible' ? 'Free cancellation up to 24h before check-in'
                : cancellationPolicy === 'moderate' ? 'Free cancellation up to 48h before check-in'
                : 'Non-refundable after booking'}
            </Text>
          </View>
        </View>

        {/* Date Summary Row */}
        {(startDate || endDate) && (
          <View style={styles.dateSummaryRow}>
            <View style={styles.dateSummaryBox}>
              <Text style={styles.dateSummaryLabel}>
                {type === 'guide' ? 'Start Date' : 'Check-in'}
              </Text>
              <Text style={styles.dateSummaryValue}>{startDate || '—'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.3)" />
            <View style={styles.dateSummaryBox}>
              <Text style={styles.dateSummaryLabel}>
                {type === 'guide' ? 'End Date' : 'Check-out'}
              </Text>
              <Text style={styles.dateSummaryValue}>{endDate || '—'}</Text>
            </View>
          </View>
        )}

        {/* Guests Counter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guests</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setGuests(Math.max(1, guests - 1))}
            >
              <Ionicons name="remove" size={20} color="#8CC63F" />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{guests}</Text>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setGuests(Math.min(20, guests + 1))}
            >
              <Ionicons name="add" size={20} color="#8CC63F" />
            </TouchableOpacity>
            <Text style={styles.counterLabel}>
              {guests === 1 ? 'Guest' : 'Guests'}
            </Text>
          </View>
        </View>

        {/* Price Summary */}
        {nights > 0 && (
          <View style={styles.priceSummaryCard}>
            <Text style={styles.priceSummaryTitle}>Price Summary</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceRowLabel}>
                ₹{pricePerNight.toLocaleString('en-IN')} × {nights} {nights === 1 ? unitLabel : unitLabelPlural}
              </Text>
              <Text style={styles.priceRowValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        {nights > 0 && (
          <Text style={styles.footerSummary}>
            {nights} {nights === 1 ? unitLabel : unitLabelPlural} · ₹{totalPrice.toLocaleString('en-IN')}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
          onPress={handleBooking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm Booking</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  propertyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  propertyInfo: {
    flex: 1,
  },
  propertyName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  propertyRate: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  calendarWrap: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dateSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  dateSummaryBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dateSummaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dateSummaryValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#8CC63F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  counterLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  priceSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  priceSummaryTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceRowLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  priceRowValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  priceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  totalLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    color: '#8CC63F',
    fontSize: 20,
    fontWeight: '800',
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  footerSummary: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  policyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(140,198,63,0.2)',
  },
  policyNoteText: {
    color: '#8CC63F',
    fontSize: 12,
    flex: 1,
  },
});
