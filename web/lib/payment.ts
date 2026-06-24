'use client';

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
  paymentId?: string;
  error?: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const initiatePayment = async (
  options: PaymentOptions
): Promise<PaymentResponse> => {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    return { success: false, error: 'Failed to load payment gateway' };
  }

  let orderId: string;
  let orderAmount: number;

  try {
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: options.amount,
        booking_id: options.bookingId,
        description: options.description,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Order creation failed');
    orderId = data.order_id;
    orderAmount = data.amount;
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  return new Promise((resolve) => {
    const rzp = new (window as any).Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: orderAmount,
      currency: 'INR',
      order_id: orderId,
      name: 'TrekRiderz',
      description: options.description,
      prefill: {
        name: options.userName || '',
        email: options.userEmail,
        contact: options.userPhone,
      },
      theme: { color: '#F97316' },
      modal: {
        ondismiss: () => resolve({ success: false, error: 'Payment cancelled' }),
      },
      handler: async (response: any) => {
        try {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: options.bookingId,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.verified) {
            resolve({ success: true, bookingId: options.bookingId, paymentId: response.razorpay_payment_id });
          } else {
            resolve({ success: false, error: 'Payment verification failed' });
          }
        } catch {
          resolve({ success: false, error: 'Payment verification error' });
        }
      },
    });

    rzp.on('payment.failed', (response: any) => {
      resolve({ success: false, error: response.error?.description || 'Payment failed' });
    });

    rzp.open();
  });
};
