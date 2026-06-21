import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

serve(async (req) => {
  try {
    const { userId, title, body, data } = await req.json()

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing userId, title, or body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialize Supabase Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Get user's push token
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single()

    if (userError || !userData?.push_token) {
      return new Response(JSON.stringify({ error: 'User not found or has no push token' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Send push notification via Expo
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: userData.push_token,
        sound: 'default',
        title,
        body,
        data,
      }),
    })

    const result = await response.json()

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
