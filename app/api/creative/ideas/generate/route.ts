import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getRelevantCreativeContext } from '@/lib/ai/context';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildIdeaGeneratorPrompt, PROMPT_VERSION_IDEA } from '@/prompts/idea-generator';

export const runtime = 'nodejs';

const MAX_QUANTITY = 100;

const requestSchema = z.object({
  product_id: z.string().uuid(),
  persona_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  funnel: z.string().optional(),
  objective: z.string().optional(),
  platform: z.string().optional(),
  content_style: z.string().optional(),
  promotion: z.string().optional(),
  brief: z.string().optional()
});

const ideaSchema = z.object({
  title: z.string(),
  funnel: z.enum(['Awareness', 'Consideration', 'Conversion', 'Retention']),
  creative_format: z.string().nullable(),
  pain_point: z.string().nullable(),
  emotional_trigger: z.string().nullable(),
  hook: z.string().nullable(),
  visual_concept: z.string().nullable(),
  product_role: z.string().nullable(),
  mood_tone: z.string().nullable(),
  cta: z.string().nullable(),
  organic_or_ads: z.enum(['organic', 'ads', 'both']),
  potential_score: z.number().min(1).max(10),
  stop_scroll_reason: z.string().nullable(),
  risks: z.string().nullable(),
  angle: z.string().nullable()
});

function generateCreativeId(prefix: string) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

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

  const { system, user: userPrompt } = buildIdeaGeneratorPrompt(
    {
      quantity: input.quantity,
      funnel: input.funnel,
      objective: input.objective,
      platform: input.platform,
      contentStyle: input.content_style,
      promotion: input.promotion,
      brief: input.brief
    },
    ctx
  );

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.8, timeoutMs: 60000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating ideas' }, { status: 500 });
  }

  let ideas: z.infer<typeof ideaSchema>[];
  try {
    const rawJson = JSON.parse(aiText);
    const arraySchema = z.object({ ideas: z.array(ideaSchema) });
    const validated = arraySchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    ideas = validated.data.ideas;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const rows = ideas.map((idea) => ({
    creative_id: generateCreativeId('IDEA'),
    title: idea.title,
    product_id: input.product_id,
    persona_id: input.persona_id ?? null,
    funnel_stage: idea.funnel,
    creative_format: idea.creative_format,
    pain_point: idea.pain_point,
    emotional_trigger: idea.emotional_trigger,
    hook: idea.hook,
    visual_concept: idea.visual_concept,
    product_placement: idea.product_role,
    mood_tone: idea.mood_tone,
    cta: idea.cta,
    organic_or_ads: idea.organic_or_ads,
    potential_score: idea.potential_score,
    stop_scroll_reason: idea.stop_scroll_reason,
    risks: idea.risks,
    status: 'IDEA',
    owner_id: user.id,
    source_type: 'AI',
    angle: idea.angle
  }));

  const { data: inserted, error: insertError } = await supabase.from('ideas').insert(rows).select('*');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_ideas',
    entity_type: 'idea',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_IDEA, count: inserted?.length ?? 0 },
    reason: `Generated ${input.quantity} ideas for product ${ctx.product.product_name}`
  });

  return NextResponse.json({ ideas: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION_IDEA });
}
