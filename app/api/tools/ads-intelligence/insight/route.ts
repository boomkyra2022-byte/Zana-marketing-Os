import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AIProviderError, callOpenAIJSON } from '@/lib/ai/openai';
import { buildAdsInsightPrompt } from '@/prompts/ads-insight';

// AI key insight for one Ads Intelligence tab. The client sends the summary
// it already computed (the same numbers on screen), so the model only
// interprets — it never fetches or recalculates Meta data.
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_DATA_CHARS = 40_000;

const bodySchema = z.object({
  tab: z.enum(['dashboard', 'spotlight', 'fatigue', 'video']),
  accountName: z.string().max(200),
  since: z.string().max(10),
  until: z.string().max(10),
  currency: z.string().max(10),
  data: z.unknown()
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'ข้อมูลสำหรับวิเคราะห์ไม่ถูกต้อง' }, { status: 400 });
  }
  if (JSON.stringify(input.data ?? null).length > MAX_DATA_CHARS) {
    return Response.json({ error: 'ข้อมูลเยอะเกินไปสำหรับ AI — ลองเลือกช่วงวันสั้นลง' }, { status: 413 });
  }

  const { system, user: userPrompt } = buildAdsInsightPrompt({ ...input, data: input.data ?? null });
  try {
    const { text, model } = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.4, timeoutMs: 55000 });
    try {
      return Response.json({ insight: JSON.parse(text), model });
    } catch {
      return Response.json({ error: 'AI ตอบกลับในรูปแบบที่อ่านไม่ได้ — ลองกดใหม่' }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof AIProviderError) return Response.json({ error: err.message }, { status: err.status });
    console.error('[ads-intelligence/insight]', err);
    return Response.json({ error: 'วิเคราะห์ด้วย AI ไม่สำเร็จ' }, { status: 500 });
  }
}
