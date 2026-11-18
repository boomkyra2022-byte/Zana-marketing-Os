import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, callOpenAIWebSearch, AIProviderError } from '@/lib/ai/openai';
import {
  buildAutofillPrompt,
  buildContentStudioPrompt,
  buildTrendScoutPrompt,
  PROMPT_VERSION_CONTENT_STUDIO,
  STUDIO_FIELDS,
  STUDIO_FORMATS,
  type TrendResearch
} from '@/prompts/content-studio';

// Content Studio AI — two modes in one function (Vercel function count):
//   mode "generate": Brand Card + approved examples → N pieces with a
//                    retention self-check per piece
//   mode "autofill": raw pasted client info → Brand Card fields
//
// generate + `stream: true` answers with NDJSON instead of one JSON body:
// one {"type":"stage"} line as each real step starts (brand → [scout] →
// examples → write → check), then {"type":"done", items, ...} or {"type":"error", error}.
// The Content Studio nail-salon scene (components/content-studio-salon.tsx)
// moves its agents on these lines. Without `stream` the response is the same
// single JSON as before.
export const runtime = 'nodejs';

const generateSchema = z.object({
  mode: z.literal('generate'),
  client_id: z.string().uuid(),
  format: z.string().min(1).max(50),
  funnel: z.enum(['tofu', 'mofu', 'bofu']).default('tofu'),
  topic: z.string().max(2000).default(''),
  count: z.number().int().min(1).max(5).default(3),
  stream: z.boolean().optional(),
  // "แตกเป็นไอเดีย": the brief / plan the ideas are split from
  source: z.string().max(30000).optional()
});
const autofillSchema = z.object({ mode: z.literal('autofill'), raw: z.string().min(1).max(40000) });

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

type Emit = (event: Record<string, unknown>) => void;
type Supabase = ReturnType<typeof createClient>;

// A generate step that failed with a user-facing Thai message + HTTP status.
class StepError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function errorOf(err: unknown): { message: string; status: number } {
  if (err instanceof StepError || err instanceof AIProviderError) return { message: err.message, status: err.status };
  return { message: 'เกิดข้อผิดพลาด ลองอีกครั้ง', status: 500 };
}

async function runGenerate(supabase: Supabase, userId: string, data: z.infer<typeof generateSchema>, emit: Emit) {
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

function streamGenerate(run: (emit: Emit) => Promise<Record<string, unknown>>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event) => controller.enqueue(enc.encode(JSON.stringify(event) + '\n'));
      try {
        emit({ type: 'done', ...(await run(emit)) });
      } catch (err) {
        const { message, status } = errorOf(err);
        emit({ type: 'error', error: message, status });
      }
      controller.close();
    }
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' }
  });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);

  try {
    if (body?.mode === 'autofill') {
      const input = autofillSchema.safeParse(body);
      if (!input.success) return NextResponse.json({ error: 'วางข้อมูลลูกค้าก่อน' }, { status: 400 });
      const { system, user: userPrompt } = buildAutofillPrompt(input.data.raw);
      const { text } = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.2, timeoutMs: 60000 });
      const raw = JSON.parse(text);
      const fields: Record<string, string> = {};
      for (const f of STUDIO_FIELDS) if (typeof raw?.[f.key] === 'string') fields[f.key] = raw[f.key].trim();
      return NextResponse.json({ fields });
    }

    const input = generateSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: 'คำขอไม่ถูกต้อง', details: input.error.flatten() }, { status: 400 });

    if (input.data.stream) return streamGenerate((emit) => runGenerate(supabase, user.id, input.data, emit));
    return NextResponse.json(await runGenerate(supabase, user.id, input.data, () => {}));
  } catch (err) {
    const { message, status } = errorOf(err);
    return NextResponse.json({ error: message }, { status });
  }
}
