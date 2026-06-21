import { NextRequest, NextResponse } from 'next/server';

/**
 * OFFLINE MODE: Order creation disabled
 * This API is kept for compatibility but returns offline payment mode response
 * POST /api/payments/create-order
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, booking_id, description } = body;

    if (!amount || !booking_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // In offline mode, return mock order ID
    return NextResponse.json({
      orderId: `offline_order_${booking_id}_${Date.now()}`,
      amount,
      currency: 'INR',
      mode: 'offline',
      paymentMethod: 'offline',
      message: 'Offline mode - payment will be collected offline',
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
