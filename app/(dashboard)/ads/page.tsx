import { createClient } from '@/lib/supabase/server';
import { addAccount, setAccountSync } from './accounts/actions';
import { CONNECTION_LABEL, connectionState, errorAdvice, metaStatusInfo, type ConnectionState, type Tone } from '@/lib/ads/status';

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

interface AccountRow {
  id: string;
  meta_account_id: string;
  name: string;
  meta_name: string | null;
  status: string;
  source: string;
  business_name: string | null;
  meta_account_status: number | null;
  meta_token_secret_name: string | null;
  last_sync_at: string | null;
  last_sync_ok: boolean | null;
  last_error_code: number | null;
  last_error_text: string | null;
}

function fmtBaht(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

function fmtNum(n: number | null, digits = 2) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('th-TH', { maximumFractionDigits: digits });
}

// Server runs in UTC; always show Thailand time.
function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
}

function roasColor(roas: number | null) {
  if (roas === null || roas === undefined) return 'ads-muted';
  if (roas < 1) return 'text-red-400';
  if (roas < 1.5) return 'text-amber-400';
  return 'text-emerald-400';
}

const TONE_CLASS: Record<Tone, string> = {
  ok: 'text-emerald-400 border-emerald-500/40',
  warn: 'text-amber-400 border-amber-500/40',
  bad: 'text-red-400 border-red-500/40',
  muted: 'ads-muted border-zinc-700'
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASS[tone]}`}>{label}</span>;
}

// Accounts that need a person to act come first.
const ATTENTION: ConnectionState[] = ['needs_permission', 'token_invalid', 'error'];

export default async function AdsOverviewPage({ searchParams }: { searchParams: { only?: string; error?: string } }) {
  const supabase = createClient();
  const onlyActive = searchParams.only === 'active';

  const {
    data: { user }
  } = await supabase.auth.getUser();
  let role = 'viewer';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = profile?.role ?? 'viewer';
  }
  const canManage = ['admin', 'owner', 'media_buyer'].includes(role);

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
  const allRows = [...latestByAdSet.values()].sort((a, b) => (a.roas ?? -1) - (b.roas ?? -1));
  const activeRowCount = allRows.filter((r) => r.ad_sets?.status === 'ACTIVE').length;
  const rows = onlyActive ? allRows.filter((r) => r.ad_sets?.status === 'ACTIVE') : allRows;

  const totalSpend = allRows.reduce((sum, r) => sum + (r.spend ?? 0), 0);
  const roasValues = allRows.map((r) => r.roas).filter((v): v is number => v !== null);
  const avgRoas = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null;

  const spendByAccount = new Map<string, number>();
  for (const r of allRows) spendByAccount.set(r.ad_account_id, (spendByAccount.get(r.ad_account_id) ?? 0) + (r.spend ?? 0));

  const { data: syncRuns } = await supabase
    .from('ad_sync_runs')
    .select('status, accounts_synced, ad_sets_synced, started_at')
    .order('started_at', { ascending: false })
    .limit(1);
  const lastSync = syncRuns?.[0];

  const { data: accountData } = await supabase
    .from('ad_accounts')
    .select(
      'id, meta_account_id, name, meta_name, status, source, business_name, meta_account_status, meta_token_secret_name, last_sync_at, last_sync_ok, last_error_code, last_error_text'
    )
    .order('name');
  const { data: adSetData } = await supabase.from('ad_sets').select('ad_account_id, status').limit(5000);

  const adSetCount = new Map<string, { active: number; total: number }>();
  for (const s of adSetData ?? []) {
    const entry = adSetCount.get(s.ad_account_id) ?? { active: 0, total: 0 };
    entry.total += 1;
    if (s.status === 'ACTIVE') entry.active += 1;
    adSetCount.set(s.ad_account_id, entry);
  }

  const now = Date.now();
  const accounts = ((accountData as AccountRow[] | null) ?? []).map((a) => ({ ...a, conn: connectionState(a, now) }));
  const enabled = accounts
    .filter((a) => a.status === 'active')
    .sort((a, b) => Number(ATTENTION.includes(b.conn)) - Number(ATTENTION.includes(a.conn)) || a.name.localeCompare(b.name));
  const notEnabled = accounts.filter((a) => a.status !== 'active');
  const connectedCount = enabled.filter((a) => a.conn === 'connected' || a.conn === 'stale').length;
  const attentionCount = enabled.filter((a) => ATTENTION.includes(a.conn)).length;
  const discoveredCount = notEnabled.filter((a) => a.source === 'discovered').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ads Automation</h1>
          <p className="ads-muted">ภาพรวมบัญชีโฆษณาและ ad set ทั้งหมด (อ่านข้อมูลอย่างเดียว ไม่มีการสั่งแก้โฆษณา)</p>
        </div>
        <a href="/ads/rules" className="ads-btn-primary">
          จัดการ Rules
        </a>
      </div>

      {searchParams.error && <div className="ads-card p-4 mb-4 text-red-400 text-sm">{searchParams.error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">Spend วันนี้ (จาก ad set ที่มีข้อมูลล่าสุด)</div>
          <div className="text-2xl font-bold text-white mt-1">{fmtBaht(totalSpend)}</div>
        </div>
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">ROAS เฉลี่ย</div>
          <div className={`text-2xl font-bold mt-1 ${roasColor(avgRoas)}`}>{avgRoas !== null ? fmtNum(avgRoas) : '—'}</div>
        </div>
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">บัญชีที่เชื่อมต่อได้</div>
          <div className="text-2xl font-bold text-white mt-1">
            {connectedCount}
            <span className="ads-muted text-base font-normal"> / {enabled.length} ที่เปิดใช้</span>
          </div>
          {attentionCount > 0 && <div className="text-red-400 text-xs mt-0.5">{attentionCount} บัญชีต้องแก้สิทธิ์/การเชื่อมต่อ</div>}
        </div>
        <div className="ads-card p-4">
          <div className="ads-muted text-sm">Sync ล่าสุด</div>
          <div className="text-lg font-semibold text-white mt-1">
            {lastSync ? `${lastSync.accounts_synced} บัญชีสำเร็จ` : 'ยังไม่เคย sync'}
          </div>
          {lastSync && (
            <div className="ads-muted text-xs mt-0.5">
              {fmtDateTime(lastSync.started_at)} · {lastSync.status}
            </div>
          )}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-1">บัญชีโฆษณา</h2>
      <p className="ads-muted text-sm mb-3">
        เชื่อมต่อแล้ว {connectedCount} · ต้องแก้ {attentionCount} · ยังไม่เปิดใช้ {notEnabled.length}
        {discoveredCount > 0 ? ` (ระบบค้นพบเอง ${discoveredCount})` : ''}
      </p>

      {enabled.length === 0 ? (
        <div className="ads-card p-6 text-center ads-muted mb-4">ยังไม่มีบัญชีที่เปิดใช้ — เพิ่มบัญชีด้านล่าง หรือเปิดจากรายการที่ระบบค้นพบ</div>
      ) : (
        <div className="ads-card overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">บัญชี</th>
                <th className="px-4 py-3">สถานะใน Meta</th>
                <th className="px-4 py-3">การเชื่อมต่อ</th>
                <th className="px-4 py-3 text-right">Ad set Active</th>
                <th className="px-4 py-3 text-right">Spend วันนี้</th>
                <th className="px-4 py-3 text-right">Sync ล่าสุด</th>
                {canManage && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {enabled.map((a) => {
                const meta = metaStatusInfo(a.meta_account_status);
                const conn = CONNECTION_LABEL[a.conn];
                const counts = adSetCount.get(a.id);
                const advice = ATTENTION.includes(a.conn) ? errorAdvice(a.last_error_code, !!a.meta_token_secret_name) : null;
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{a.name}</div>
                      {a.meta_name && a.meta_name !== a.name && <div className="ads-muted text-xs">ใน Meta: {a.meta_name}</div>}
                      <div className="ads-muted text-xs">
                        {a.meta_account_id}
                        {a.business_name ? ` · ${a.business_name}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge label={meta.label} tone={meta.tone} />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <Badge label={conn.label} tone={conn.tone} />
                      {advice && (
                        <div className="ads-muted text-xs mt-1" title={a.last_error_text ?? undefined}>
                          {advice}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {counts ? (
                        <>
                          <span className={counts.active > 0 ? 'text-emerald-400 font-semibold' : 'ads-muted'}>{counts.active}</span>
                          <span className="ads-muted"> / {counts.total}</span>
                        </>
                      ) : (
                        <span className="ads-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white">{spendByAccount.has(a.id) ? fmtBaht(spendByAccount.get(a.id)!) : '—'}</td>
                    <td className="px-4 py-3 text-right ads-muted text-xs">{fmtDateTime(a.last_sync_at)}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <form action={setAccountSync.bind(null, a.id, false)} className="inline">
                          <button type="submit" className="ads-btn-secondary text-xs py-1 px-2">
                            ปิดการดึงข้อมูล
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {notEnabled.length > 0 && (
        <details className="ads-card mb-4">
          <summary className="px-4 py-3 cursor-pointer text-white">
            ยังไม่เปิดใช้ ({notEnabled.length}){discoveredCount > 0 ? ` — ระบบค้นพบเอง ${discoveredCount} บัญชีที่ token เข้าถึงได้` : ''}
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">บัญชี</th>
                  <th className="px-4 py-3">เจ้าของ (portfolio)</th>
                  <th className="px-4 py-3">สถานะใน Meta</th>
                  <th className="px-4 py-3">ที่มา</th>
                  {canManage && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {notEnabled.map((a) => {
                  const meta = metaStatusInfo(a.meta_account_status);
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <div className="text-white">{a.name}</div>
                        <div className="ads-muted text-xs">{a.meta_account_id}</div>
                      </td>
                      <td className="px-4 py-3 ads-muted">{a.business_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge label={meta.label} tone={meta.tone} />
                      </td>
                      <td className="px-4 py-3 ads-muted text-xs">{a.source === 'discovered' ? 'ระบบค้นพบ' : 'เพิ่มเอง'}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <form action={setAccountSync.bind(null, a.id, true)} className="inline">
                            <button type="submit" className="ads-btn-primary text-xs py-1 px-2">
                              เปิดดึงข้อมูล
                            </button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {canManage && (
        <details className="ads-card mb-8">
          <summary className="px-4 py-3 cursor-pointer text-white">+ เพิ่มบัญชีด้วยเลข ID</summary>
          <form action={addAccount} className="p-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
            <div>
              <label className="ads-field-label">เลขบัญชีโฆษณา (act_… หรือเฉพาะตัวเลข)</label>
              <input name="act_id" required placeholder="act_1234567890" />
            </div>
            <div>
              <label className="ads-field-label">ชื่อเรียก (ไม่ใส่ก็ได้)</label>
              <input name="label" placeholder="เช่น Shopky07" />
            </div>
            <button type="submit" className="ads-btn-primary">
              เพิ่ม
            </button>
            <p className="ads-muted text-xs sm:col-span-3">
              การเพิ่มบัญชีเป็นแค่การบอกระบบให้ดึงข้อมูล (อ่านอย่างเดียว) บัญชีต้องถูกแชร์/มอบสิทธิ์ให้ token ที่ใช้อยู่ก่อน ไม่งั้นจะขึ้น &ldquo;ต้องแก้สิทธิ์&rdquo;
            </p>
          </form>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-white">Ad set ({rows.length})</h2>
        <div className="flex gap-2 text-sm">
          <a href="/ads" className={onlyActive ? 'ads-btn-secondary text-xs py-1 px-3' : 'ads-btn-primary text-xs py-1 px-3'}>
            ทั้งหมด ({allRows.length})
          </a>
          <a href="/ads?only=active" className={onlyActive ? 'ads-btn-primary text-xs py-1 px-3' : 'ads-btn-secondary text-xs py-1 px-3'}>
            เฉพาะ Active ({activeRowCount})
          </a>
        </div>
      </div>

      {error && <div className="ads-card p-4 mb-4 text-red-400 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      {!error && rows.length === 0 && (
        <div className="ads-card p-8 text-center ads-muted">
          {onlyActive
            ? 'ไม่มี ad set ที่ Active และมีข้อมูลในช่วง 45 นาทีล่าสุด'
            : 'ยังไม่มี snapshot ในช่วง 45 นาทีล่าสุด — รอ cron รอบถัดไป หรือเช็คว่า ads-sync ทำงานอยู่'}
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
                    <span className={r.ad_sets?.status === 'ACTIVE' ? 'text-emerald-400' : 'ads-muted'}>{r.ad_sets?.status ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white">{fmtBaht(r.spend)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${roasColor(r.roas)}`}>{fmtNum(r.roas)}</td>
                  <td className="px-4 py-3 text-right ads-muted">{fmtBaht(r.cpa)}</td>
                  <td className="px-4 py-3 text-right ads-muted">{fmtNum(r.frequency)}</td>
                  <td className="px-4 py-3 text-right ads-muted text-xs">{fmtTime(r.captured_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
