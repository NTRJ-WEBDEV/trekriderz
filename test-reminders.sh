#!/bin/bash

# Test Reminder - Send Now via Supabase REST API
# Make sure to set SUPABASE_SERVICE_KEY first

SUPABASE_URL="https://shbgdegfudoemwlkesxd.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoYmdkZWdmdWRvZW13bGtlc3hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDA5ODc1ODQsImV4cCI6MjA4NjU2MzU4NH0.VGAylefLL9wXV2RRAel1t05RG6Y00_FMMkk_ylZpKlY"

echo "🏔️ Sending test reminders to all testers..."
echo ""

# Get all users with push tokens
echo "📱 Fetching active testers with push tokens..."

curl -s "${SUPABASE_URL}/rest/v1/users?select=id,full_name&push_token=neq.null" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Accept: application/json" | jq '.' | head -20

echo ""
echo "✅ Script created. Follow the instructions in TEST_REMINDERS_SETUP.md"
echo ""
echo "Quick steps:"
echo "1. Go to Supabase SQL Editor"
echo "2. Copy the SQL from TEST_REMINDERS_SETUP.md"
echo "3. Run to send reminder NOW"
echo "4. Then run scheduling SQL for daily reminders"
