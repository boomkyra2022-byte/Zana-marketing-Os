import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON } from '@/lib/ai/openai';
import { buildAutofillPrompt, STUDIO_FIELDS } from '@/prompts/content-studio';
import { errorOf, runGenerate, type Emit } from '@/lib/content-studio/generate';

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
