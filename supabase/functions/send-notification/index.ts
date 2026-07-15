import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Consolidates the previously-separate send-notification and
// send-push-notification functions. Accepts either shape:
//   - Supabase Database Webhook payload: { type, table, record, old_record }
//   - Direct call:                       { userId, title, body, data }
// Deployed with verify_jwt disabled (Postgres/pg_net can't present a user
// JWT), so every request must carry a matching x-function-secret header —
// the same shared secret stored in Postgres Vault as 'edge_function_secret'
// and used by the notifications-table trigger and the daily-reminder cron.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')

serve(async (req) => {
  if (FUNCTION_SECRET && req.headers.get('x-function-secret') !== FUNCTION_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()

    const userId = body.record?.user_id ?? body.userId
    const title = body.record?.title ?? body.title
    const message = body.record?.message ?? body.body

    // Previously this only forwarded record.metadata (which none of the
    // trigger functions ever populate) — the row's own type/related_id/
    // sender_id never made it into the push payload at all, so the
    // on-device tap handler's `data?.type` check could never match
    // anything. Base identifying fields always go through; metadata (e.g.
    // { post_id } from the like/comment triggers) layers on top.
    const data = body.record
      ? {
          type: body.record.type,
          related_id: body.record.related_id,
          sender_id: body.record.sender_id,
          ...(body.record.metadata || {}),
        }
      : body.data ?? {}

    if (!userId || !title || !message) {
      return new Response(JSON.stringify({ error: 'Missing user_id/title/message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single()

    if (userError || !userRow?.push_token) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no push token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: userRow.push_token,
        sound: 'default',
        title,
        body: message,
        data,
      }),
    })

    const result = await expoRes.json()
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
