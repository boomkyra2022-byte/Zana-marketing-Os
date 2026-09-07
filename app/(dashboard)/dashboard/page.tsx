import { createClient } from '@/lib/supabase/server';

// Dashboard v2 — reorganized into a 4-quadrant "AI Marketing Department"
// layout after the user showed a reference (Tina Taylor's "Content
// Dashboard — Demo" mockup: CORE row + platform connector row + Intelligence
// / Strategy / Distribution / Analytics quadrants) and asked to redesign
// ZANA's REAL dashboard to match that structure — explicitly choosing "ใช้
// ข้อมูลจริงทุกวัน" over a one-off marketing mockup.
//
// Every number below still comes straight from Supabase, same as v1 — the
// only thing that changed is how it's grouped and labeled. Nothing here
// claims a connector/automation exists that doesn't: the platform-connector
// row and the "Always-On" pill are built to show exactly what's real (Meta
// Ads via Ads Automation's cron sync, OpenAI powering every AI call) and to
// visibly grey out what isn't (Instagram organic/TikTok/YouTube/GA4 have no
// integration in this app yet — matches the gap analysis given to the user
// in chat, not hidden here).

async function countRows(supabase: ReturnType<typeof createClient>, table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

function fmtBaht(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [
    ideas,
    scripts,
    storyboards,
    videos,
    readyToTest,
    avgScoreRows,
    recentVideos,
    actionIdeasNoScript,
    knowledgeCount,
    editorJobsCount,
    voiceoverJobsCount,
    bannerJobsCount,
    adsSnapshotsRes,
    adsSyncRes
  ] = await Promise.all([
    countRows(supabase, 'ideas'),
    countRows(supabase, 'scripts'),
    countRows(supabase, 'storyboards'),
    countRows(supabase, 'video_analysis'),
    countRows(supabase, 'video_analysis', (q) => q.in('verdict', ['READY TO TEST', 'PRIORITY TEST'])),
    supabase.from('video_analysis').select('score_total').not('score_total', 'is', null),
    supabase
      .from('video_analysis')
      .select('id, score_total, verdict, created_at, videos(product_id, products(product_name)), video_id')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('ideas').select('id', { count: 'exact', head: true }).eq('status', 'IDEA'),
    countRows(supabase, 'knowledge_items'),
    countRows(supabase, 'editor_jobs'),
    countRows(supabase, 'voiceover_jobs'),
    countRows(supabase, 'banner_generator_jobs'),
    // Same 45-min "current cycle" window as app/(dashboard)/ads/page.tsx —
    // duplicated here (not imported) since this is a lightweight summary,
    // not the full ads table.
    supabase
      .from('ad_set_insight_snapshots')
      .select('ad_set_id, spend, roas, captured_at')
      .gte('captured_at', new Date(Date.now() - 45 * 60 * 1000).toISOString())
      .order('captured_at', { ascending: false }),
    supabase.from('ad_sync_runs').select('status, accounts_synced, started_at').order('started_at', { ascending: false }).limit(1)
  ]);

  const scoresArr = (avgScoreRows.data ?? []).map((r: any) => r.score_total).filter((n: number | null) => n != null);
  const avgScore = scoresArr.length > 0 ? Math.round(scoresArr.reduce((a: number, b: number) => a + b, 0) / scoresArr.length) : null;
  const ideasWithoutScript = actionIdeasNoScript.count ?? 0;

  const actionQueue: string[] = [];
  if (ideasWithoutScript > 0) actionQueue.push(`มี ${ideasWithoutScript} Idea ที่ยังไม่ได้ Generate Script`);
  if (videos === 0 && storyboards > 0) actionQueue.push(`มี ${storyboards} Storyboard พร้อมถ่าย/ตัดต่อ แต่ยังไม่มีวิดีโอส่งกลับมา analyze`);
  if (ideas === 0) actionQueue.push('ยังไม่มี Idea ในระบบ — เริ่มที่ Creative Generator');
  if (actionQueue.length === 0) actionQueue.push('ไม่มีงานค้าง — สร้าง Idea ใหม่ได้ที่ Creative Generator');

  // Ads summary — dedupe to latest snapshot per ad set, same as /ads.
  const latestByAdSet = new Map<string, { spend: number | null; roas: number | null }>();
  for (const row of (adsSnapshotsRes.data as any[]) ?? []) {
    if (!latestByAdSet.has(row.ad_set_id)) latestByAdSet.set(row.ad_set_id, row);
  }
  const adsRows = [...latestByAdSet.values()];
  const totalSpend = adsRows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  const roasValues = adsRows.map((r) => r.roas).filter((v): v is number => v !== null);
  const avgRoas = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null;
  const lastSync = adsSyncRes.data?.[0];
  const metaConnected = Boolean(lastSync); // has at least run a sync once — real signal, not assumed

  const CONNECTORS = [
    { label: 'Facebook & Instagram Ads (Meta)', connected: metaConnected },
    { label: 'OpenAI (Content/Image/Voice)', connected: true },
    { label: 'TikTok', connected: false },
    { label: 'YouTube / GA4', connected: false }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">ตัวเลขดึงจาก Supabase จริงทั้งหมด — จัดกลุ่มเป็น Intelligence / Strategy / Distribution / Analytics</p>
      </div>

      {/* CORE strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="card p-3 text-center">
          <div className="text-xs text-gray-500">CORE</div>
          <div className="font-semibold text-sm mt-0.5">Claude</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-gray-500">CORE</div>
          <div className="font-semibold text-sm mt-0.5">Context Memory</div>
          <div className="text-xs text-gray-400">{knowledgeCount} รายการใน Knowledge Base</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-gray-500">CORE</div>
          <div className="font-semibold text-sm mt-0.5">Always-On</div>
          <div className={`text-xs mt-0.5 ${lastSync ? 'text-emerald-600' : 'text-gray-400'}`}>
            {lastSync ? `Ads sync ล่าสุด ${new Date(lastSync.started_at).toLocaleTimeString('th-TH')}` : 'ยังไม่มี cron ทำงาน'}
          </div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xs text-gray-500">CORE</div>
          <div className="font-semibold text-sm mt-0.5">Connectors</div>
          <div className="text-xs text-gray-400">{CONNECTORS.filter((c) => c.connected).length}/{CONNECTORS.length} เชื่อมต่อจริง</div>
        </div>
      </div>

      {/* Platform connector row — honest state, not aspirational */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {CONNECTORS.map((c) => (
            <span
              key={c.label}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                c.connected ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              {c.connected ? '● ' : '○ '}
              {c.label}
              {!c.connected && ' — ยังไม่เชื่อมต่อ'}
            </span>
          ))}
        </div>
      </div>

      {/* 4 quadrants — colors match the sidebar's group accents (see
          app/globals.css .section-{slug} / .sidebar-group-{slug}) so the
          same category reads the same color everywhere in the app. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <a href="/knowledge" className="card section-card section-intelligence p-5 block hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-intelligence)' }}>01 · INTELLIGENCE</div>
          <h2 className="text-lg font-semibold mb-2">รู้เทรนด์ + Insight สินค้า</h2>
          <p className="text-3xl font-bold">{knowledgeCount}</p>
          <p className="text-gray-500 text-sm">รายการใน Knowledge Base (Winners / Learnings / Compliance)</p>
          <p className="text-xs text-gray-400 mt-2">ส่องคู่แข่ง: ใช้สกิล /spy สั่งเองตอนนี้ได้เลย — ยังไม่ใช่ระบบดึงอัตโนมัติรายสัปดาห์</p>
        </a>

        <a href="/creative-generator" className="card section-card section-strategy p-5 block hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-strategy)' }}>02 · STRATEGY</div>
          <h2 className="text-lg font-semibold mb-2">วางแผน Hook + คอนเทนต์</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-2xl font-bold">{ideas}</p><p className="text-xs text-gray-500">Ideas</p></div>
            <div><p className="text-2xl font-bold">{scripts}</p><p className="text-xs text-gray-500">Scripts</p></div>
            <div><p className="text-2xl font-bold">{storyboards}</p><p className="text-xs text-gray-500">Storyboards</p></div>
          </div>
        </a>

        <a href="/editor" className="card section-card section-distribution p-5 block hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-distribution)' }}>03 · DISTRIBUTION</div>
          <h2 className="text-lg font-semibold mb-2">ผลิตชิ้นงานพร้อมโพสต์</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-2xl font-bold">{editorJobsCount}</p><p className="text-xs text-gray-500">Editor</p></div>
            <div><p className="text-2xl font-bold">{voiceoverJobsCount}</p><p className="text-xs text-gray-500">พากย์เสียง</p></div>
            <div><p className="text-2xl font-bold">{bannerJobsCount}</p><p className="text-xs text-gray-500">Banner AI</p></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">⚠ ยังไม่มีระบบโพสต์อัตโนมัติขึ้น FB/IG/TikTok — ต้องโพสต์เองหรือใช้เครื่องมือ schedule ภายนอก</p>
        </a>

        <a href="/ads" className="card section-card section-analytics p-5 block hover:shadow-md transition-shadow">
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-analytics)' }}>04 · ANALYTICS</div>
          <h2 className="text-lg font-semibold mb-2">วัดผล + ย้อนกลับไปที่ 01</h2>
          <div className="grid grid-cols-2 gap-2 text-center mb-2">
            <div><p className="text-2xl font-bold">{avgScore ?? '—'}</p><p className="text-xs text-gray-500">Avg Creative Score</p></div>
            <div><p className="text-2xl font-bold">{readyToTest}</p><p className="text-xs text-gray-500">Ready to Test</p></div>
          </div>
          {metaConnected ? (
            <div className="grid grid-cols-2 gap-2 text-center border-t pt-2" style={{ borderColor: 'var(--border)' }}>
              <div><p className="text-lg font-semibold">{fmtBaht(totalSpend)}</p><p className="text-xs text-gray-500">Ad Spend (รอบล่าสุด)</p></div>
              <div><p className="text-lg font-semibold">{avgRoas !== null ? avgRoas.toFixed(2) : '—'}</p><p className="text-xs text-gray-500">ROAS เฉลี่ย</p></div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 border-t pt-2" style={{ borderColor: 'var(--border)' }}>ยังไม่มีข้อมูลโฆษณา — ต่อ Meta Ads ที่หน้า Ads Automation ก่อน</p>
          )}
        </a>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Recent Creative</h2>
          {(recentVideos.data?.length ?? 0) === 0 ? (
            <p className="text-gray-500">ยังไม่มีวิดีโอที่ analyze</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-left">
                <tr>
                  <th className="py-1">Product</th>
                  <th className="py-1">Score</th>
                  <th className="py-1">Verdict</th>
                  <th className="py-1">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentVideos.data!.map((v: any) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="py-2">{v.videos?.products?.product_name ?? '—'}</td>
                    <td className="py-2">{v.score_total ?? '—'}</td>
                    <td className="py-2">{v.verdict ?? '—'}</td>
                    <td className="py-2">{new Date(v.created_at).toLocaleDateString('th-TH')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Action Queue</h2>
          <ul className="space-y-2">
            {actionQueue.slice(0, 5).map((a, i) => (
              <li key={i} className="text-gray-700 text-sm flex gap-2">
                <span className="text-accentTerracotta">•</span> {a}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
