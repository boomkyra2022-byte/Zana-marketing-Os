import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import {
  buildVisualIdeasPrompt,
  buildVisualIdeaVariationPrompt,
  PROMPT_VERSION_VISUAL_IDEAS,
  type VisualBriefInput,
  type VisualProductInput
} from '@/prompts/visual-hook-banner';

// Visual Hook Banner mode — Step B "AI Visual Ideas". Two modes in ONE
// route.ts (mirroring the Banner Generator's analyze/generate pattern) to
// keep this project's Vercel Hobby Serverless Function count down rather
// than adding a 4th new route file for the "สร้าง Variation" button.
export const runtime = 'nodejs';

const briefSchema = z.object({
  modelIdentity: z.string().max(500).optional(),
  funnelStage: z.string().max(50).optional(),
  platform: z.string().max(50).optional(),
  objective: z.string().max(300).optional(),
  targetAudience: z.string().max(300).optional(),
  painPoint: z.string().max(500).optional(),
  benefit: z.string().max(500).optional(),
  proof: z.string().max(500).optional(),
  promotion: z.string().max(300).optional(),
  contentStyle: z.string().max(200).optional(),
  visualHookSeed: z.string().max(500).optional(),
  hookStrength: z.string().max(50).optional(),
  outputRatio: z.string().max(20).optional()
});

const generateSchema = z.object({
  mode: z.literal('generate'),
  product_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(20),
  brief: briefSchema
});

const variationSchema = z.object({
  mode: z.literal('variation'),
  base_idea_id: z.string().uuid(),
  brief: briefSchema
});

const requestSchema = z.discriminatedUnion('mode', [generateSchema, variationSchema]);

const ideaSchema = z.object({
  title: z.string(),
  funnelStage: z.enum(['Awareness', 'Consideration', 'Conversion', 'Retention']),
  creativeAngle: z.string(),
  visualHook: z.string(),
  scene: z.string(),
  situation: z.string(),
  painPoint: z.string(),
  emotion: z.string(),
  solution: z.string(),
  benefit: z.string(),
  proof: z.string(),
  textHook: z.string(),
  supportingText: z.string(),
  offer: z.string().nullable(),
  cta: z.string(),
  layout: z.string(),
  expectedStrength: z.enum(['Safe', 'Strong', 'Unexpected'])
});

function generateCreativeId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VHB-${ymd}-${rand}`;
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

  let productId: string | null = null;
  let product: VisualProductInput | null = null;
  let baseIdeaRow: any = null;

  if (input.mode === 'generate') {
    productId = input.product_id ?? null;
  } else {
    const { data: baseIdea, error: baseErr } = await supabase.from('visual_ideas').select('*').eq('id', input.base_idea_id).single();
    if (baseErr || !baseIdea) return NextResponse.json({ error: 'ไม่พบ Idea ต้นทาง' }, { status: 404 });
    baseIdeaRow = baseIdea;
    productId = baseIdea.product_id;
  }

  if (productId) {
    const { data: p } = await supabase.from('products').select('*').eq('id', productId).single();
    if (p) {
      product = { productName: p.product_name, brand: p.brand, category: p.category, usp: p.usp, allowedClaims: p.allowed_claims, bannedClaims: p.banned_claims };
    }
  }

  const brief: VisualBriefInput = input.brief;

  const { system, user: userPrompt } =
    input.mode === 'generate' ? buildVisualIdeasPrompt(brief, product, input.quantity) : buildVisualIdeaVariationPrompt(brief, product, baseIdeaRow);

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 60000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating visual ideas' }, { status: 500 });
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
    mode: 'visual_hook_banner',
    product_id: productId,
    brief: brief as any,
    title: idea.title,
    funnel_stage: idea.funnelStage,
    creative_angle: idea.creativeAngle,
    visual_hook: idea.visualHook,
    scene: idea.scene,
    situation: idea.situation,
    pain_point: idea.painPoint,
    emotion: idea.emotion,
    solution: idea.solution,
    benefit: idea.benefit,
    proof: idea.proof,
    text_hook: idea.textHook,
    supporting_text: idea.supportingText,
    offer: idea.offer,
    cta: idea.cta,
    layout: idea.layout,
    expected_strength: idea.expectedStrength,
    status: 'IDEA',
    owner_id: user.id
  }));

  const { data: inserted, error: insertError } = await supabase.from('visual_ideas').insert(rows).select('*');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: input.mode === 'generate' ? 'ai_generate_visual_ideas' : 'ai_generate_visual_idea_variation',
    entity_type: 'visual_idea',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_VISUAL_IDEAS, count: inserted?.length ?? 0 },
    reason: `Generated ${inserted?.length ?? 0} visual idea(s)`
  });

  return NextResponse.json({ ideas: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION_VISUAL_IDEAS });
}
