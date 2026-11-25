import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { MetaReportError, normalizeAccountId } from '@/lib/meta/ads-report';
import { fetchAdsBoard } from '@/lib/meta/ads-board';

// Ads Board — read-only pull of one Ads Manager-style table (campaign / ad
// set / ad) for a date range. Only GET calls to Meta; nothing here changes an ad.
export const runtime = 'nodejs';
export const maxDuration = 60;

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const bodySchema = z.object({
  accountId: z.string().trim().min(5).max(40),
  since: z.string().regex(dateRe),
  until: z.string().regex(dateRe),
  level: z.enum(['campaign', 'adset', 'ad'])
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
  if (!accountId) return Response.json({ error: 'ID บัญชีโฆษณาไม่ถูกต้อง' }, { status: 400 });
  if (input.since > input.until) return Response.json({ error: 'วันเริ่มต้องไม่เกินวันสิ้นสุด' }, { status: 400 });
  const days = (Date.parse(input.until) - Date.parse(input.since)) / 86400000;
  if (days > 365) return Response.json({ error: 'เลือกช่วงวันได้ไม่เกิน 365 วัน' }, { status: 400 });

  try {
    return Response.json(await fetchAdsBoard({ accountId, since: input.since, until: input.until, level: input.level }));
  } catch (err) {
    if (err instanceof MetaReportError) return Response.json({ error: err.message }, { status: err.status });
    console.error('[ads-board]', err);
    return Response.json({ error: 'ดึงข้อมูลไม่สำเร็จ — ลองใหม่อีกครั้ง' }, { status: 500 });
  }
}
