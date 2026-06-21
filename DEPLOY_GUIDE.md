# Deploy Supabase Edge Function - Quick Guide

## 📋 Prerequisites

- Supabase CLI installed
- Supabase account logged in
- DeepSeek API key

## 🚀 Deployment Steps

### 1. Install Supabase CLI (if not installed)

```cmd
npm install -g supabase
```

### 2. Login to Supabase

```cmd
npx supabase login
```

This will open a browser window. Login with your Supabase account.

### 3. Link Your Project

```cmd
cd c:\Users\ADMIN\.gemini\antigravity\playground\fiery-schrodinger\trailsync
npx supabase link --project-ref shbgdegfudoemwlkesxd
```

Enter your **database password** when prompted (from Supabase dashboard).

### 4. Set API Key as Secret

```cmd
npx supabase secrets set DEEPSEEK_API_KEY=sk-b9507ec441f640b3b17ed5698f60e531
```

### 5. Deploy the Function

```cmd
npx supabase functions deploy generate-itinerary
```

You should see:

```
Deploying generate-itinerary (project ref: shbgdegfudoemwlkesxd)
Bundled generate-itinerary in 123ms.
Deployed successfully!
Function URL: https://shbgdegfudoemwlkesxd.supabase.co/functions/v1/generate-itinerary
```

## ✅ Verify Deployment

### Test in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/shbgdegfudoemwlkesxd/functions
2. Click **generate-itinerary**
3. Click **Invoke** tab
4. Paste test JSON:

```json
{
  "tripId": "test-123",
  "destination": "Manali, Himachal Pradesh",
  "startDate": "2024-03-15",
  "endDate": "2024-03-18",
  "budget": 15000,
  "tripType": "trek",
  "groupSize": 4
}
```

5. Click **Invoke function**
6. Check response ✅

## 🐛 Troubleshooting

### "Not logged in"

```cmd
npx supabase login
```

### "Project not linked"

```cmd
npx supabase link --project-ref shbgdegfudoemwlkesxd
```

### "Function not found"

Check that file exists:

```
trailsync/supabase/functions/generate-itinerary/index.ts
```

### "DeepSeek API error"

Verify secret was set:

```cmd
npx supabase secrets list
```

## 📱 After Deployment

Once deployed:

1. Open WandR mobile app
2. Create a trip
3. Tap **Generate AI Itinerary**
4. Wait 10-15 seconds
5. See your AI-generated itinerary! 🎉

## 💰 DeepSeek Costs

- Average cost per itinerary: ~$0.001 (less than 1 cent!)
- 100 itineraries = ~$0.10
- Very affordable for MVP testing

---

**Ready to deploy?** Run the commands above in order! 🚀
