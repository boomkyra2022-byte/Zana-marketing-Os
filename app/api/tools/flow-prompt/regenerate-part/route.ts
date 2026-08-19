import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildRegeneratePartPrompt, PROMPT_VERSION_FLOW_DIRECTOR, type FlowPromptPart } from '@/prompts/flow-prompt-director';

// FLOW PROMPT DIRECTOR — step 3/3 (repeatable): Regenerate ONE PART only,
// via the Director Command free-text box or the per-PART [REGENERATE]
// button. Loads the saved project, regenerates a single index, updates it
// in place, saves. Other PARTs are never sent to the AI for rewriting —
// only summarized as read-only context for continuity.
export const runtime = 'nodejs';
export const maxDuration = 60;

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

const requestSchema = z.object({
  id: z.string().uuid(),
  part_number: z.number().int().min(1),
  director_command: z.string().nullable().optional()
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

  const { data: project, error: loadError } = await supabase.from('flow_prompts').select('*').eq('id', input.id).single();
  if (loadError || !project) return NextResponse.json({ error: 'ไม่พบโปรเจกต์นี้' }, { status: 404 });

  const parts = (project.parts ?? []) as FlowPromptPart[];
  const currentPart = parts.find((p) => p.part_number === input.part_number);
  if (!currentPart) return NextResponse.json({ error: `ไม่พบ PART ${input.part_number} ในโปรเจกต์นี้` }, { status: 404 });

  const otherPartsSummary = parts
    .filter((p) => p.part_number !== input.part_number)
    .map((p) => ({ part_number: p.part_number, part_purpose: p.part_purpose, final_feel: p.final_feel }));

  const analysis = project.analysis;
  const continuityBible = project.continuity_bible;
  if (!analysis || !continuityBible) {
    return NextResponse.json({ error: 'โปรเจกต์นี้ยังไม่มีข้อมูล Analysis / Continuity Bible — กรุณา Generate ทั้งชุดก่อน' }, { status: 400 });
  }

  const { system, user: userPrompt } = buildRegeneratePartPrompt({
    analysis,
    continuityBible,
    productName: continuityBible.product?.name ?? null,
    allowedClaims: continuityBible.product?.key_claims_allowed ?? null,
    bannedClaims: continuityBible.product?.banned_claims ?? null,
    platform: project.platform,
    aspectRatio: project.aspect_ratio,
    totalParts: project.prompt_count,
    targetPartNumber: input.part_number,
    targetTimeRange: currentPart.time_range,
    currentPart,
    otherPartsSummary,
    directorCommand: input.director_command ?? undefined
  });

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 60000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการ Regenerate PART นี้' }, { status: 500 });
  }

  let newPart: z.infer<typeof partSchema>;
  try {
    const rawJson = JSON.parse(aiText);
    const validated = partSchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    newPart = validated.data;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const updatedParts = parts.map((p) => (p.part_number === input.part_number ? newPart : p));

  const { data: saved, error: updateError } = await supabase
    .from('flow_prompts')
    .update({ parts: updatedParts, version: (project.version ?? 1) + 1, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_regenerate_flow_prompt_part',
    entity_type: 'flow_prompt',
    entity_id: input.id,
    new_value: { part_number: input.part_number, director_command: input.director_command ?? null, prompt_version: PROMPT_VERSION_FLOW_DIRECTOR },
    reason: `Regenerated PART ${input.part_number} of Flow Prompt Director project ${input.id}`
  });

  return NextResponse.json({ flow_prompt: saved, part: newPart, provider: 'openai', model, prompt_version: PROMPT_VERSION_FLOW_DIRECTOR });
}
