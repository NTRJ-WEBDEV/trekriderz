import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

// ─── Offensive / Harmful Words ────────────────────────────────────────────────
// Covers: English profanity, common Hindi/Hinglish abuse, slurs, threats, sexual terms.
// Whole-word regex match prevents false positives (e.g. "class" won't match "ass").
const BLOCKED_WORDS: string[] = [
  // English profanity
  'fuck', 'fucker', 'fucking', 'motherfucker', 'motherfucking',
  'shit', 'bullshit', 'shithead',
  'bitch', 'bitches', 'bastard',
  'asshole', 'arsehole', 'ass',
  'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'fag', 'retard',
  'rape', 'rapist', 'molest',
  'kill yourself', 'kys', 'go die', 'i will kill', 'i will rape',

  // Hindi / Hinglish abuse (transliterated)
  'madarchod', 'mc', 'bhenchod', 'bc', 'behenchod',
  'chutiya', 'chutiye', 'gandu', 'lodu', 'lund', 'gaand',
  'randi', 'harami', 'kamina', 'saala', 'sala',
  'bhosdike', 'bhosdika', 'teri maa', 'teri behen',
  'lavde', 'lavda', 'jhatu', 'bakchod',
  'kutte', 'kaminey', 'ullu', 'gadha',
  'chod', 'chodna', 'chodne',

  // Sexual solicitation
  'nude', 'nudes', 'send nudes', 'naked', 'nsfw',
  'onlyfans', 'only fans', 'sex video', 'porn', 'xxx',
  'hot girl', 'hot boy', 'escort', 'call girl',

  // Threat / hate speech
  'terrorist', 'bomb threat', 'shoot you', 'stab you',
];

// ─── Promotional Patterns ─────────────────────────────────────────────────────
// Regular users cannot post promotional content.
// Verified guides and homestay owners ARE allowed (they promote their services).
const PROMO_PATTERNS: RegExp[] = [
  /\bdm\s*(me|us|for)\b/i,
  /\bclick\s+(link|here)\s+in\s+bio\b/i,
  /\bbuy\s+now\b/i,
  /\b(limited\s+time\s+)?offer\b/i,
  /\b(flat|upto|up\s+to)\s+\d+\s*%\s*off\b/i,
  /\bpromo\s*code\b/i,
  /\bwhatsapp\s+(me|us|at|on)\b/i,
  /\bcontact\s+(for|us|me)\b/i,
  /\bfree\s+(delivery|shipping|trial|demo)\b/i,
  /\bbook\s+now\b/i,
  /\bget\s+\d+%\s+discount\b/i,
  /\b(call|text)\s+(for|us|me)\s+(booking|price|quote|details)\b/i,
  /\bvisit\s+our\s+(website|page|store)\b/i,
  /\blink\s+in\s+(my\s+)?bio\b/i,
  /\b(₹|rs\.?)\s*\d+\s*(only|\/-)?\b/i,
  /\badvertis(e|ing|ement)\b/i,
  /\bsponsored\s+by\b/i,
];

// Roles that are allowed to post promotional content
const PROMO_ALLOWED_ROLES = ['guide', 'homestay_owner', 'admin'];

type ContentType = 'post' | 'comment' | 'chat';

export interface ModerationResult {
  safe: boolean;
  message?: string;
  severity?: 'warn' | 'flag';
}

// ─── Helper: fetch user role ──────────────────────────────────────────────────
async function getUserRole(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role ?? null;
}

// ─── Helper: log violation & apply strike ────────────────────────────────────
async function applyStrike(
  userId: string,
  type: ContentType,
  violation: string,
): Promise<{ strikes: number }> {
  const { count } = await supabase
    .from('moderation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const priorStrikes = count ?? 0;

  await supabase.from('moderation_logs').insert({
    user_id: userId,
    resource_type: type,
    violation_type: violation,
    severity: priorStrikes >= 2 ? 'high' : 'medium',
  });

  // 3rd strike → flag account for admin review
  if (priorStrikes >= 2) {
    await supabase.from('users')
      .update({
        is_flagged: true,
        flag_reason: `Repeated violations (${violation}) — pending admin review`,
      })
      .eq('id', userId);
  }

  return { strikes: priorStrikes + 1 };
}

// ─── Image moderation via Gemini Vision (free tier) with OpenAI fallback ─────
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function checkImageWithGemini(localUri: string): Promise<{ safe: boolean; reason?: string } | null> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;  // Not configured — caller falls back to OpenAI

  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' as any });

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            {
              text: 'You are a content moderator for TrekRiderz, a travel and trekking app. ' +
                'Respond with ONLY a JSON object: {"safe": true/false, "reason": "brief reason if unsafe"}. ' +
                'Flag as unsafe only for: nudity/sexual content, graphic violence or gore, hate symbols, explicit drug use. ' +
                'Nature, landscapes, people trekking, camping, and vehicles are all safe.',
            },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      }),
    });

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ''));
    return { safe: !!parsed.safe, reason: parsed.reason };
  } catch (err) {
    console.error('Gemini image moderation error:', err);
    return null;  // Treat as "couldn't check" — caller falls back to OpenAI or fails open
  }
}

async function checkImageWithOpenAI(localUri: string): Promise<{ safe: boolean; reason?: string }> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return { safe: true };  // Key not configured — skip check

  try {
    // Read image as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64' as any,
    });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Does this image contain nudity, sexual content, graphic violence, or explicit adult material? Reply only: SAFE or UNSAFE:<short reason>',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: 'low',  // cheaper & faster, sufficient for safety check
              },
            },
          ],
        }],
      }),
    });

    const json = await res.json();
    const answer: string = json?.choices?.[0]?.message?.content?.trim() ?? 'SAFE';

    if (answer.startsWith('UNSAFE')) {
      return { safe: false, reason: answer.replace('UNSAFE:', '').trim() };
    }
    return { safe: true };
  } catch (err) {
    console.error('Image moderation error:', err);
    return { safe: true };  // On API failure, allow — admin can review reports
  }
}

// Gemini is free tier — prefer it; fall back to OpenAI vision if no Gemini key configured
async function checkImageWithAI(localUri: string): Promise<{ safe: boolean; reason?: string }> {
  const geminiResult = await checkImageWithGemini(localUri);
  if (geminiResult) return geminiResult;
  return checkImageWithOpenAI(localUri);
}

// ─── Text moderation via Gemini (nuanced check layered on top of the blocklist) ──
async function checkTextWithGemini(text: string): Promise<{ safe: boolean; reason?: string } | null> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'You are a content moderator for TrekRiderz, a travel and trekking app. ' +
              'Analyze this text and respond with ONLY a JSON object: {"safe": true/false, "reason": "brief reason if unsafe"}. ' +
              'Flag as unsafe if the text contains: harassment or bullying, hate speech or discrimination, threats or violence, ' +
              'sexual solicitation, or scam content. Do not flag ordinary trekking/travel chatter. ' +
              `Text to analyze: "${text.replace(/"/g, "'")}"`,
          }],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
      }),
    });

    const json = await res.json();
    const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ''));
    return { safe: !!parsed.safe, reason: parsed.reason };
  } catch (err) {
    console.error('Gemini text moderation error:', err);
    return null;  // Fail open — the blocklist check above already ran
  }
}

// ─── Main moderation agent ────────────────────────────────────────────────────
export const moderationAgent = {

  async inspectText(
    text: string,
    userId: string,
    type: ContentType,
  ): Promise<ModerationResult> {
    if (!text || text.trim().length === 0) return { safe: true };

    const lower = text.toLowerCase();

    // 1. Check for offensive / harmful language
    for (const word of BLOCKED_WORDS) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        const { strikes } = await applyStrike(userId, type, 'inappropriate_language');

        if (strikes >= 3) {
          return {
            safe: false,
            severity: 'flag',
            message: 'Your account has been flagged for repeated violations and is under admin review. You will be notified once reviewed.',
          };
        }

        return {
          safe: false,
          severity: 'warn',
          message: strikes === 2
            ? `⚠️ Warning ${strikes}/3: Your post contains prohibited language. One more violation will flag your account for review.`
            : '⚠️ Your post contains language that violates our community guidelines. Please edit and try again.',
        };
      }
    }

    // 2. Check for promotional content (only for posts, not chat)
    if (type === 'post') {
      const isPromo = PROMO_PATTERNS.some((p) => p.test(text));
      if (isPromo) {
        const role = await getUserRole(userId);
        if (!role || !PROMO_ALLOWED_ROLES.includes(role)) {
          await applyStrike(userId, type, 'unauthorized_promotion');
          return {
            safe: false,
            severity: 'warn',
            message: 'Promotional posts are only allowed for verified guides and homestay owners. If you are a guide or homestay owner, apply from your Profile page.',
          };
        }
      }
    }

    // 3. Nuanced AI check (catches harassment/threats/hate speech the blocklist misses)
    const aiResult = await checkTextWithGemini(text);
    if (aiResult && !aiResult.safe) {
      const { strikes } = await applyStrike(userId, type, 'ai_flagged_text');
      return {
        safe: false,
        severity: strikes >= 3 ? 'flag' : 'warn',
        message: strikes >= 3
          ? 'Your account has been flagged for repeated violations and is under admin review. You will be notified once reviewed.'
          : `⚠️ ${aiResult.reason || 'Your post may violate our community guidelines.'} Please edit and try again.`,
      };
    }

    return { safe: true };
  },

  async inspectImage(
    imageUri: string,
    userId: string,
  ): Promise<ModerationResult> {
    const result = await checkImageWithAI(imageUri);

    if (!result.safe) {
      const { strikes } = await applyStrike(userId, 'post', 'explicit_image');
      return {
        safe: false,
        severity: strikes >= 3 ? 'flag' : 'warn',
        message: strikes >= 3
          ? 'Your account has been flagged for repeated policy violations and is under admin review.'
          : '🚫 This image contains explicit or adult content which is not allowed on TrekRiderz. Please choose a different photo.',
      };
    }

    return { safe: true };
  },
};
