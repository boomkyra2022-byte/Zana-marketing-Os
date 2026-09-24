import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';
import { buildMasterVideoPrompt, type VideoPromptVariables } from '@/prompts/video-prompt-studio';

// ZANA AI Video Prompt Studio — P0. One route.ts dispatched by `action`,
// same pattern that resolved the Vercel Hobby function-count incidents on
// Flow Prompt Director and the flow-prompt/[id] cleanup (see spec doc,
// "API routes and the Vercel function-count question"): `compile` (Layer
// 1+2+3 -> Master Prompt, no DB write) and `save` (persist the project
// row after the user has a prompt they want to keep). `recommend` (Auto
// Best Mode) is P3 — not implemented yet, added to this same file when it
// ships rather than as a new route.ts.
export const runtime = 'nodejs';

const variablesSchema: z.ZodType<VideoPromptVariables> = z
  .object({
    creative_mode: z.string().max(100).nullable().optional(),
    funnel_stage: z.string().max(100).nullable().optional(),
    character_mode: z.string().max(100).nullable().optional(),
    character_persona: z.string().max(100).nullable().optional(),
    age_appearance: z.string().max(50).nullable().optional(),
    duration_sec: z.number().int().min(1).max(60).nullable().optional(),
    scene_count: z.number().int().min(1).max(12).nullable().optional(),
    pacing: z.string().max(100).nullable().optional(),
    visual_quality: z.string().max(100).nullable().optional(),
    lighting: z.string().max(100).nullable().optional(),
    environment: z.string().max(200).nullable().optional(),
    color_direction: z.string().max(200).nullable().optional(),
    camera_style: z.string().max(100).nullable().optional(),
    skin_finish: z.string().max(100).nullable().optional(),
    texture_mode: z.string().max(100).nullable().optional(),
    ingredient_visualization: z.string().max(100).nullable().optional(),
    scene_focus: z.string().max(200).nullable().optional(),
    text_mode: z.string().max(100).nullable().optional(),
    text_frequency: z.string().max(100).nullable().optional(),
    text_effects: z.array(z.string().max(50)).max(20).nullable().optional(),
    voice_gender: z.string().max(100).nullable().optional(),
    voice_style: z.string().max(100).nullable().optional(),
    script_length_words: z.number().int().min(0).max(500).nullable().optional(),
    bgm_style: z.string().max(200).nullable().optional(),
    bgm_level: z.string().max(100).nullable().optional(),
    ending_type: z.string().max(200).nullable().optional(),
    hook_style: z.string().max(200).nullable().optional(),
    funnel_structure: z.string().max(300).nullable().optional(),
    content_focus: z.string().max(200).nullable().optional(),
    transition_speed: z.string().max(100).nullable().optional(),
    objective: z.string().max(300).nullable().optional()
  })
  .passthrough(); // forward-compatible with option groups added in P1-P3 without a route change

const compileSchema = z.object({
  action: z.literal('compile'),
  product_id: z.string().uuid().nullable().optional(),
  model_preset_id: z.string().uuid().nullable().optional(),
  variables: variablesSchema
});

const saveSchema = z.object({
  action: z.literal('save'),
  product_id: z.string().uuid().nullable().optional(),
  model_preset_id: z.string().uuid().nullable().optional(),
  variables: variablesSchema,
  compiled_prompt: z.string().min(1).max(20000)
});

const requestSchema = z.discriminatedUnion('action', [compileSchema, saveSchema]);

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

  const [{ data: product }, { data: modelPreset }] = await Promise.all([
    input.product_id ? supabase.from('products').select('*').eq('id', input.product_id).single() : Promise.resolve({ data: null }),
    input.model_preset_id ? supabase.from('model_presets').select('*').eq('id', input.model_preset_id).single() : Promise.resolve({ data: null })
  ]);

  if (input.action === 'compile') {
    const compiledPrompt = buildMasterVideoPrompt({ product: product ?? null, modelPreset: modelPreset ?? null, variables: input.variables });
    return NextResponse.json({ compiled_prompt: compiledPrompt });
  }

  // action === 'save'
  const guard = await requireNonViewer(supabase, user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: 403 });

  const v = input.variables;
  const { data: project, error } = await supabase
    .from('video_prompt_projects')
    .insert({
      product_id: input.product_id || null,
      model_preset_id: input.model_preset_id || null,
      creative_mode: v.creative_mode || 'Not specified',
      funnel_stage: v.funnel_stage || null,
      character_mode: v.character_mode || null,
      character_persona: v.character_persona || null,
      duration_sec: v.duration_sec ?? null,
      scene_count: v.scene_count ?? null,
      pacing: v.pacing || null,
      visual_quality: v.visual_quality || null,
      variables: v,
      compiled_prompt: input.compiled_prompt,
      status: 'generated',
      created_by: user.id
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project });
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Folded into this same file (GET by id) rather than a separate
  // app/api/video-prompt-studio/[id]/route.ts — same reasoning as the
  // flow-prompt/[id] consolidation: keeps this feature at a fixed, small
  // function count regardless of how many actions the POST side grows.
  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const { data, error } = await supabase.from('video_prompt_projects').select('*').eq('id', id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ project: data });
  }

  const { data, error } = await supabase
    .from('video_prompt_projects')
    .select('id, product_id, creative_mode, funnel_stage, duration_sec, scene_count, status, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}
