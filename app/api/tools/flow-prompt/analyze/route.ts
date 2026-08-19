import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOptionalCreativeContext } from '@/lib/ai/context';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildContentAnalysisPrompt, PROMPT_VERSION_FLOW_DIRECTOR } from '@/prompts/flow-prompt-director';

// FLOW PROMPT DIRECTOR — step 1/3: Analyze Content. Does NOT persist
// anything — returns a draft analysis + story flow + continuity bible that
// the user can edit in the UI before Generate is called. Kept as its own
// route (rather than folded into /generate) so the AI Brief Assistant step
// stays fast and separately re-runnable without re-generating all PARTs.
export const runtime = 'nodejs';
export const maxDuration = 60;

const requestSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  persona_id: z.string().uuid().nullable().optional(),
  content_input: z.string().min(1),
  platform: z.string().min(1),
  aspect_ratio: z.string().min(1),
  duration_sec: z.number().int().min(10),
  prompt_count: z.number().int().min(1),
  objective: z.string().min(1),
  primary_goal: z.string().min(1),
  style: z.array(z.string()).default([]),
  script_mode: z.enum(['AUTO_SCRIPT', 'IMPROVE_SCRIPT', 'EXACT_SCRIPT']),
  existing_script: z.string().nullable().optional()
});

const analysisResultSchema = z.object({
  core_message: z.string(),
  target_audience: z.string(),
  funnel_stage: z.string(),
  pain_point: z.string(),
  desire: z.string(),
  key_benefit: z.string(),
  proof_authority: z.string(),
  offer: z.string(),
  cta: z.string(),
  recommended_hook: z.object({ hook_type: z.string(), hook_text: z.string() }),
  recommended_style: z.array(z.string()),
  story_flow: z.array(z.object({ step: z.string(), purpose: z.string() })),
  continuity_bible: z.object({
    product: z.object({ name: z.string(), visual_identity: z.string(), key_claims_allowed: z.string(), banned_claims: z.string() }),
    character: z.object({ description: z.string(), wardrobe: z.string(), voice_tone: z.string(), consistency_rule: z.string() }),
    visual: z.object({ typography_style: z.string(), motion_language: z.string(), color_treatment: z.string(), editing_energy: z.string() })
  })
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

  const ctx = await getOptionalCreativeContext(supabase, { productId: input.product_id, personaId: input.persona_id });

  const { system, user: userPrompt } = buildContentAnalysisPrompt({
    contentInput: input.content_input,
    productName: ctx.product?.product_name ?? null,
    productDescription: ctx.product ? [ctx.product.usp, ctx.product.benefits, ctx.product.ingredients].filter(Boolean).join(' | ') : null,
    allowedClaims: ctx.product?.allowed_claims ?? null,
    bannedClaims: ctx.product?.banned_claims ?? null,
    personaName: ctx.persona?.name ?? null,
    personaPains: ctx.persona?.pains ?? [],
    personaDesires: ctx.persona?.desires ?? [],
    knowledgeText: ctx.knowledgeText,
    winnersText: ctx.winnersText,
    platform: input.platform,
    aspectRatio: input.aspect_ratio,
    durationSec: input.duration_sec,
    promptCount: input.prompt_count,
    objective: input.objective,
    primaryGoal: input.primary_goal,
    style: input.style.length ? input.style : ['AUTO'],
    scriptMode: input.script_mode,
    existingScript: input.existing_script ?? null
  });

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.7, timeoutMs: 90000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการวิเคราะห์เนื้อหา' }, { status: 500 });
  }

  let analysis: z.infer<typeof analysisResultSchema>;
  try {
    const rawJson = JSON.parse(aiText);
    const validated = analysisResultSchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    analysis = validated.data;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_analyze_flow_content',
    entity_type: 'flow_prompt',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_FLOW_DIRECTOR },
    reason: `Analyzed content for Flow Prompt Director (${input.duration_sec}s / ${input.platform})`
  });

  return NextResponse.json({
    analysis: {
      core_message: analysis.core_message,
      target_audience: analysis.target_audience,
      funnel_stage: analysis.funnel_stage,
      pain_point: analysis.pain_point,
      desire: analysis.desire,
      key_benefit: analysis.key_benefit,
      proof_authority: analysis.proof_authority,
      offer: analysis.offer,
      cta: analysis.cta,
      recommended_hook: analysis.recommended_hook,
      recommended_style: analysis.recommended_style,
      story_flow: analysis.story_flow
    },
    continuity_bible: analysis.continuity_bible,
    provider: 'openai',
    model,
    prompt_version: PROMPT_VERSION_FLOW_DIRECTOR
  });
}
