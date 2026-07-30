import { createClient } from '@/lib/supabase/server';

async function countRows(
  supabase: ReturnType<typeof createClient>,
  table: string
) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export default async function DashboardPage() {
  const supabase = createClient();

  const [products, personas, knowledge, ideas, scripts, videos, winners] = await Promise.all([
    countRows(supabase, 'products'),
    countRows(supabase, 'personas'),
    countRows(supabase, 'knowledge_items'),
    countRows(supabase, 'ideas'),
    countRows(supabase, 'scripts'),
    countRows(supabase, 'videos'),
    countRows(supabase, 'winner_dna')
  ]);

  const kpis = [
    { label: 'Products', value: products },
    { label: 'Personas', value: personas },
    { label: 'Knowledge Items', value: knowledge },
    { label: 'Ideas This Week', value: ideas },
    { label: 'Scripts', value: scripts },
    { label: 'Videos', value: videos },
    { label: 'Winners', value: winners }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">ศูนย์บัญชาการ</h1>
        <p className="text-gray-400 text-sm">
          ตัวเลขด้านล่างดึงจาก Supabase จริง — Phase 1 มีแค่ Products/Personas/Knowledge, ตัวเลข Creative Factory
          จะเริ่มขยับใน Phase 2-4
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="text-3xl font-bold">{k.value}</div>
            <div className="text-sm text-gray-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-semibold mb-4">Creative Factory Funnel</h2>
        <div className="flex items-center gap-3 text-sm">
          {[
            { label: 'Ideas', value: ideas, target: 100 },
            { label: 'Scripts', value: scripts, target: 40 },
            { label: 'Videos', value: videos, target: 20 },
            { label: 'Winners', value: winners, target: 3 }
          ].map((stage, i, arr) => (
            <div key={stage.label} className="flex items-center gap-3">
              <div className="card px-4 py-3 text-center min-w-[100px]">
                <div className="text-xl font-bold">{stage.value}</div>
                <div className="text-xs text-gray-500">
                  {stage.label} / target {stage.target}
                </div>
              </div>
              {i < arr.length - 1 && <span className="text-gray-600">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-8 text-center text-gray-500 text-sm">
        Fatigue alerts, Action Queue, Today&apos;s Top Creative และ Ad Spend/ROAS/Net ROI
        จะแสดงเมื่อ Phase 3-4 (Video Analyzer + Performance Import) ถูก implement
      </div>
    </div>
  );
}
