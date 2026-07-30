import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';

export const runtime = 'nodejs';

const PROMPT_VERSION = 'storyboard-generate-v1';
const MAX_SCRIPTS_PER_CALL = 20;

const requestSchema = z.object({
  script_ids: z.array(z.string().uuid()).min(1).max(MAX_SCRIPTS_PER_CALL)
});

const sceneSchema = z.object({
  scene_number: z.number().int().min(1),
  time_range: z.string(), // e.g. "0-5s"
  source_type: z.enum(['AI', 'FOOTAGE']),
  camera_movement: z.string().nullable(),
  visual_description: z.string(),
  voice_over: z.string().nullable(),
  sound_music: z.string().nullable(),
  notes: z.string().nullable()
});

const storyboardSchema = z.object({
  script_index: z.number().int().min(0),
  title: z.string().nullable(),
  total_duration_sec: z.number().min(0).max(180),
  tone_mood: z.string().nullable(),
  key_message: z.string().nullable(),
  scenes: z.array(sceneSchema).min(1)
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

  const { data: scripts, error: scriptError } = await supabase
    .from('scripts')
    .select('*, ideas(title, product_id, products(product_name, brand))')
    .in('id', parsed.data.script_ids);

  if (scriptError || !scripts || scripts.length === 0) {
    return NextResponse.json({ error: scriptError?.message || 'No matching scripts found' }, { status: 404 });
  }

  const systemPrompt = `You are a video producer creating shooting storyboards for short-form TikTok ads (Thai DTC brands).
For EACH script provided, break it down into a scene-by-scene storyboard. Mark each scene as "AI" (AI-generated b-roll/imagery, e.g. imagined moments, close-ups that don't need real filming) or "FOOTAGE" (must be shot with real camera/actors/product).
Return JSON: {"storyboards": [...]} with exactly one entry per script, in the same order:
{
  "script_index": number (0-based, matching input order),
  "title": string|null,
  "total_duration_sec": number,
  "tone_mood": string|null (Thai description of overall tone),
  "key_message": string|null (Thai, the one-line takeaway),
  "scenes": [
    {
      "scene_number": number,
      "time_range": string (e.g. "0-5s"),
      "source_type": "AI"|"FOOTAGE",
      "camera_movement": string|null (e.g. "Close Up, Slow Motion"),
      "visual_description": string (Thai, what's shown, frame by frame if useful),
      "voice_over": string|null (Thai, matches the script's timed sections),
      "sound_music": string|null,
      "notes": string|null
    }
  ]
}
Use the script's timed_script sections (0-3s, 3-10s, 10-20s, 20-30s, 30-45s) as pacing guidance for scene time_range boundaries, but you may subdivide further.
Prefer FOOTAGE for real product close-ups, real usage, real testimonials. Prefer AI for imagined/emotional b-roll, transitions, flashbacks, abstract visuals.`;

  const scriptsPayload = scripts.map((s: any, i: number) => ({
    script_index: i,
    product: s.ideas?.products?.product_name ?? null,
    brand: s.ideas?.products?.brand ?? null,
    hook: s.hook,
    belief: s.belief,
    story: s.story,
    proof: s.proof,
    turning_point: s.turning_point,
    offer: s.offer,
    cta: s.cta,
    timed_script: s.timed_script,
    full_script: s.full_script,
    estimated_duration_sec: s.estimated_duration_sec
  }));

  const userPrompt = `Create storyboards for these ${scriptsPayload.length} scripts:\n${JSON.stringify(scriptsPayload, null, 2)}`;

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system: systemPrompt, user: userPrompt, temperature: 0.6, timeoutMs: 60000 });
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
      return NextResponse.json(
        { error: 'AI response did not match expected schema', details: validated.error.flatten() },
        { status: 502 }
      );
    }
    storyboards = validated.data.storyboards;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const rows = storyboards
    .filter((sb) => scripts[sb.script_index])
    .map((sb) => ({
      script_id: (scripts[sb.script_index] as any).id,
      creative_id: generateCreativeId('SB'),
      title: sb.title,
      total_duration_sec: sb.total_duration_sec,
      tone_mood: sb.tone_mood,
      key_message: sb.key_message,
      scenes: sb.scenes,
      status: 'DRAFT'
    }));

  const { data: inserted, error: insertError } = await supabase.from('storyboards').insert(rows).select('*');
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_storyboards',
    entity_type: 'storyboard',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION, count: inserted?.length ?? 0 },
    reason: `Generated ${rows.length} storyboards from selected scripts`
  });

  return NextResponse.json({ storyboards: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION });
}
