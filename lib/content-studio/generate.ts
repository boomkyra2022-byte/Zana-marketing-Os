import { z } from 'zod';
import type { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, callOpenAIWebSearch, AIProviderError } from '@/lib/ai/openai';
import {
  buildContentStudioPrompt,
  buildTrendScoutPrompt,
  PROMPT_VERSION_CONTENT_STUDIO,
  STUDIO_FORMATS,
  type TrendResearch
} from '@/prompts/content-studio';

// Content Studio generate pipeline (brand → [scout] → examples → write →
// check), shared by /api/content-studio/ai and the Monday cron
// (/api/cron/content-studio-weekly). `emit` reports each real step.

export interface GenerateInput {
  client_id: string;
  format: string;
  funnel: 'tofu' | 'mofu' | 'bofu';
  topic: string;
  count: number;
  source?: string;
}

const itemSchema = z.object({
  title: z.string(),
  body: z.string(),
  retention: z
    .object({
      score: z.coerce.number().min(0).max(10),
      checks: z.array(z.object({ name: z.string(), pass: z.boolean(), fix: z.string().optional().default('') })).default([])
    })
    .nullable()
    .optional()
});

export type Emit = (event: Record<string, unknown>) => void;
// Session client (route) or service-role client (weekly cron) — same queries.
type Supabase = ReturnType<typeof createClient>;

// A generate step that failed with a user-facing Thai message + HTTP status.
export class StepError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function errorOf(err: unknown): { message: string; status: number } {
  if (err instanceof StepError || err instanceof AIProviderError) return { message: err.message, status: err.status };
  return { message: 'เกิดข้อผิดพลาด ลองอีกครั้ง', status: 500 };
}

export async function runGenerate(supabase: Supabase, userId: string | null, data: GenerateInput, emit: Emit) {
  emit({ type: 'stage', stage: 'brand' });
  const { data: client, error: cErr } = await supabase.from('studio_clients').select('*').eq('id', data.client_id).maybeSingle();
  if (cErr || !client) throw new StepError('ไม่พบลูกค้า', 404);

  // Trend Scout (planning formats): search the web for current trends and
  // upcoming dates. A failed search does not stop the brief — it continues
  // with every trend marked [ต้องเช็ก] — except a bad key / no credit, which
  // would fail the writing step anyway.
  const fmt = STUDIO_FORMATS.find((f) => f.id === data.format);
  let research: TrendResearch | null = null;
  let recentThemes: string[] = [];
  if (fmt?.research) {
    emit({ type: 'stage', stage: 'scout' });
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [found, recent] = await Promise.all([
      (async () => {
        try {
          const { instructions, input } = buildTrendScoutPrompt(client, data.format);
          const r = await callOpenAIWebSearch({ instructions, input, timeoutMs: 60000 });
          return { text: r.text.slice(0, 8000), sources: r.sources.slice(0, 15) };
        } catch (err) {
          if (err instanceof AIProviderError && (err.status === 429 || /API key/i.test(err.message))) throw err;
          console.error('[content-studio] trend scout failed:', err);
          return null;
        }
      })(),
      supabase.from('studio_posts').select('title').eq('client_id', client.id).in('format', ['brief_week', 'plan30', 'plan7', 'mu_week', 'collection']).gte('created_at', since).limit(10)
    ]);
    research = found;
    recentThemes = (recent.data ?? []).map((x) => x.title);
    emit({ type: 'stage', stage: 'scouted', ok: !!research, sources: research?.sources.length ?? 0 });
  }

  // Few-shot: the latest approved/used pieces of the same format for this client.
  emit({ type: 'stage', stage: 'examples' });
  const { data: ex } = await supabase
    .from('studio_posts')
    .select('title, body')
    .eq('client_id', client.id)
    .eq('format', data.format)
    .in('status', ['approved', 'used'])
    .order('updated_at', { ascending: false })
    .limit(3);

  const { system, user: userPrompt, count } = buildContentStudioPrompt({
    client,
    formatId: data.format,
    funnel: data.funnel,
    topic: data.topic,
    count: data.count,
    examples: (ex ?? []).map((x) => ({ title: x.title, body: x.body })),
    research,
    recentThemes,
    source: data.source
  });

  emit({ type: 'stage', stage: 'write', examples: ex?.length ?? 0, count });
  const { text, model } = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 90000 });

  emit({ type: 'stage', stage: 'check' });
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new StepError('AI ตอบกลับมาไม่ใช่ JSON ลองกดสร้างใหม่', 502);
  }
  const items = z.object({ items: z.array(itemSchema) }).safeParse(parsedJson);
  if (!items.success || !items.data.items.length) throw new StepError('AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่', 502);

  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: 'ai_content_studio_generate',
    entity_type: 'studio_client',
    entity_id: client.id,
    new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_CONTENT_STUDIO, format: data.format, funnel: data.funnel, count: items.data.items.length },
    reason: `Content Studio: ${items.data.items.length} pieces for ${client.name}`
  });

  return { items: items.data.items.slice(0, count), model, prompt_version: PROMPT_VERSION_CONTENT_STUDIO, sources: research?.sources ?? [] };
}
