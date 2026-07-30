import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getKnowledgeContext } from '@/lib/ai/knowledge-context';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';

export const runtime = 'nodejs';

const PROMPT_VERSION = 'script-generate-v1';
const MAX_IDEAS_PER_CALL = 40;

const requestSchema = z.object({
  idea_ids: z.array(z.string().uuid()).min(1).max(MAX_IDEAS_PER_CALL)
});

const timedScriptSchema = z.object({
  '0-3s': z.string(),
  '3-10s': z.string(),
  '10-20s': z.string(),
  '20-30s': z.string(),
  '30-45s': z.string()
});

const scriptSchema = z.object({
  idea_index: z.number().int().min(0),
  hook: z.string(),
  belief: z.string().nullable(),
  story: z.string().nullable(),
  proof: z.string().nullable(),
  turning_point: z.string().nullable(),
  offer: z.string().nullable(),
  cta: z.string().nullable(),
  full_script: z.string(),
  timed_script: timedScriptSchema,
  shot_list: z.array(z.string()),
  caption: z.string().nullable(),
  hashtags: z.array(z.string()),
  thumbnail_text: z.string().nullable(),
  estimated_duration_sec: z.number().min(0).max(180),
  production_notes: z.string().nullable(),
  score: z.number().min(0).max(100)
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

  const { data: ideas, error: ideaError } = await supabase
    .from('ideas')
    .select('*, products(product_name, brand, usp, allowed_claims, banned_claims), personas(name, age_range, pains, desires)')
    .in('id', parsed.data.idea_ids);

  if (ideaError || !ideas || ideas.length === 0) {
    return NextResponse.json({ error: ideaError?.message || 'No matching ideas found' }, { status: 404 });
  }

  const firstIdea = ideas[0] as any;
  const knowledgeContext = await getKnowledgeContext(supabase, {
    productId: firstIdea.product_id,
    personaId: firstIdea.persona_id
  });

  const systemPrompt = `You are a senior TikTok/social-commerce scriptwriter for Thai DTC brands.
For EACH idea provided, write a full video script using this exact structure: HOOK -> BELIEF -> STORY -> PROOF -> TURNING POINT -> OFFER -> CTA.
Return JSON: {"scripts": [...]} with exactly one entry per idea, in the same order, each shaped:
{
  "idea_index": number (0-based index matching the input ideas array),
  "hook": string (Thai, the literal opening line spoken/shown 0-3s),
  "belief": string|null,
  "story": string|null,
  "proof": string|null,
  "turning_point": string|null,
  "offer": string|null,
  "cta": string|null,
  "full_script": string (the complete script, Thai, all sections combined readable),
  "timed_script": {"0-3s": string, "3-10s": string, "10-20s": string, "20-30s": string, "30-45s": string},
  "shot_list": string[] (each item one shot description),
  "caption": string|null (social post caption, Thai),
  "hashtags": string[] (without # symbol),
  "thumbnail_text": string|null (short on-thumbnail text overlay),
  "estimated_duration_sec": number,
  "production_notes": string|null,
  "score": number (0-100, self-assessed script score: Hook20+Clarity15+EmotionalTrigger15+ProductFit15+Proof10+Offer10+CTA10+Compliance5, be honest not inflated)
}
Ground everything in the Knowledge Base and product claims below — NEVER use banned claims, only allowed claims.
Knowledge Base:
${knowledgeContext}`;

  const ideasPayload = ideas.map((idea: any, i: number) => ({
    idea_index: i,
    title: idea.title,
    hook: idea.hook,
    pain_point: idea.pain_point,
    emotional_trigger: idea.emotional_trigger,
    visual_concept: idea.visual_concept,
    cta: idea.cta,
    product: idea.products
      ? {
          name: idea.products.product_name,
          brand: idea.products.brand,
          usp: idea.products.usp,
          allowed_claims: idea.products.allowed_claims,
          banned_claims: idea.products.banned_claims
        }
      : null,
    persona: idea.personas
      ? { name: idea.personas.name, age_range: idea.personas.age_range, pains: idea.personas.pains, desires: idea.personas.desires }
      : null
  }));

  const userPrompt = `Write scripts for these ${ideasPayload.length} ideas:\n${JSON.stringify(ideasPayload, null, 2)}`;

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system: systemPrompt, user: userPrompt, temperature: 0.6, timeoutMs: 60000 });
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
      return NextResponse.json(
        { error: 'AI response did not match expected schema', details: validated.error.flatten() },
        { status: 502 }
      );
    }
    scripts = validated.data.scripts;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const rows = scripts
    .filter((s) => ideas[s.idea_index])
    .map((s) => ({
      idea_id: (ideas[s.idea_index] as any).id,
      hook: s.hook,
      belief: s.belief,
      story: s.story,
      proof: s.proof,
      turning_point: s.turning_point,
      offer: s.offer,
      cta: s.cta,
      full_script: s.full_script,
      timed_script: s.timed_script,
      shot_list: s.shot_list,
      caption: s.caption,
      hashtags: s.hashtags,
      thumbnail_text: s.thumbnail_text,
      estimated_duration_sec: s.estimated_duration_sec,
      production_notes: s.production_notes,
      score: s.score,
      status: 'DRAFT'
    }));

  const { data: inserted, error: insertError } = await supabase.from('scripts').insert(rows).select('*');
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const scriptedIdeaIds = rows.map((r) => r.idea_id);
  if (scriptedIdeaIds.length > 0) {
    await supabase.from('ideas').update({ status: 'SCRIPT' }).in('id', scriptedIdeaIds);
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_generate_scripts',
    entity_type: 'script',
    entity_id: null,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION, count: inserted?.length ?? 0 },
    reason: `Generated ${rows.length} scripts from selected ideas`
  });

  return NextResponse.json({ scripts: inserted, provider: 'openai', model, prompt_version: PROMPT_VERSION });
}
