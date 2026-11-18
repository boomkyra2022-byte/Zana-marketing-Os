import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { errorOf, runGenerate } from '@/lib/content-studio/generate';

// Weekly managed-account loop, automatic part (explicit user request
// 2026-11-18 "ทำอัตโนมัติด้วย"): every morning (vercel.json cron, 01:00 UTC =
// 08:00 Bangkok) make this week's Creative Brief for each opted-in client
// (studio_clients.weekly_auto, migration 0034) that has none since Monday,
// and save it to the library as a draft. Monday does the work; later days
// only pick up a client Monday couldn't finish (time budget / failure).
// Vercel sends `Authorization: Bearer $CRON_SECRET`.
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BUDGET_MS = 200_000; // leave room for one more brief inside maxDuration

function weekStartISO(now: number) {
  const bkk = new Date(now + 7 * 3600e3);
  const back = (bkk.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() - back) - 7 * 3600e3).toISOString();
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const t0 = Date.now();
  const supabase = createServiceRoleClient();
  const since = weekStartISO(t0);

  const { data: clients, error } = await supabase.from('studio_clients').select('id, name').eq('weekly_auto', true).order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { client: string; status: string; title?: string; error?: string }[] = [];
  for (const c of (clients ?? []) as { id: string; name: string }[]) {
    if (Date.now() - t0 > BUDGET_MS) {
      results.push({ client: c.name, status: 'deferred' });
      continue;
    }
    const { count } = await supabase
      .from('studio_posts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', c.id)
      .eq('format', 'brief_week')
      .gte('created_at', since);
    if (count) {
      results.push({ client: c.name, status: 'already' });
      continue;
    }
    try {
      const out = await runGenerate(supabase, null, { client_id: c.id, format: 'brief_week', funnel: 'tofu', topic: '', count: 1 }, () => {});
      const item = out.items[0];
      const links = out.sources.length ? '\n\nแหล่งอ้างอิง (Trend Scout):\n' + out.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n') : '';
      const { error: insErr } = await supabase.from('studio_posts').insert({
        client_id: c.id,
        format: 'brief_week',
        funnel: 'tofu',
        title: item.title.slice(0, 300),
        body: (item.body + links).slice(0, 30000),
        topic: 'อัตโนมัติ: รอบหาข่าวประจำสัปดาห์',
        retention: item.retention ?? null,
        status: 'draft'
      });
      if (insErr) throw new Error(insErr.message);
      results.push({ client: c.name, status: 'created', title: item.title });
    } catch (err) {
      const known = errorOf(err);
      const message = known.status === 500 && err instanceof Error ? err.message : known.message;
      console.error('[cron content-studio-weekly]', c.name, message);
      results.push({ client: c.name, status: 'failed', error: message });
    }
  }
  return NextResponse.json({ since, results });
}
