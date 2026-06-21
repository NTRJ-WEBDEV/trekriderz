import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface Booking {
  id: string;
  resource_type: 'homestay' | 'guide';
  resource_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  guests_count: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  special_requests?: string;
  created_at: string;
}

interface Resource {
  id: string;
  name: string;
  location: string;
  photos?: string[];
  contact_phone?: string;
  price_per_night?: number;
  rate_per_day?: number;
  specialization?: string;
}

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;
      setBooking(bookingData);

      if (bookingData.resource_type === 'homestay') {
        const { data } = await supabase
          .from('homestays')
          .select('id, name, location, photos, contact_phone, price_per_night')
          .eq('id', bookingData.resource_id)
          .single();
        if (data) setResource(data);
      } else if (bookingData.resource_type === 'guide') {
        const { data } = await supabase
          .from('guides')
          .select('id, name, specialization, photo_url, contact_phone, rate_per_day')
          .eq('id', bookingData.resource_id)
          .single();
        if (data) {
          setResource({
            id: data.id,
            name: data.name,
            location: data.specialization,
            photos: data.photo_url ? [data.photo_url] : undefined,
            contact_phone: data.contact_phone,
            rate_per_day: data.rate_per_day,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', booking.id);

              if (error) throw error;
              Alert.alert('Cancelled', 'Your booking has been cancelled.');
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleContactHost = () => {
    if (!resource?.contact_phone) {
      Alert.alert('Contact Info', 'Contact information not available');
      return;
    }
    Linking.openURL(`tel:${resource.contact_phone}`).catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer');
    });
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getDays = () => {
    if (!booking) return 0;
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: 'checkmark-circle' as const, label: 'Confirmed' };
      case 'pending':
        return { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: 'time' as const, label: 'Pending' };
      case 'cancelled':
        return { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: 'close-circle' as const, label: 'Cancelled' };
      case 'completed':
        return { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: 'ribbon' as const, label: 'Completed' };
      default:
        return { color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', icon: 'help-circle' as const, label: status };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking || !resource) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.2)" />
          <Text style={styles.errorText}>Booking not found</Text>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = getStatusConfig(booking.status);
  const days = getDays();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchBookingDetails(); }}
            tintColor="#8CC63F"
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg, borderColor: statusConfig.color + '40' }]}>
          <Ionicons name={statusConfig.icon} size={28} color={statusConfig.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusBannerTitle, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={styles.statusBannerSub}>
              {booking.status === 'pending'
                ? 'Awaiting confirmation from host'
                : booking.status === 'confirmed'
                ? 'Your booking is confirmed!'
                : booking.status === 'cancelled'
                ? 'This booking has been cancelled'
                : 'Trip completed'}
            </Text>
          </View>
        </View>

        {/* Resource Card */}
        <View style={styles.resourceCard}>
          <View style={styles.resourceIconWrap}>
            <Ionicons
              name={booking.resource_type === 'guide' ? 'person-outline' : 'home-outline'}
              size={24}
              color="#8CC63F"
            />
          </View>
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceType}>
              {booking.resource_type === 'guide' ? 'Guide Booking' : 'Homestay Booking'}
            </Text>
            <Text style={styles.resourceName}>{resource.name}</Text>
            <Text style={styles.resourceLocation}>{resource.location}</Text>
          </View>
        </View>

        {/* Booking Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Booking Information</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>
                {booking.resource_type === 'guide' ? 'Start Date' : 'Check-in'}
              </Text>
              <Text style={styles.infoCellValue}>{formatDate(booking.start_date)}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>
                {booking.resource_type === 'guide' ? 'End Date' : 'Check-out'}
              </Text>
              <Text style={styles.infoCellValue}>{formatDate(booking.end_date)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>Duration</Text>
              <Text style={styles.infoCellValue}>
                {days} {days === 1
                  ? booking.resource_type === 'guide' ? 'day' : 'night'
                  : booking.resource_type === 'guide' ? 'days' : 'nights'}
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoCell}>
              <Text style={styles.infoCellLabel}>Guests</Text>
              <Text style={styles.infoCellValue}>{booking.guests_count}</Text>
            </View>
          </View>
        </View>

        {/* Payment Summary */}
        <View style={styles.paymentCard}>
          <Text style={styles.infoCardTitle}>Payment Summary</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Total Amount</Text>
            <Text style={styles.paymentTotal}>₹{booking.total_price.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Status</Text>
            <View style={[
              styles.paymentStatusBadge,
              { backgroundColor: booking.payment_status === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }
            ]}>
              <Text style={[
                styles.paymentStatusText,
                { color: booking.payment_status === 'paid' ? '#10B981' : '#F59E0B' }
              ]}>
                {booking.payment_status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Booking ID */}
        <View style={styles.bookingIdCard}>
          <Text style={styles.bookingIdLabel}>Booking Reference</Text>
          <Text style={styles.bookingIdValue}>{booking.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {resource.contact_phone && booking.status !== 'cancelled' && (
            <TouchableOpacity style={styles.contactBtn} onPress={handleContactHost}>
              <Ionicons name="call-outline" size={18} color="#8CC63F" />
              <Text style={styles.contactBtnText}>Contact Host</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'pending' && (
            <TouchableOpacity
              style={[styles.cancelBtn, actionLoading && { opacity: 0.6 }]}
              onPress={handleCancelBooking}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scrollContent: {
    paddingBottom: 40,
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
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 12,
  },
  goBackBtn: {
    backgroundColor: '#8CC63F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  goBackBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  statusBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusBannerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  resourceIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(140,198,63,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceInfo: {
    flex: 1,
  },
  resourceType: {
    color: '#8CC63F',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  resourceName: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
  },
  resourceLocation: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  infoCardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  infoCell: {
    flex: 1,
  },
  infoDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  infoCellLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  infoCellValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  paymentCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
  },
  paymentTotal: {
    color: '#8CC63F',
    fontSize: 20,
    fontWeight: '800',
  },
  paymentStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bookingIdCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bookingIdLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  bookingIdValue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#8CC63F',
    borderRadius: 14,
    paddingVertical: 14,
  },
  contactBtnText: {
    color: '#8CC63F',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  cancelBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
