'use client';

import { useState } from 'react';
import { initiatePayment } from '@/lib/payment';

interface Props {
  expeditionId: string;
  expeditionTitle: string;
  packageId: string;
  packageName: string;
  pricePerPerson: number;
}

export default function BookingButton({
  expeditionId,
  expeditionTitle,
  packageId,
  packageName,
  pricePerPerson,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const handleBook = async () => {
    setLoading(true);
    setMessage(null);

    const bookingId = `${expeditionId}_${packageId}_${Date.now()}`;

    const result = await initiatePayment({
      amount: pricePerPerson,
      bookingId,
      userEmail: '',
      userPhone: '',
      description: `${expeditionTitle} — ${packageName}`,
    });

    setLoading(false);

    if (result.success) {
      setMessage({ text: 'Payment successful! Check WhatsApp for confirmation.', ok: true });
    } else if (result.error !== 'Payment cancelled') {
      setMessage({ text: result.error || 'Payment failed. Please try again.', ok: false });
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleBook}
        disabled={loading}
        className="w-full btn-accent py-4 rounded-full font-bold text-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing…' : `Book ${packageName} — ₹${pricePerPerson.toLocaleString()}`}
      </button>
      {message && (
        <p className={`text-xs text-center ${message.ok ? 'text-green-400' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
