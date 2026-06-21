import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  try {
    const { record } = await req.json();

    // 1. Get user's push token from public.users
    // We'll need a service role key to query users from an edge function
    // For now, let's assume the payload includes the token or we fetch it
    
    // Better: Fetch the user's push token based on record.user_id
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const res = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${record.user_id}&select=push_token`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    const users = await res.json();
    const pushToken = users[0]?.push_token;

    if (!pushToken) {
      return new Response(JSON.stringify({ message: 'No push token found' }), { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      });
    }

    // 2. Send to Expo
    const message = {
      to: pushToken,
      sound: 'default',
      title: record.title || 'New Notification',
      body: record.message || record.content,
      data: record.metadata || {},
    };

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const expoData = await expoRes.json();
    
    return new Response(JSON.stringify(expoData), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
})
