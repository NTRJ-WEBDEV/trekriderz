import { NextRequest, NextResponse } from 'next/server';

// Priority: Gemini Flash (free) → Groq Llama (free) → GPT-4o-mini (cheap)
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const TRIP_TYPE_CONTEXT: Record<string, string> = {
  trek: 'Mountain/trail trek. Focus on trail conditions, altitude gain, fitness prep, emergency contacts on route.',
  weekend: 'Short 2-3 day getaway. Prioritise easy travel, comfort, local food experiences, relaxation.',
  birthday: 'Birthday celebration trip! Include festive touches — surprise arrangements, special meals, group photo spots, a memorable highlight activity. Make it feel personal and joyful.',
  anniversary: 'Romantic anniversary. Include intimate experiences, scenic sunset/sunrise viewpoints for couples, a candlelight dinner suggestion, private quiet moments, rose petal arrangements if homestay allows.',
  honeymoon: 'Honeymoon trip. Maximum privacy and romance. Luxury homestay preference, couple-only activities, scenic beauty, no crowded tourist spots, private dining.',
  women_solo: 'SOLO WOMEN TRAVELERS — Safety is the #1 priority. MUST prefer women local guides. Include women-friendly accommodation (locked doors, female staff), safe transport, emergency contacts, women traveler community tips. Frame as empowering, not cautionary.',
  spiritual: 'Spiritual journey — temples, monasteries, ghats, meditation centres. Include darshan timings, appropriate dress codes, silence norms, local pujari contact, best rituals to participate in.',
  wildlife: 'Wildlife safari. Include dawn/dusk safari slots, forest rules, best zones, photography tips, wildlife spotter guide preference, nearest veterinary/forest helpline.',
  bike: 'Motorcycle/bike tour. Include fuel stations en route, road conditions, bike-friendly stay, daily ride distance limits, mechanic contacts, emergency highway helpline.',
  photography: 'Photography trip. Include golden hour timings (sunrise/sunset exact times if possible), best viewpoints, local subjects and permissions, waterfall/landscape specific spots, gear advice.',
  custom: 'Fully customised trip matching the user\'s specific requirements.',
};

function buildPrompt(body: any): string {
  const {
    destination, tripType, duration, groupSize,
    budget, fitnessLevel, specialNotes, guides, homestays, packages,
  } = body;

  const guideLines = (guides ?? []).slice(0, 6).map((g: any) =>
    `  • ${g.name} | Specialties: ${(g.specialties ?? []).join(', ')} | Regions: ${(g.regions ?? []).join(', ')} | ₹${g.rate_per_day ?? '?'}/day | Rating: ${g.rating ?? 'New'} | Premium: ${g.is_premium ? 'Yes' : 'No'} | ID: ${g.id}`
  ).join('\n');

  const homestayLines = (homestays ?? []).slice(0, 6).map((h: any) =>
    `  • ${h.name} | ${h.location} | ₹${h.price_per_night ?? '?'}/night | Amenities: ${(h.amenities ?? []).slice(0, 4).join(', ')} | ID: ${h.id}`
  ).join('\n');

  const packageLines = (packages ?? []).slice(0, 4).map((p: any) =>
    `  • ${p.title} | ${p.destination} | Difficulty: ${p.difficulty} | ID: ${p.id}`
  ).join('\n');

  const tripContext = TRIP_TYPE_CONTEXT[tripType] ?? TRIP_TYPE_CONTEXT.custom;
  const isSoloWomen = tripType === 'women_solo';

  return `You are TrekRiderz AI — a personalised trip concierge for India's first social trekking platform. TrekRiderz does NOT sell generic packages. Every trip is CUSTOMISED and ORGANISED end-to-end by the TrekRiderz team with verified local guides and homestays.

KEY DIFFERENTIATORS TO HIGHLIGHT:
- Verified local guides (many are women guides for solo women travelers)
- Handpicked homestays (authentic local stays, not hotels)
- 100% customised itineraries
- Community of trekkers across India
- Special experiences: birthday surprises, anniversary setups, women-only treks

TRIP REQUEST:
- Destination / Region: ${destination}
- Trip Type: ${tripContext}
- Duration: ${duration} days
- Group Size: ${groupSize} ${groupSize === 1 ? 'person' : 'people'}
- Budget: ${budget} per person
- Fitness Level: ${fitnessLevel ?? 'Moderate'}
- Special Notes from traveler: ${specialNotes || 'None'}
${isSoloWomen ? '\n⚠️ SOLO WOMEN TREK: Mandatory to prioritise women guides from the list. Safety, dignity, and empowerment are non-negotiable.\n' : ''}
OUR VERIFIED GUIDES (ALWAYS RECOMMEND FROM THIS LIST FIRST):
${guideLines || '  (No guides pre-fetched — recommend traveler contact TrekRiderz to match a guide)'}

OUR VERIFIED HOMESTAYS (ALWAYS RECOMMEND FROM THIS LIST FIRST):
${homestayLines || '  (No homestays pre-fetched — recommend traveler contact TrekRiderz for accommodation)'}

${packageLines ? `OUR EXPEDITION PACKAGES:\n${packageLines}\n` : ''}
INSTRUCTIONS:
1. Build a personalised day-by-day itinerary for exactly ${duration} days.
2. Pick one guide from our list (if available) and explain WHY they suit this exact trip.
3. Pick one homestay from our list (if available) and explain WHY it suits this trip type and traveler.
4. Budget breakdown must add up to the stated budget range.
5. For birthday/anniversary/honeymoon: include real special touches (decorations, meal setups, photo spots).
6. For solo women: safety tips must be practical and specific, not generic.
7. Return ONLY valid JSON — no markdown, no extra text.

RESPONSE FORMAT (strict JSON):
{
  "title": "Creative, specific trip name",
  "tagline": "One powerful sentence that sells this trip",
  "highlights": ["4 key experiences unique to this trip"],
  "difficulty": "Easy / Moderate / Challenging",
  "best_season": "Best months to visit",
  "itinerary": [
    {
      "day": 1,
      "title": "Day heading",
      "description": "Narrative for the day (2-3 sentences)",
      "activities": ["Activity 1", "Activity 2", "Activity 3"],
      "accommodation": "Name of stay",
      "meals": "What's included / suggested",
      "tip": "One insider tip specific to this day"
    }
  ],
  "recommended_guide": {
    "id": "guide ID from list or null",
    "name": "Guide name or 'TrekRiderz will match you'",
    "reason": "Specific reason this guide fits this trip and traveler"
  },
  "recommended_homestay": {
    "id": "homestay ID from list or null",
    "name": "Homestay name or 'TrekRiderz will find you the best stay'",
    "reason": "Why this homestay suits this trip type"
  },
  "budget_breakdown": {
    "guide_fee": 0,
    "accommodation": 0,
    "transport": 0,
    "meals": 0,
    "permits_entry": 0,
    "activities": 0,
    "miscellaneous": 0,
    "total_per_person": 0
  },
  "packing_essentials": ["5-7 items specific to this trip type and destination"],
  "special_touches": "For birthday/anniversary/honeymoon/women-solo: concrete special arrangements TrekRiderz will make. For treks: safety and acclimatisation note.",
  "trekriderz_promise": "What TrekRiderz specifically guarantees for this customised trip"
}`;
}

async function openAICompatCall(
  url: string, key: string, model: string, prompt: string, jsonMode = true
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `${model} error`);
  const content = data.choices[0].message.content;
  return typeof content === 'string' ? JSON.parse(content) : content;
}

async function callAI(prompt: string): Promise<any> {
  const isReal = (key?: string) => !!key && !key.startsWith('sk_test') && key.length > 10;

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey   = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Gemini 2.0 Flash — free (1,500 requests/day free tier)
  if (isReal(geminiKey)) {
    return openAICompatCall(GEMINI_URL, geminiKey!, 'gemini-2.0-flash', prompt);
  }

  // 2. Groq + Llama 3.1 8B — free tier (30 req/min)
  if (isReal(groqKey)) {
    return openAICompatCall(GROQ_URL, groqKey!, 'llama-3.1-8b-instant', prompt);
  }

  // 3. GPT-4o-mini — cheapest paid (~$0.15/million tokens)
  if (isReal(openaiKey)) {
    return openAICompatCall(OPENAI_URL, openaiKey!, 'gpt-4o-mini', prompt);
  }

  throw new Error('NO_AI_KEY');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.destination || !body.tripType || !body.duration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const prompt = buildPrompt(body);
    const plan = await callAI(prompt);
    return NextResponse.json({ plan });
  } catch (err: any) {
    console.error('[ai-plan]', err.message);
    if (err.message === 'NO_AI_KEY') {
      return NextResponse.json(
        { error: 'AI service not configured. Add GEMINI_API_KEY (free) or GROQ_API_KEY (free) to Vercel environment variables.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: err.message || 'Failed to generate plan' }, { status: 500 });
  }
}
