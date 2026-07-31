import { createClient } from '@/lib/supabase/server';

async function countRows(supabase: ReturnType<typeof createClient>, table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [ideas, scripts, storyboards, videos, readyToTest, avgScoreRows, recentVideos, actionIdeasNoScript] = await Promise.all([
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
    supabase.from('ideas').select('id', { count: 'exact', head: true }).eq('status', 'IDEA')
  ]);

  const scoresArr = (avgScoreRows.data ?? []).map((r: any) => r.score_total).filter((n: number | null) => n != null);
  const avgScore = scoresArr.length > 0 ? Math.round(scoresArr.reduce((a: number, b: number) => a + b, 0) / scoresArr.length) : null;

  const ideasWithoutScript = actionIdeasNoScript.count ?? 0;

  const kpis = [
    { label: 'Ideas Generated', value: ideas },
    { label: 'Scripts Generated', value: scripts },
    { label: 'Storyboards Generated', value: storyboards },
    { label: 'Videos Analyzed', value: videos },
    { label: 'Average Creative Score', value: avgScore ?? '—' },
    { label: 'Ready to Test', value: readyToTest }
  ];

  const actionQueue: string[] = [];
  if (ideasWithoutScript > 0) actionQueue.push(`มี ${ideasWithoutScript} Idea ที่ยังไม่ได้ Generate Script`);
  if (videos === 0 && storyboards > 0) actionQueue.push(`มี ${storyboards} Storyboard พร้อมถ่าย/ตัดต่อ แต่ยังไม่มีวิดีโอส่งกลับมา analyze`);
  if (ideas === 0) actionQueue.push('ยังไม่มี Idea ในระบบ — เริ่มที่ Creative Generator');
  if (actionQueue.length === 0) actionQueue.push('ไม่มีงานค้าง — สร้าง Idea ใหม่ได้ที่ Creative Generator');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">ตัวเลขดึงจาก Supabase จริง — ไม่มี GMV/Ad Spend/ROAS ใน V1 ตาม MASTER_PROMPT_V2</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="text-3xl font-bold">{k.value}</div>
            <div className="text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Recent Creative</h2>
          {(recentVideos.data?.length ?? 0) === 0 ? (
            <p className="text-gray-500">ยังไม่มีวิดีโอที่ analyze — จะแสดงที่นี่หลัง Phase 3 (Video Analyzer) ใช้งานได้</p>
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
                <span className="text-accentBlue">•</span> {a}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
