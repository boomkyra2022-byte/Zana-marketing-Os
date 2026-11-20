import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fetchAdsReport, MetaReportError, normalizeAccountId } from '@/lib/meta/ads-report';

// Ads Intelligence — read-only pull of Meta ad-level daily insights for a
// date range. Only GET calls to Meta; nothing here changes an ad.
export const runtime = 'nodejs';
export const maxDuration = 60;

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const bodySchema = z.object({
  accountId: z.string().trim().min(5).max(40),
  since: z.string().regex(dateRe),
  until: z.string().regex(dateRe)
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
    return Response.json({ error: 'ข้อมูลไม่ครบ — เลือกบัญชีโฆษณาและช่วงวันที่' }, { status: 400 });
  }

  const accountId = normalizeAccountId(input.accountId);
  if (!accountId) return Response.json({ error: 'ID บัญชีโฆษณาไม่ถูกต้อง (ตัวเลข หรือ act_ตามด้วยตัวเลข)' }, { status: 400 });
  if (input.since > input.until) return Response.json({ error: 'วันเริ่มต้องไม่เกินวันสิ้นสุด' }, { status: 400 });
  const days = (Date.parse(input.until) - Date.parse(input.since)) / 86400000;
  if (days > 92) return Response.json({ error: 'เลือกช่วงวันได้ไม่เกิน 92 วัน (ข้อมูลรายวันต่อโฆษณา)' }, { status: 400 });

  try {
    const report = await fetchAdsReport({ accountId, since: input.since, until: input.until });
    return Response.json(report);
  } catch (err) {
    if (err instanceof MetaReportError) return Response.json({ error: err.message }, { status: err.status });
    console.error('[ads-intelligence]', err);
    return Response.json({ error: 'ดึงข้อมูลไม่สำเร็จ — ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
