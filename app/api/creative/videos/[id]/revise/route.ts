import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildV2RewritePrompt, PROMPT_VERSION_V2_REWRITE } from '@/prompts/v2-rewrite';

export const runtime = 'nodejs';
export const maxDuration = 120;

const requestSchema = z.object({
  persona_id: z.string().uuid().nullable().optional()
});

const revisedScriptSchema = z.object({
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

const rewriteResponseSchema = z.object({
  priority_fixes: z.array(z.string()).min(1).max(5),
  revised_script: revisedScriptSchema,
  revised_edit_plan: z.string()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* body optional */
  }
  const input = requestSchema.parse(body ?? {});

  const { data: video, error: videoError } = await supabase.from('videos').select('*').eq('id', params.id).single();
  if (videoError || !video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  const { data: analysis, error: analysisError } = await supabase
    .from('video_analysis')
    .select('*')
    .eq('video_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (analysisError || !analysis) return NextResponse.json({ error: 'No analysis found for this video yet — run Analyze first' }, { status: 404 });

  const [{ data: product }, personaResult, originalScriptResult] = await Promise.all([
    video.product_id ? supabase.from('products').select('*').eq('id', video.product_id).single() : Promise.resolve({ data: null }),
    input.persona_id ? supabase.from('personas').select('*').eq('id', input.persona_id).single() : Promise.resolve({ data: null }),
    video.script_id ? supabase.from('scripts').select('idea_id, hook, cta').eq('id', video.script_id).single() : Promise.resolve({ data: null })
  ]);
  const persona = personaResult.data;
  const originalScript = originalScriptResult.data;

  const { system, user: userPrompt } = buildV2RewritePrompt({
    product: product ?? null,
    persona: persona ? { name: (persona as any).name, age_range: (persona as any).age_range, pains: (persona as any).pains ?? [], desires: (persona as any).desires ?? [] } : null,
    transcript: analysis.transcript ?? '',
    scoreTotal: analysis.score_total ?? 0,
    verdict: analysis.verdict ?? 'REVISE',
    scoreBreakdown: analysis.score_breakdown ?? {},
    timelineFindings: analysis.timeline_findings ?? [],
    storyboardComparison: analysis.storyboard_comparison ?? null,
    riskFlags: analysis.risk_flags ?? [],
    originalHook: originalScript?.hook ?? null,
    originalCta: originalScript?.cta ?? null
  });

  let aiText: string;
  let model: string;
  try {
    const result = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.6, timeoutMs: 90000 });
    aiText = result.text;
    model = result.model;
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Unknown error generating V2 recommendation' }, { status: 500 });
  }

  let rewrite: z.infer<typeof rewriteResponseSchema>;
  try {
    const rawJson = JSON.parse(aiText);
    const validated = rewriteResponseSchema.safeParse(rawJson);
    if (!validated.success) {
      return NextResponse.json({ error: 'AI response did not match expected schema', details: validated.error.flatten() }, { status: 502 });
    }
    rewrite = validated.data;
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 502 });
  }

  const { data: newScript, error: scriptInsertError } = await supabase
    .from('scripts')
    .insert({
      idea_id: originalScript?.idea_id ?? null,
      title: rewrite.revised_script.title,
      full_script: rewrite.revised_script.full_script,
      shot_list: rewrite.revised_script.shot_list,
      voice_over: rewrite.revised_script.voice_over,
      on_screen_text: rewrite.revised_script.on_screen_text,
      cta: rewrite.revised_script.cta,
      estimated_duration_sec: rewrite.revised_script.estimated_duration_sec,
      score: rewrite.revised_script.score,
      status: 'DRAFT',
      hook: rewrite.revised_script.hook,
      belief: rewrite.revised_script.belief,
      story: rewrite.revised_script.story,
      proof: rewrite.revised_script.proof,
      turning_point: rewrite.revised_script.turning_point,
      offer: rewrite.revised_script.offer,
      caption: rewrite.revised_script.caption,
      hashtags: rewrite.revised_script.hashtags,
      risks: rewrite.revised_script.risks
    })
    .select('*')
    .single();

  if (scriptInsertError) return NextResponse.json({ error: scriptInsertError.message }, { status: 500 });

  const { data: updatedAnalysis, error: updateError } = await supabase
    .from('video_analysis')
    .update({
      priority_fixes: rewrite.priority_fixes,
      revised_script: { ...rewrite.revised_script, script_id: newScript.id },
      revised_edit_plan: rewrite.revised_edit_plan
    })
    .eq('id', analysis.id)
    .select('*')
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'ai_revise_video_v2',
    entity_type: 'video_analysis',
    entity_id: analysis.id,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_V2_REWRITE, new_script_id: newScript.id },
    reason: `Generated V2 recommendation for video ${video.id}`
  });

  return NextResponse.json({ analysis: updatedAnalysis, revised_script: newScript });
}
