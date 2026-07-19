#!/usr/bin/env node

/**
 * Send test app reminders to all testers
 * Usage: node send-test-reminders.js [--now] [--schedule]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './mobile/.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE env vars. Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getMessageForTime() {
  const now = new Date();
  const hours = now.getHours();

  if (hours >= 12 && hours < 14) {
    return {
      type: 'lunch',
      title: '🍽️ Lunchtime Reminder',
      message: "🍽️ It's lunch time! Don't forget to test TrekRiderz and help us launch.",
    };
  } else if (hours >= 19 && hours < 21) {
    return {
      type: 'dinner',
      title: '🍽️ Dinner Time Reminder',
      message: '🍽️ Dinner time! Test TrekRiderz and share your feedback.',
    };
  } else {
    return {
      type: 'reminder',
      title: '🏔️ Test TrekRiderz',
      message: '🏔️ Time to test TrekRiderz! Help us make it better.',
    };
  }
}

async function sendRemindersNow() {
  console.log('📤 Sending test reminders...\n');

  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, push_token')
      .not('push_token', 'is', null);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      console.log('❌ No users with push tokens found');
      return;
    }

    console.log(`✅ Found ${users.length} testers with push tokens\n`);

    const messageData = await getMessageForTime();
    console.log(`📝 Message Type: ${messageData.type}`);
    console.log(`📝 Title: ${messageData.title}`);
    console.log(`📝 Body: ${messageData.message}\n`);

    // Create notification records
    const notificationRecords = users.map((user) => ({
      user_id: user.id,
      type: messageData.type,
      title: messageData.title,
      message: messageData.message,
      data: {
        reminder_type: messageData.type,
        sent_at: new Date().toISOString(),
      },
      read: false,
    }));

    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .insert(notificationRecords);

    if (notifError) throw notifError;

    console.log(`✅ Created ${notificationRecords.length} notification records in database\n`);

    // Send push notifications via Expo
    const pushTokens = users
      .filter((u) => u.push_token)
      .map((u) => u.push_token);

    if (pushTokens.length > 0) {
      console.log('📱 Sending push notifications via Expo...');
      try {
        const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: pushTokens,
            title: messageData.title,
            body: messageData.message,
            data: { type: messageData.type },
            priority: 'high',
            badge: 1,
            sound: 'default',
          }),
        });

        const expoData = await expoResponse.json();
        console.log(`✅ Expo response:`, expoData);
      } catch (expoError) {
        console.error('⚠️  Expo push notification error:', expoError.message);
      }
    }

    console.log(`\n✅ Reminders sent to ${users.length} testers!`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run immediately
sendRemindersNow();
