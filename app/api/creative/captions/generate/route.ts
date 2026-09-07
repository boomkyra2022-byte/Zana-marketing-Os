import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getRelevantCreativeContext } from '@/lib/ai/context';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildCaptionGeneratorPrompt, PROMPT_VERSION_CAPTION } from '@/prompts/caption-generator';

export const runtime = 'nodejs';

const MAX_QUANTITY = 20;

const requestSchema = z.object({
  product_id: z.string().uuid(),
  persona_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  framework: z.enum(['STANDARD', 'ZANA']).default('STANDARD'),
  objective: z.string().optional(),
  platform: z.string().optional(),
  promotion: z.string().optional(),
  brief: z.string().optional()
});

const captionSchema = z.object({
  hook: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  angle: z.string().nullable().optional()
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const ctx = await getRelevantCreativeContext(supabase, { productId: input.product_id, personaId: input.persona_id });
  if (!ctx.product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const { system, user: userPrompt } = buildCaptionGeneratorPrompt(
    {
      quantity: input.quantity,
      framework: input.framework,
      objective: input.objective,
      platform: input.platform,
      promotion: input.promotion,
      brief: input.brief
    },
    ctx
  );

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 60000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating captions' }, { status: 500 });
  }

  let captions: z.infer<typeof captionSchema>[];
  try {
    const rawJson = JSON.parse(aiText);
    const arraySchema = z.object({ captions: z.array(captionSchema) });
    const validated = arraySchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    captions = validated.data.captions;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  // Stateless by design — this is a quick standalone ideation tool, not part
  // of the Idea/Script pipeline, so results aren't persisted to a table.
  // Still logged to activity_logs for consistency with every other AI call
  // in the app (audit trail / usage visibility).
  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_captions',
    entity_type: 'caption',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_CAPTION, count: captions.length },
    reason: `Generated ${captions.length} captions for product ${ctx.product.product_name}`
  });

  return NextResponse.json({ captions, provider: 'openai', model, prompt_version: PROMPT_VERSION_CAPTION });
}
