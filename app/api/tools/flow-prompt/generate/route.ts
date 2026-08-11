import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildFlowPromptGeneratorPrompt, PROMPT_VERSION_FLOW_PROMPT } from '@/prompts/flow-prompt-generator';

export const runtime = 'nodejs';
export const maxDuration = 120;

const requestSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product: z.string().min(1),
  product_description: z.string().optional(),
  objective: z.string().min(1),
  target_audience: z.string().optional(),
  content_brief: z.string().min(1),
  character: z.string().optional(),
  scene_count: z.number().int().min(1).max(12),
  scene_duration: z.number().int().min(3).max(60),
  visual_style: z.string().optional(),
  platform: z.string().min(1),
  cta: z.string().optional(),
  additional_notes: z.string().optional()
});

const sceneSchema = z.object({
  scene_number: z.number().int(),
  purpose: z.string(),
  duration_sec: z.number(),
  prompt_text: z.string()
});

const resultSchema = z.object({
  video_concept: z.string(),
  video_flow: z.array(z.object({ scene_number: z.number().int(), purpose: z.string() })),
  scenes: z.array(sceneSchema)
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

  const { system, user: userPrompt } = buildFlowPromptGeneratorPrompt({
    product: input.product,
    productDescription: input.product_description ?? '',
    objective: input.objective,
    targetAudience: input.target_audience ?? '',
    contentBrief: input.content_brief,
    character: input.character ?? '',
    sceneCount: input.scene_count,
    sceneDuration: input.scene_duration,
    visualStyle: input.visual_style ?? '',
    platform: input.platform,
    cta: input.cta ?? '',
    additionalNotes: input.additional_notes
  });

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 100000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating prompts' }, { status: 500 });
  }

  let output: z.infer<typeof resultSchema>;
  try {
    const rawJson = JSON.parse(aiText);
    const validated = resultSchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    output = validated.data;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const { data: saved, error: insertError } = await supabase
    .from('flow_prompts')
    .insert({
      product_id: input.product_id ?? null,
      inputs: input,
      video_concept: output.video_concept,
      video_flow: output.video_flow,
      scenes: output.scenes,
      provider: 'openai',
      model,
      prompt_version: PROMPT_VERSION_FLOW_PROMPT,
      creator_id: user.id
    })
    .select('*')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_flow_prompt',
    entity_type: 'flow_prompt',
    entity_id: saved?.id ?? null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_FLOW_PROMPT, scene_count: input.scene_count },
    reason: `Generated ${input.scene_count}-scene Flow prompt set for "${input.product}"`
  });

  return NextResponse.json({ flow_prompt: saved, provider: 'openai', model, prompt_version: PROMPT_VERSION_FLOW_PROMPT });
}
