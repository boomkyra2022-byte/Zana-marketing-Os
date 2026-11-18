import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import {
  buildAutofillPrompt,
  buildContentStudioPrompt,
  PROMPT_VERSION_CONTENT_STUDIO,
  STUDIO_FIELDS
} from '@/prompts/content-studio';

// Content Studio AI — two modes in one function (Vercel function count):
//   mode "generate": Brand Card + approved examples → N pieces with a
//                    retention self-check per piece
//   mode "autofill": raw pasted client info → Brand Card fields
export const runtime = 'nodejs';

const generateSchema = z.object({
  mode: z.literal('generate'),
  client_id: z.string().uuid(),
  format: z.string().min(1).max(50),
  funnel: z.enum(['tofu', 'mofu', 'bofu']).default('tofu'),
  topic: z.string().max(2000).default(''),
  count: z.number().int().min(1).max(5).default(3)
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

    const { data: client, error: cErr } = await supabase.from('studio_clients').select('*').eq('id', input.data.client_id).maybeSingle();
    if (cErr || !client) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });

    // Few-shot: the latest approved/used pieces of the same format for this client.
    const { data: ex } = await supabase
      .from('studio_posts')
      .select('title, body')
      .eq('client_id', client.id)
      .eq('format', input.data.format)
      .in('status', ['approved', 'used'])
      .order('updated_at', { ascending: false })
      .limit(3);

    const { system, user: userPrompt, count } = buildContentStudioPrompt({
      client,
      formatId: input.data.format,
      funnel: input.data.funnel,
      topic: input.data.topic,
      count: input.data.count,
      examples: (ex ?? []).map((x) => ({ title: x.title, body: x.body }))
    });

    const { text, model } = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.85, timeoutMs: 90000 });
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'AI ตอบกลับมาไม่ใช่ JSON ลองกดสร้างใหม่' }, { status: 502 });
    }
    const items = z.object({ items: z.array(itemSchema) }).safeParse(parsedJson);
    if (!items.success || !items.data.items.length) return NextResponse.json({ error: 'AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่' }, { status: 502 });

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'ai_content_studio_generate',
      entity_type: 'studio_client',
      entity_id: client.id,
      new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_CONTENT_STUDIO, format: input.data.format, funnel: input.data.funnel, count: items.data.items.length },
      reason: `Content Studio: ${items.data.items.length} pieces for ${client.name}`
    });

    return NextResponse.json({ items: items.data.items.slice(0, count), model, prompt_version: PROMPT_VERSION_CONTENT_STUDIO });
  } catch (err) {
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด ลองอีกครั้ง' }, { status: 500 });
  }
}
