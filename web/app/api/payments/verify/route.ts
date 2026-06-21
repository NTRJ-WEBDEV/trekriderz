import { NextRequest, NextResponse } from 'next/server';

/**
 * OFFLINE MODE: Payment verification disabled
 * This API is kept for compatibility but returns offline payment mode response
 * POST /api/payments/verify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id } = body;

    if (!booking_id) {
      return NextResponse.json(
        { error: 'Missing booking ID', verified: false },
        { status: 400 }
      );
    }

    // In offline mode, payment is always"pending" until verified manually
    return NextResponse.json({
      verified: false,
      mode: 'offline',
      message: 'Offline payment mode - verification done by host',
      booking_id,
      status: 'pending_host_verification',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
