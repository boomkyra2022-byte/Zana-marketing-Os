import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getOptionalCreativeContext } from '@/lib/ai/context';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildMasterPromptSetPrompt, PROMPT_VERSION_FLOW_DIRECTOR, type FlowPromptPart } from '@/prompts/flow-prompt-director';

// FLOW PROMPT DIRECTOR — step 2/3: Generate all PART Master Prompts in one
// call. Rewritten from the older simpler "Gen Prompt" v1 route (which used
// a free scene-count model). This version enforces the "10 seconds = 1
// prompt" rule and the Lock system.
//
// LOCK SYSTEM is enforced in CODE, not just prompted to the AI — same
// discipline established by the Punchy SRT fix earlier in this project
// (never trust the AI to faithfully preserve exact text; splice known-good
// values back in deterministically). Locked PARTs are passed to the AI only
// as read-only context, then spliced back into the final result from
// existing_parts regardless of what the AI returned for those indices.
export const runtime = 'nodejs';
export const maxDuration = 180;

const analysisSchema = z.object({
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
  story_flow: z.array(z.object({ step: z.string(), purpose: z.string() }))
});

const continuityBibleSchema = z.object({
  product: z.object({ name: z.string(), visual_identity: z.string(), key_claims_allowed: z.string(), banned_claims: z.string() }),
  character: z.object({ description: z.string(), wardrobe: z.string(), voice_tone: z.string(), consistency_rule: z.string() }),
  visual: z.object({ typography_style: z.string(), motion_language: z.string(), color_treatment: z.string(), editing_energy: z.string() })
});

const requestSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  project_name: z.string().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  persona_id: z.string().uuid().nullable().optional(),
  source_type: z.enum(['MANUAL', 'IDEA', 'SCRIPT', 'STORYBOARD', 'KNOWLEDGE', 'PRODUCT', 'PERSONA']).default('MANUAL'),
  source_id: z.string().uuid().nullable().optional(),
  content_input: z.string().min(1),
  platform: z.string().min(1),
  aspect_ratio: z.string().min(1),
  duration_sec: z.number().int().min(10),
  prompt_count: z.number().int().min(1),
  objective: z.string().min(1),
  primary_goal: z.string().min(1),
  style: z.array(z.string()).default([]),
  script_mode: z.enum(['AUTO_SCRIPT', 'IMPROVE_SCRIPT', 'EXACT_SCRIPT']),
  existing_script: z.string().nullable().optional(),
  scene_mode: z.enum(['AUTO', 'MANUAL']).default('AUTO'),
  manual_scenes_per_part: z.number().int().min(2).max(4).optional(),
  analysis: analysisSchema,
  continuity_bible: continuityBibleSchema,
  locked_part_numbers: z.array(z.number().int()).default([]),
  existing_parts: z.array(z.any()).default([]),
  director_command: z.string().nullable().optional()
});

const sceneSchema = z.object({
  scene_number: z.number().int(),
  time_range: z.string(),
  purpose: z.string(),
  visual: z.string(),
  subject: z.string(),
  action: z.string(),
  camera: z.string(),
  motion_graphic: z.string(),
  on_screen_text: z.string(),
  voice_over: z.string(),
  sound: z.string(),
  transition: z.string()
});

const partSchema = z.object({
  part_number: z.number().int(),
  time_range: z.string(),
  part_purpose: z.string(),
  scenes: z.array(sceneSchema),
  full_voice_over: z.string(),
  on_screen_text: z.array(z.string()),
  editing_style: z.string(),
  retention_device: z.string(),
  continuity_note: z.string(),
  negative_instructions: z.string(),
  final_feel: z.string(),
  handoff_to_next: z.string(),
  prompt_text: z.string()
});

const resultSchema = z.object({ parts: z.array(partSchema) });

function normalizeWords(text: string): string[] {
  return text
    .replace(/[.,!?"'“”‘’()\[\]{}:;\-–—]/g, '')
    .split(/\s+/)
    .filter(Boolean);
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

  const ctx = await getOptionalCreativeContext(supabase, { productId: input.product_id, personaId: input.persona_id });

  const existingParts = input.existing_parts as FlowPromptPart[];
  const lockedParts = existingParts.filter((p) => input.locked_part_numbers.includes(p.part_number));

  const { system, user: userPrompt } = buildMasterPromptSetPrompt({
    analysis: input.analysis,
    continuityBible: input.continuity_bible,
    productName: ctx.product?.product_name ?? input.continuity_bible.product.name,
    allowedClaims: ctx.product?.allowed_claims ?? input.continuity_bible.product.key_claims_allowed,
    bannedClaims: ctx.product?.banned_claims ?? input.continuity_bible.product.banned_claims,
    platform: input.platform,
    aspectRatio: input.aspect_ratio,
    durationSec: input.duration_sec,
    promptCount: input.prompt_count,
    objective: input.objective,
    primaryGoal: input.primary_goal,
    style: input.style.length ? input.style : input.analysis.recommended_style,
    scriptMode: input.script_mode,
    existingScript: input.existing_script ?? null,
    sceneMode: input.scene_mode,
    manualScenesPerPart: input.manual_scenes_per_part,
    lockedParts: lockedParts.map((p) => ({ index: p.part_number, part: p })),
    directorCommand: input.director_command ?? undefined
  });

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.8, timeoutMs: 170000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการสร้าง Master Prompt' }, { status: 500 });
  }

  let aiParts: z.infer<typeof partSchema>[];
  try {
    const rawJson = JSON.parse(aiText);
    const validated = resultSchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    aiParts = validated.data.parts;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  // Splice locked parts back in verbatim — code-enforced, not AI-trusted.
  const finalParts: FlowPromptPart[] = [];
  for (let n = 1; n <= input.prompt_count; n++) {
    const locked = lockedParts.find((p) => p.part_number === n);
    if (locked) {
      finalParts.push(locked);
      continue;
    }
    const generated = aiParts.find((p) => p.part_number === n) ?? aiParts[n - 1];
    if (!generated) {
      return NextResponse.json({ error: `AI ไม่ได้สร้าง PART ${n} มาให้ — ลอง Generate ใหม่อีกครั้ง` }, { status: 502 });
    }
    finalParts.push(generated);
  }

  // EXACT_SCRIPT fidelity check — non-blocking warning, honest disclosure
  // rather than a false guarantee (same principle as the Punchy SRT fix).
  let scriptFidelityWarning: string | null = null;
  if (input.script_mode === 'EXACT_SCRIPT' && input.existing_script) {
    const originalWords = normalizeWords(input.existing_script);
    const generatedWords = finalParts.flatMap((p) => normalizeWords(p.full_voice_over));
    const originalSet = new Set(originalWords);
    const generatedSet = new Set(generatedWords);
    const missingCount = originalWords.filter((w) => !generatedSet.has(w)).length;
    const extraCount = generatedWords.filter((w) => !originalSet.has(w)).length;
    const driftRatio = (missingCount + extraCount) / Math.max(1, originalWords.length);
    if (driftRatio > 0.08) {
      scriptFidelityWarning =
        'ตรวจพบว่า Voice Over ที่สร้างอาจไม่ตรงกับ EXACT SCRIPT ที่ให้มาทั้งหมด (มีคำที่ขาด/เกินจากต้นฉบับ) — กรุณาตรวจสอบ Full Voice Over ของแต่ละ PART เทียบกับสคริปต์ต้นฉบับก่อนใช้งานจริง';
    }
  }

  const now = new Date().toISOString();
  const rowPayload = {
    project_name: input.project_name ?? null,
    product_id: input.product_id ?? null,
    persona_id: input.persona_id ?? null,
    source_type: input.source_type,
    source_id: input.source_id ?? null,
    content_input: input.content_input,
    platform: input.platform,
    aspect_ratio: input.aspect_ratio,
    duration_sec: input.duration_sec,
    prompt_count: input.prompt_count,
    objective: input.objective,
    primary_goal: input.primary_goal,
    style: input.style,
    script_mode: input.script_mode,
    analysis: input.analysis,
    story_flow: input.analysis.story_flow,
    continuity_bible: input.continuity_bible,
    locks: { parts: input.locked_part_numbers },
    parts: finalParts,
    inputs: input,
    provider: 'openai',
    model,
    prompt_version: PROMPT_VERSION_FLOW_DIRECTOR,
    status: 'GENERATED',
    updated_at: now
  };

  let saved;
  let dbError;
  if (input.id) {
    const { data: existingRow } = await supabase.from('flow_prompts').select('version').eq('id', input.id).single();
    const nextVersion = (existingRow?.version ?? 1) + 1;
    const { data, error } = await supabase
      .from('flow_prompts')
      .update({ ...rowPayload, version: nextVersion })
      .eq('id', input.id)
      .select('*')
      .single();
    saved = data;
    dbError = error;
  } else {
    const { data, error } = await supabase
      .from('flow_prompts')
      .insert({ ...rowPayload, creator_id: user.id, version: 1 })
      .select('*')
      .single();
    saved = data;
    dbError = error;
  }

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_flow_prompt_director',
    entity_type: 'flow_prompt',
    entity_id: saved?.id ?? null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_FLOW_DIRECTOR, prompt_count: input.prompt_count, script_mode: input.script_mode },
    reason: `Generated ${input.prompt_count}-PART Flow Prompt Director set (${input.duration_sec}s)`
  });

  return NextResponse.json({
    flow_prompt: saved,
    provider: 'openai',
    model,
    prompt_version: PROMPT_VERSION_FLOW_DIRECTOR,
    script_fidelity_warning: scriptFidelityWarning
  });
}
