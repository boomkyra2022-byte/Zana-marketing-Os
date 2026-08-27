import { createClient } from '@/lib/supabase/server';

interface SnapshotRow {
  ad_set_id: string;
  ad_account_id: string;
  campaign_id: string;
  spend: number | null;
  roas: number | null;
  cpa: number | null;
  frequency: number | null;
  ctr: number | null;
  captured_at: string;
  ad_sets: { name: string; status: string | null } | null;
  ad_accounts: { name: string } | null;
  ad_campaigns: { name: string } | null;
}

function fmtBaht(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number | null, digits = 2) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('th-TH', { maximumFractionDigits: digits });
}

function roasColor(roas: number | null) {
  if (roas === null || roas === undefined) return 'ads-muted';
  if (roas < 1) return 'text-red-400';
  if (roas < 1.5) return 'text-amber-400';
  return 'text-emerald-400';
}

export default async function AdsOverviewPage() {
  const supabase = createClient();

  // Latest cron cycle lands within ~15 min of each other; a 45-min window
  // comfortably covers one cycle even with clock drift, while old/paused
  // ad sets with no recent spend naturally fall out of the list.
  const since = new Date(Date.now() - 45 * 60 * 1000).toISOString();

  const { data: rawSnapshots, error } = await supabase
    .from('ad_set_insight_snapshots')
    .select(
      'ad_set_id, ad_account_id, campaign_id, spend, roas, cpa, frequency, ctr, captured_at, ad_sets(name, status), ad_accounts(name), ad_campaigns(name)'
    )
    .gte('captured_at', since)
    .order('captured_at', { ascending: false });

  // Keep only the latest snapshot per ad set (rows are already newest-first).
  const latestByAdSet = new Map<string, SnapshotRow>();
  for (const row of (rawSnapshots as unknown as SnapshotRow[]) ?? []) {
    if (!latestByAdSet.has(row.ad_set_id)) latestByAdSet.set(row.ad_set_id, row);
  }
  const rows = [...latestByAdSet.values()].sort((a, b) => (a.roas ?? -1) - (b.roas ?? -1));

  const totalSpend = rows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  const roasValues = rows.map((r) => r.roas).filter((v): v is number => v !== null);
  const avgRoas = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null;

  const { data: syncRuns } = await supabase
    .from('ad_sync_runs')
    .select('status, accounts_synced, ad_sets_synced, started_at')
    .order('started_at', { ascending: false })
    .limit(1);
  const lastSync = syncRuns?.[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ads Automation</h1>
          <p className="ads-muted">ภาพรวม ad set ทั้งหมด เรียงตาม ROAS ต่ำสุดขึ้นก่อน</p>
        </div>
        <a href="/ads/rules" className="ads-btn-primary">
          จัดการ Rules
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">Spend วันนี้ (จาก ad set ที่มีข้อมูลล่าสุด)</div>
          <div className="text-2xl font-bold text-white mt-1">{fmtBaht(totalSpend)}</div>
        </div>
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">ROAS เฉลี่ย</div>
          <div className={`text-2xl font-bold mt-1 ${roasColor(avgRoas)}`}>{avgRoas !== null ? fmtNum(avgRoas) : '—'}</div>
        </div>
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">Sync ล่าสุด</div>
          <div className="text-lg font-semibold text-white mt-1">
            {lastSync ? `${lastSync.accounts_synced} บัญชี` : 'ยังไม่เคย sync'}
          </div>
          {lastSync && (
            <div className="ads-muted text-xs mt-0.5">
              {new Date(lastSync.started_at).toLocaleString('th-TH')} · {lastSync.status}
            </div>
          )}
        </div>
      </div>

      {error && <div className="ads-card p-4 mb-4 text-red-400 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      {!error && rows.length === 0 && (
        <div className="ads-card p-8 text-center ads-muted">
          ยังไม่มี snapshot ในช่วง 45 นาทีล่าสุด — รอ cron รอบถัดไป หรือเช็คว่า ads-sync ทำงานอยู่
        </div>
      )}

      {rows.length > 0 && (
        <div className="ads-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">บัญชี</th>
                <th className="px-4 py-3">แคมเปญ</th>
                <th className="px-4 py-3">Ad Set</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">ROAS</th>
                <th className="px-4 py-3 text-right">CPA</th>
                <th className="px-4 py-3 text-right">Frequency</th>
                <th className="px-4 py-3 text-right">อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ad_set_id}>
                  <td className="px-4 py-3 text-white">{r.ad_accounts?.name ?? '—'}</td>
                  <td className="px-4 py-3 ads-muted">{r.ad_campaigns?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-white">{r.ad_sets?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={r.ad_sets?.status === 'ACTIVE' ? 'text-emerald-400' : 'ads-muted'}>
                      {r.ad_sets?.status ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white">{fmtBaht(r.spend)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${roasColor(r.roas)}`}>{fmtNum(r.roas)}</td>
                  <td className="px-4 py-3 text-right ads-muted">{fmtBaht(r.cpa)}</td>
                  <td className="px-4 py-3 text-right ads-muted">{fmtNum(r.frequency)}</td>
                  <td className="px-4 py-3 text-right ads-muted text-xs">
                    {new Date(r.captured_at).toLocaleTimeString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
