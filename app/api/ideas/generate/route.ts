import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getKnowledgeContext } from '@/lib/ai/knowledge-context';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';

export const runtime = 'nodejs';

const PROMPT_VERSION = 'idea-generate-v1';
const MAX_QUANTITY = 100;

const ANGLES = [
  'Social Anxiety', 'Visual Metaphor', 'Relatable Daily Pain', 'Body Confidence', 'Native Feed',
  'Product Demo', 'UGC', 'POV', 'Review', 'Comparison', 'Experiment', 'Founder', 'Meme', 'News',
  'Wanted Poster', 'Case File', 'Receipt', 'Billboard', 'Story', 'Problem/Solution'
];

const requestSchema = z.object({
  product_id: z.string().uuid(),
  persona_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  objective: z.string().optional(),
  funnel_stage: z.string().optional(),
  constraints: z.string().optional(),
  promotion: z.string().optional(),
  reference_winner: z.string().optional()
});

const ideaSchema = z.object({
  title: z.string(),
  funnel_stage: z.string().nullable(),
  creative_format: z.string().nullable(),
  pain_point: z.string().nullable(),
  emotional_trigger: z.string().nullable(),
  hook: z.string().nullable(),
  visual_concept: z.string().nullable(),
  product_placement: z.string().nullable(),
  mood_tone: z.string().nullable(),
  cta: z.string().nullable(),
  organic_or_ads: z.enum(['organic', 'ads', 'both']).nullable(),
  potential_score: z.number().min(0).max(100),
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

  const { data: product } = await supabase.from('products').select('*').eq('id', input.product_id).single();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  let persona: any = null;
  if (input.persona_id) {
    const { data } = await supabase.from('personas').select('*').eq('id', input.persona_id).single();
    persona = data;
  }

  const knowledgeContext = await getKnowledgeContext(supabase, {
    productId: input.product_id,
    personaId: input.persona_id ?? null
  });

  const systemPrompt = `You are a senior direct-response creative strategist for Thai TikTok/social-commerce ads (ZANA / ZANA Kid / Kyra brands).
Generate exactly ${input.quantity} DISTINCT video content ideas as a JSON object: {"ideas": [...]}.
Each idea must follow this exact shape:
{
  "title": string,
  "funnel_stage": "TOFU"|"MOFU"|"BOFU"|null,
  "creative_format": string|null,
  "pain_point": string|null,
  "emotional_trigger": string|null,
  "hook": string (the literal opening line/visual hook, in Thai),
  "visual_concept": string|null,
  "product_placement": string|null,
  "mood_tone": string|null,
  "cta": string|null,
  "organic_or_ads": "organic"|"ads"|"both"|null,
  "potential_score": number (0-100, your honest estimate, not inflated),
  "stop_scroll_reason": string|null,
  "risks": string|null,
  "angle": one of [${ANGLES.map((a) => `"${a}"`).join(', ')}]
}
Rules:
- Spread ideas across DIFFERENT angles from the list above — do not repeat the same angle more than ceil(quantity/6) times.
- Write hook/title/visual_concept in Thai (the brand's default language). Keep other fields concise.
- Ground every idea in the Knowledge Base facts below — do not contradict them, do not invent banned claims.
- potential_score is a rough pre-flight estimate only, never a performance guarantee.
Knowledge Base (priority: active business truth > product-specific rules > historical learnings):
${knowledgeContext}`;

  const userPrompt = `Product: ${product.product_name} (brand: ${product.brand}, category: ${product.category ?? 'n/a'})
USP: ${product.usp ?? 'n/a'}
Allowed claims: ${product.allowed_claims ?? 'n/a'}
Banned claims: ${product.banned_claims ?? 'n/a'}
Persona: ${persona ? `${persona.name} (${persona.age_range ?? 'n/a'}, pains: ${(persona.pains || []).join(', ')}, desires: ${(persona.desires || []).join(', ')})` : 'not specified — generate broadly appealing ideas'}
Objective: ${input.objective ?? 'general awareness + conversion mix'}
Funnel stage requested: ${input.funnel_stage ?? 'mix of TOFU/MOFU/BOFU'}
Constraints: ${input.constraints ?? 'none'}
Current promotion: ${input.promotion ?? 'none specified'}
Reference winner to riff on (optional): ${input.reference_winner ?? 'none'}
Generate exactly ${input.quantity} ideas now.`;

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system: systemPrompt, user: userPrompt, temperature: 0.8 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Unknown error generating ideas' }, { status: 500 });
  }

  let ideas: z.infer<typeof ideaSchema>[];
  try {
    const rawJson = JSON.parse(aiText);
    const arraySchema = z.object({ ideas: z.array(ideaSchema) });
    const validated = arraySchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'AI response did not match expected schema', details: validated.error.flatten() },
        { status: 502 }
      );
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
    funnel_stage: idea.funnel_stage,
    creative_format: idea.creative_format,
    pain_point: idea.pain_point,
    emotional_trigger: idea.emotional_trigger,
    hook: idea.hook,
    visual_concept: idea.visual_concept,
    product_placement: idea.product_placement,
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
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_ideas',
    entity_type: 'idea',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION, count: inserted?.length ?? 0 },
    reason: `Generated ${input.quantity} ideas for product ${product.product_name}`
  });

  return NextResponse.json({ ideas: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION });
}
