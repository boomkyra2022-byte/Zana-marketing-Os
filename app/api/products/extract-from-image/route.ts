import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const PROMPT_VERSION = 'product-image-extract-v1';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB, matches MASTER_PROMPT file-size-limit requirement

const requestSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp'])
});

// Structured output only — matches MASTER_PROMPT §9/§24 (structured JSON, auditable).
const extractionSchema = z.object({
  brand: z.string().nullable(),
  product_name: z.string().nullable(),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  selling_price: z.number().nullable(),
  promotion_price: z.number().nullable(),
  usp: z.string().nullable(),
  ingredients: z.string().nullable(),
  benefits: z.string().nullable(),
  usage: z.string().nullable(),
  allowed_claims: z.string().nullable(),
  banned_claims: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  notes_for_human_review: z.string().nullable()
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured in .env.local' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request: expected imageBase64 + mimeType' }, { status: 400 });
  }

  const { imageBase64, mimeType } = parsed.data;

  const approxBytes = imageBase64.length * 0.75;
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 413 });
  }

  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  const systemPrompt = `You are a product-data extraction assistant for a Thai e-commerce/DTC brand (ZANA / ZANA Kid / Kyra).
Read the product photo (label, packaging, box, or spec sheet) and extract fields into STRICT JSON only — no prose, no markdown fences.
If a field is not visible or not determinable from the image, use null. Do not invent numbers.
Prices should be plain numbers (no currency symbols). "confidence" is your 0-100 confidence in the overall extraction.
"notes_for_human_review" should flag anything ambiguous, low-resolution, or requiring a human check — this is a pre-fill aid only, a human always reviews before saving.
Return exactly this JSON shape:
{
  "brand": string|null,
  "product_name": string|null,
  "sku": string|null,
  "category": string|null,
  "selling_price": number|null,
  "promotion_price": number|null,
  "usp": string|null,
  "ingredients": string|null,
  "benefits": string|null,
  "usage": string|null,
  "allowed_claims": string|null,
  "banned_claims": string|null,
  "confidence": number,
  "notes_for_human_review": string|null
}`;

  let aiResponseText: string;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract product data from this image.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `AI provider error (${res.status}): ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    aiResponseText = json.choices?.[0]?.message?.content;
    if (!aiResponseText) {
      return NextResponse.json({ error: 'AI provider returned no content' }, { status: 502 });
    }
  } catch (err: any) {
    const message = err?.name === 'TimeoutError' ? 'AI provider timed out after 30s' : err?.message || 'Unknown error calling AI provider';
    return NextResponse.json({ error: message }, { status: 504 });
  }

  let extracted: z.infer<typeof extractionSchema>;
  try {
    const rawJson = JSON.parse(aiResponseText);
    const validated = extractionSchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'AI response did not match expected schema', details: validated.error.flatten() },
        { status: 502 }
      );
    }
    extracted = validated.data;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  // Auditability (MASTER_PROMPT §24): log provider/model/prompt_version/response.
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_extract_product_from_image',
    entity_type: 'product',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION, response: extracted },
    reason: 'Pre-fill product form from uploaded image (human review required before save)'
  });

  return NextResponse.json({ extracted, provider: 'openai', model, prompt_version: PROMPT_VERSION });
}
