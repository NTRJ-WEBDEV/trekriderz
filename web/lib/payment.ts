'use client';

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
  userName?: string;
  description: string;
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
    console.log('Creating offline booking:', options.bookingId, 'Amount:', options.amount);
    
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
 * Get offline payment instructions
 */
export const getOfflinePaymentInstructions = (amount: number): string => {
  return `Your booking request of ₹${amount} has been created.\n\nPayment Methods:\n• Cash on arrival\n• Bank Transfer\n• UPI\n• Cheque\n\nThe host will contact you with payment details within 24 hours.`;
};

export const handleBookingError = (error: string): Error => {
  return new Error(error || 'Could not create booking request');
};
