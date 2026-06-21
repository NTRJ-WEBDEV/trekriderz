import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId, amount, description, userEmail, userPhone } = await req.json()

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    
    // Create Basic Auth header for Razorpay
    const auth = btoa(`${keyId}:${keySecret}`)

    // Create Payment Link via Razorpay API
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amount * 100, // Amount in paise
        currency: "INR",
        accept_partial: false,
        description: description,
        customer: {
          name: userEmail?.split('@')[0] || "Customer",
          email: userEmail,
          contact: userPhone || "+919999999999"
        },
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        notes: {
          booking_id: bookingId
        },
        callback_url: "https://trailsync.app/payment-success", // In real app, deep link schema
        callback_method: "get"
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to create payment link')
    }

    // Update booking with payment link ID (optional, but good for tracking)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient
      .from('bookings')
      .update({ 
        payment_status: 'pending',
        // In a real app, store the razorpay_payment_link_id here
      })
      .eq('id', bookingId)

    return new Response(
      JSON.stringify({ 
        paymentLink: data.short_url,
        id: data.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
