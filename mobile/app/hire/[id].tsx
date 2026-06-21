import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Calendar } from 'react-native-calendars';

export default function HireGuideScreen() {
  const { id, name, price, type } = useLocalSearchParams<{
    id: string;
    name: string;
    price: string;
    type: string;
  }>();

  const ratePerDay = parseInt(price || '0', 10);
  const [selectedDates, setSelectedDates] = useState<{ [key: string]: any }>({});
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onDayPress = (day: { dateString: string }) => {
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

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const totalPrice = days * ratePerDay;

  const handleHire = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Select Dates', 'Please select start and end dates for the trip');
      return;
    }

    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user?.id) {
        Alert.alert('Login Required', 'You must be logged in to hire a guide');
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: authData.user.id,
          resource_type: 'guide',
          resource_id: id,
          start_date: startDate,
          end_date: endDate,
          guests_count: guests,
          total_price: totalPrice,
          status: 'pending',
          payment_status: 'unpaid',
          special_requests: message || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        Alert.alert(
          'Request Submitted!',
          `Your request to hire ${name} for ${days} day${days > 1 ? 's' : ''} at ₹${totalPrice.toLocaleString('en-IN')} has been submitted.\n\nPayment can be made via:\n• Cash on arrival\n• Bank Transfer\n• UPI\n\nThe guide will contact you to confirm.`,
          [
            {
              text: 'View My Bookings',
              onPress: () => router.push('/bookings'),
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Hire error:', error);
      Alert.alert('Error', error.message || 'Failed to submit booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hire Guide</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Guide Info */}
        <View style={styles.guideCard}>
          <View style={styles.guideIconWrap}>
            <Ionicons name="person-outline" size={24} color="#8CC63F" />
          </View>
          <View style={styles.guideInfo}>
            <Text style={styles.guideName} numberOfLines={1}>{name || 'Guide'}</Text>
            <Text style={styles.guideRate}>₹{ratePerDay.toLocaleString('en-IN')} / day</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Trip Dates</Text>
          <View style={styles.calendarWrap}>
            <Calendar
              onDayPress={onDayPress}
              markedDates={selectedDates}
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
              }}
              minDate={new Date().toISOString().split('T')[0]}
            />
          </View>
        </View>

        {/* Date Summary */}
        {(startDate || endDate) && (
          <View style={styles.dateSummaryRow}>
            <View style={styles.dateSummaryBox}>
              <Text style={styles.dateSummaryLabel}>Start Date</Text>
              <Text style={styles.dateSummaryValue}>{startDate || '—'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.3)" />
            <View style={styles.dateSummaryBox}>
              <Text style={styles.dateSummaryLabel}>End Date</Text>
              <Text style={styles.dateSummaryValue}>{endDate || '—'}</Text>
            </View>
          </View>
        )}

        {/* Guests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Size</Text>
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
            <Text style={styles.counterLabel}>{guests === 1 ? 'Person' : 'People'}</Text>
          </View>
        </View>

        {/* Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message to Guide (Optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Tell the guide about your trip plans, experience level, etc."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Price Summary */}
        {days > 0 && (
          <View style={styles.priceSummaryCard}>
            <Text style={styles.priceSummaryTitle}>Cost Estimate</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceRowLabel}>
                ₹{ratePerDay.toLocaleString('en-IN')} × {days} {days === 1 ? 'day' : 'days'}
              </Text>
              <Text style={styles.priceRowValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.priceDivider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Estimated Total</Text>
              <Text style={styles.totalValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.paymentNote}>
              Payment to be settled directly with the guide.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        {days > 0 && (
          <Text style={styles.footerSummary}>
            {days} {days === 1 ? 'day' : 'days'} · ₹{totalPrice.toLocaleString('en-IN')}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleHire}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Send Hire Request</Text>
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
  guideCard: {
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
  guideIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(140,198,63,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideInfo: {
    flex: 1,
  },
  guideName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  guideRate: {
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
  messageInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    padding: 14,
    fontSize: 14,
    minHeight: 100,
  },
  priceSummaryCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
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
  paymentNote: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 10,
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  footerSummary: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
