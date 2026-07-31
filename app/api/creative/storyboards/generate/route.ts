import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import {
  buildStoryboardGeneratorPrompt,
  PROMPT_VERSION_STORYBOARD,
  type StoryboardGenScriptPayload
} from '@/prompts/storyboard-generator';

export const runtime = 'nodejs';

const MAX_SCRIPTS = 20;

const requestSchema = z.object({
  script_ids: z.array(z.string().uuid()).min(1).max(MAX_SCRIPTS),
  scene_count: z.number().int().min(3).max(30),
  duration_target_sec: z.number().int().min(5).max(300),
  video_style: z.string().min(1),
  ai_footage_mix: z.string().min(1)
});

const sceneSchema = z.object({
  scene_number: z.number(),
  time_range: z.string(),
  scene_objective: z.string().nullable(),
  visual_description: z.string(),
  source_type: z.enum(['AI Generated', 'Real Footage', 'Product Footage', 'B-roll']),
  subject_action: z.string().nullable(),
  camera_shot: z.string().nullable(),
  camera_movement: z.string().nullable(),
  voice_over: z.string().nullable(),
  dialogue: z.string().nullable(),
  on_screen_text: z.string().nullable(),
  sound_cue: z.string().nullable(),
  music_cue: z.string().nullable(),
  transition: z.string().nullable(),
  product_placement: z.string().nullable(),
  editing_note: z.string().nullable(),
  ai_video_prompt: z.string().nullable()
});

const storyboardSchema = z.object({
  script_index: z.number(),
  title: z.string().nullable(),
  total_duration_sec: z.number(),
  tone_mood: z.string().nullable(),
  key_message: z.string().nullable(),
  scenes: z.array(sceneSchema)
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

  const { data: scripts, error: scriptsError } = await supabase.from('scripts').select('*').in('id', input.script_ids);
  if (scriptsError) return NextResponse.json({ error: scriptsError.message }, { status: 500 });
  if (!scripts || scripts.length === 0) return NextResponse.json({ error: 'No matching scripts found' }, { status: 404 });

  const ideaIds = Array.from(new Set(scripts.map((s: any) => s.idea_id).filter(Boolean)));
  const { data: ideas } = ideaIds.length > 0 ? await supabase.from('ideas').select('id, product_id').in('id', ideaIds) : { data: [] as any[] };
  const ideaById = new Map((ideas ?? []).map((i: any) => [i.id, i]));
  const productIds = Array.from(new Set((ideas ?? []).map((i: any) => i.product_id).filter(Boolean)));
  const { data: products } = productIds.length > 0 ? await supabase.from('products').select('id, product_name, brand').in('id', productIds) : { data: [] as any[] };
  const productById = new Map((products ?? []).map((p: any) => [p.id, p]));

  const payload: StoryboardGenScriptPayload[] = scripts.map((s: any, i: number) => {
    const idea = s.idea_id ? ideaById.get(s.idea_id) : null;
    const product = idea?.product_id ? productById.get(idea.product_id) : null;
    return {
      script_index: i,
      script_id: s.id,
      product: product?.product_name ?? null,
      brand: product?.brand ?? null,
      hook: s.hook,
      belief: s.belief,
      story: s.story,
      proof: s.proof,
      turning_point: s.turning_point,
      offer: s.offer,
      cta: s.cta,
      full_script: s.full_script,
      estimated_duration_sec: s.estimated_duration_sec
    };
  });

  const { system, user: userPrompt } = buildStoryboardGeneratorPrompt(payload, {
    sceneCount: input.scene_count,
    durationTargetSec: input.duration_target_sec,
    videoStyle: input.video_style,
    aiFootageMix: input.ai_footage_mix
  });

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.7, timeoutMs: 120000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating storyboards' }, { status: 500 });
  }

  let storyboards: z.infer<typeof storyboardSchema>[];
  try {
    const rawJson = JSON.parse(aiText);
    const arraySchema = z.object({ storyboards: z.array(storyboardSchema) });
    const validated = arraySchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    storyboards = validated.data.storyboards;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const rows = storyboards.map((sb) => {
    const script = scripts[sb.script_index];
    return {
      creative_id: generateCreativeId('SB'),
      script_id: script?.id ?? null,
      title: sb.title,
      total_duration_sec: sb.total_duration_sec,
      scene_count: sb.scenes.length,
      style: input.video_style,
      tone_mood: sb.tone_mood,
      key_message: sb.key_message,
      scenes: sb.scenes,
      status: 'DRAFT'
    };
  });

  const { data: inserted, error: insertError } = await supabase.from('storyboards').insert(rows).select('*');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_storyboards',
    entity_type: 'storyboard',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_STORYBOARD, count: inserted?.length ?? 0 },
    reason: `Generated ${rows.length} storyboards from ${scripts.length} scripts`
  });

  return NextResponse.json({ storyboards: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION_STORYBOARD });
}
