import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tripId, destination, startDate, endDate, budget, tripType, groupSize } = await req.json()

    // Calculate duration
    const start = new Date(startDate)
    const end = new Date(endDate)
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    // Prepare DeepSeek API request
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    
    const prompt = `Create a detailed ${duration}-day ${tripType} trip itinerary for ${destination} in India.

Trip Details:
- Dates: ${startDate} to ${endDate}
- Group size: ${groupSize} people
- Total budget: ₹${budget} (₹${Math.round(budget / groupSize)} per person)
- Trip type: ${tripType}

Please provide a comprehensive day-by-day itinerary in JSON format with this exact structure:
{
  "days": [
    {
      "day": 1,
      "title": "Arrival & Exploration",
      "activities": [
        {
          "time": "09:00 AM",
          "activity": "Arrive at destination",
          "description": "Check into accommodation and freshen up",
          "duration": "2 hours",
          "cost": 0
        }
      ],
      "meals": {
        "breakfast": "Hotel breakfast",
        "lunch": "Local restaurant",
        "dinner": "Street food tour"
      },
      "accommodation": "Homestay/Hotel name",
      "dailyBudget": ${Math.round(budget / duration)}
    }
  ],
  "totalCost": ${budget},
  "difficulty": "moderate",
  "safetyTips": [
    "Carry first aid kit",
    "Stay hydrated",
    "Follow local guidelines"
  ],
  "packingList": [
    "Comfortable shoes",
    "Water bottle",
    "Sunscreen"
  ],
  "bestTimeToVisit": "March to May",
  "localTips": [
    "Try local cuisine",
    "Respect local customs"
  ]
}

Make it realistic, engaging, and budget-conscious. Include specific places, timings, and costs.`

    // Call DeepSeek API
    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a professional travel planner specializing in Indian destinations. Always respond with valid JSON only, no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    })

    const deepseekData = await deepseekResponse.json()
    
    if (!deepseekResponse.ok) {
      throw new Error(`DeepSeek API error: ${JSON.stringify(deepseekData)}`)
    }

    // Extract and parse the itinerary
    let itineraryText = deepseekData.choices[0].message.content
    
    // Clean up the response (remove markdown code blocks if present)
    itineraryText = itineraryText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    const itinerary = JSON.parse(itineraryText)

    // Save itinerary to database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: updateError } = await supabaseClient
      .from('trips')
      .update({ itinerary })
      .eq('id', tripId)

    if (updateError) {
      throw new Error(`Database update error: ${updateError.message}`)
    }

    // Log the generation
    await supabaseClient
      .from('ai_prompts')
      .insert([
        {
          trip_id: tripId,
          prompt_text: prompt,
          response_text: itineraryText,
          model_used: 'deepseek-chat',
          tokens_used: deepseekData.usage?.total_tokens || 0,
        },
      ])

    return new Response(
      JSON.stringify({ 
        success: true, 
        itinerary,
        tokensUsed: deepseekData.usage?.total_tokens || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate itinerary',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
