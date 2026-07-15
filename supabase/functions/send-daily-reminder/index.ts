import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Re-engagement push for testers who haven't opened the app today, per
// user_daily_activity. Scheduled via pg_cron (see the
// schedule_daily_reminder migration) — the cron job just POSTs here with
// the shared secret; all the querying/sending logic lives in this function
// so the schedule itself stays a one-line cron.schedule() call.
//
// Message text lives here as plain constants — tweak wording without
// touching the query/send logic below.
const REMINDER_TITLE = '🥾 Haven’t seen you today!'
const REMINDER_BODY = 'Open TrekRiderz and help us test — 2 min a day 🎁'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')
const EXPO_BATCH_SIZE = 90 // Expo's push API accepts up to 100 messages per request

serve(async (req) => {
  if (FUNCTION_SECRET && req.headers.get('x-function-secret') !== FUNCTION_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date().toISOString().split('T')[0]

    const { data: activeToday, error: activeErr } = await supabase
      .from('user_daily_activity')
      .select('user_id')
      .eq('activity_date', today)
    if (activeErr) throw activeErr
    const activeIds = new Set((activeToday ?? []).map((r: { user_id: string }) => r.user_id))

    const { data: candidates, error: usersErr } = await supabase
      .from('users')
      .select('id, push_token')
      .not('push_token', 'is', null)
    if (usersErr) throw usersErr

    const targets = (candidates ?? []).filter(
      (u: { id: string; push_token: string | null }) => !activeIds.has(u.id)
    )

    const messages = targets.map((u: { push_token: string | null }) => ({
      to: u.push_token,
      sound: 'default',
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
      data: { type: 'daily_reminder' },
    }))

    let sent = 0
    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const chunk = messages.slice(i, i + EXPO_BATCH_SIZE)
      if (chunk.length === 0) continue
      const expoRes = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      })
      if (expoRes.ok) sent += chunk.length
    }

    return new Response(
      JSON.stringify({ success: true, eligibleUsers: candidates?.length ?? 0, targeted: targets.length, sent }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
