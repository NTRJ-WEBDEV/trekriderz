import { Alert } from 'react-native';

/**
 * OFFLINE PAYMENT MODE ONLY
 * - Bookings are created but marked as 'unpaid'
 * - Users can pay offline (cash, bank transfer, UPI, etc.)
 * - No online payment gateway integration
 */

export interface PaymentOptions {
  amount: number;
  bookingId: string;
  userEmail: string;
  userPhone: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface PaymentResponse {
  success: boolean;
  bookingId?: string;
  paymentMethod?: 'offline' | 'pending';
  error?: string;
}

/**
 * Create offline booking (no online payment)
 */
export const initiateOfflinePayment = async (
  options: PaymentOptions
): Promise<PaymentResponse> => {
  try {
    console.log('Creating offline booking:', options.bookingId);
    
    return {
      success: true,
      bookingId: options.bookingId,
      paymentMethod: 'offline',
    };
  } catch (error) {
    return {
      success: false,
      error: `Offline booking failed: ${error}`,
    };
  }
};

/**
 * Show offline payment instructions to user
 */
export const handleOfflinePayment = async (
  bookingId: string,
  amount: number,
  onSuccess: (bookingId: string) => void
): Promise<void> => {
  Alert.alert(
    'Booking Request Sent ✓',
    `Your booking request of ₹${amount} has been created.\n\nPayment Methods:\n• Cash on arrival\n• Bank Transfer\n• UPI\n• Check\n\nThe host will contact you with payment details.`,
    [
      {
        text: 'Got it',
        onPress: () => onSuccess(bookingId),
      },
    ]
  );
};

export const handleBookingError = (error: string): void => {
  Alert.alert('Booking Error', error || 'Could not create booking request');
};
