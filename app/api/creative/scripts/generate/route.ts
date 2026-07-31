import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildScriptGeneratorPrompt, PROMPT_VERSION_SCRIPT, type ScriptGenIdeaPayload } from '@/prompts/script-generator';

export const runtime = 'nodejs';

const MAX_TOTAL = 60;

const requestSchema = z.object({
  idea_ids: z.array(z.string().uuid()).min(1),
  quantity_per_idea: z.number().int().min(1).max(10)
});

const scriptSchema = z.object({
  idea_index: z.number(),
  title: z.string(),
  hook: z.string(),
  belief: z.string().nullable(),
  story: z.string().nullable(),
  proof: z.string().nullable(),
  turning_point: z.string().nullable(),
  offer: z.string().nullable(),
  cta: z.string().nullable(),
  full_script: z.string(),
  voice_over: z.string().nullable(),
  on_screen_text: z.string().nullable(),
  estimated_duration_sec: z.number(),
  shot_list: z.array(z.string()),
  caption: z.string().nullable(),
  hashtags: z.array(z.string()),
  risks: z.string().nullable(),
  score: z.number()
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

  const totalRequested = input.idea_ids.length * input.quantity_per_idea;
  if (totalRequested > MAX_TOTAL) {
    return NextResponse.json({ error: `Requested ${totalRequested} scripts exceeds max of ${MAX_TOTAL}. Reduce ideas or quantity_per_idea.` }, { status: 400 });
  }

  const { data: ideas, error: ideasError } = await supabase.from('ideas').select('*').in('id', input.idea_ids);
  if (ideasError) return NextResponse.json({ error: ideasError.message }, { status: 500 });
  if (!ideas || ideas.length === 0) return NextResponse.json({ error: 'No matching ideas found' }, { status: 404 });

  const productIds = Array.from(new Set(ideas.map((i: any) => i.product_id).filter(Boolean)));
  const personaIds = Array.from(new Set(ideas.map((i: any) => i.persona_id).filter(Boolean)));

  const [{ data: products }, { data: personas }] = await Promise.all([
    productIds.length > 0
      ? supabase.from('products').select('*').in('id', productIds)
      : Promise.resolve({ data: [] as any[] }),
    personaIds.length > 0
      ? supabase.from('personas').select('*').in('id', personaIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  const productsById = new Map((products ?? []).map((p: any) => [p.id, p]));
  const personasById = new Map((personas ?? []).map((p: any) => [p.id, p]));

  const payload: ScriptGenIdeaPayload[] = [];
  const indexToIdea: Record<number, any> = {};
  let idx = 0;
  for (const idea of ideas) {
    const product = idea.product_id ? productsById.get(idea.product_id) : null;
    const persona = idea.persona_id ? personasById.get(idea.persona_id) : null;
    for (let v = 0; v < input.quantity_per_idea; v++) {
      payload.push({
        idea_index: idx,
        idea_id: idea.id,
        variation_index: v,
        title: idea.title,
        hook: idea.hook,
        pain_point: idea.pain_point,
        emotional_trigger: idea.emotional_trigger,
        visual_concept: idea.visual_concept,
        cta: idea.cta,
        product: product
          ? { name: product.product_name, brand: product.brand, usp: product.usp, allowed_claims: product.allowed_claims, banned_claims: product.banned_claims }
          : null,
        persona: persona ? { name: persona.name, age_range: persona.age_range, pains: persona.pains ?? [], desires: persona.desires ?? [] } : null
      });
      indexToIdea[idx] = idea;
      idx++;
    }
  }

  const { system, user: userPrompt } = buildScriptGeneratorPrompt(payload);

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 90000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating scripts' }, { status: 500 });
  }

  let scripts: z.infer<typeof scriptSchema>[];
  try {
    const rawJson = JSON.parse(aiText);
    const arraySchema = z.object({ scripts: z.array(scriptSchema) });
    const validated = arraySchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    scripts = validated.data.scripts;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const rows = scripts.map((s) => {
    const idea = indexToIdea[s.idea_index];
    return {
      idea_id: idea?.id ?? null,
      title: s.title,
      full_script: s.full_script,
      shot_list: s.shot_list,
      voice_over: s.voice_over,
      on_screen_text: s.on_screen_text,
      cta: s.cta,
      estimated_duration_sec: s.estimated_duration_sec,
      score: s.score,
      status: 'DRAFT',
      hook: s.hook,
      belief: s.belief,
      story: s.story,
      proof: s.proof,
      turning_point: s.turning_point,
      offer: s.offer,
      caption: s.caption,
      hashtags: s.hashtags,
      risks: s.risks
    };
  });

  const { data: inserted, error: insertError } = await supabase.from('scripts').insert(rows).select('*');
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_scripts',
    entity_type: 'script',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_SCRIPT, count: inserted?.length ?? 0 },
    reason: `Generated ${rows.length} scripts from ${ideas.length} ideas`
  });

  return NextResponse.json({ scripts: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION_SCRIPT });
}
