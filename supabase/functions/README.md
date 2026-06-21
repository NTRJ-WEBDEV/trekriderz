# Supabase Edge Functions

This directory contains Supabase Edge Functions for WandR.

## Functions

### generate-itinerary

Generates AI-powered trip itineraries using DeepSeek API.

**Endpoint**: `https://shbgdegfudoemwlkesxd.supabase.co/functions/v1/generate-itinerary`

**Request Body**:

```json
{
  "tripId": "uuid",
  "destination": "Manali, Himachal Pradesh",
  "startDate": "2024-03-15",
  "endDate": "2024-03-18",
  "budget": 15000,
  "tripType": "trek",
  "groupSize": 4
}
```

**Response**:

```json
{
  "success": true,
  "itinerary": {
    "days": [...],
    "totalCost": 15000,
    "difficulty": "moderate",
    "safetyTips": [...],
    "packingList": [...]
  },
  "tokensUsed": 1234
}
```

## Deployment

To deploy this Edge Function to Supabase:

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref shbgdegfudoemwlkesxd

# Set the DeepSeek API key as a secret
npx supabase secrets set DEEPSEEK_API_KEY=your_key_here

# Deploy the function
npx supabase functions deploy generate-itinerary
```

## Local Testing

```bash
# Start Supabase locally
npx supabase start

# Serve the function locally
npx supabase functions serve generate-itinerary --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-itinerary' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"tripId":"...","destination":"Manali",...}'
```
