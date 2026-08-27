import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { toggleRuleEnabled, deleteRule } from './actions';

interface RuleRow {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  time_window_minutes: number;
  action: string;
  budget_change_percent: number | null;
  cooldown_hours: number;
  enabled: boolean;
  ad_accounts: { name: string } | null;
}

const ACTION_LABEL: Record<string, string> = {
  pause: 'หยุด (pause)',
  activate: 'เปิดใหม่ (activate)',
  scale_budget: 'ปรับ budget'
};

export default async function AdsRulesPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  let role = 'viewer';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    role = profile?.role ?? 'viewer';
  }
  const canManage = ['admin', 'owner', 'media_buyer'].includes(role);

  const { data: rules, error } = await supabase
    .from('ad_automation_rules')
    .select('id, name, metric, operator, threshold, time_window_minutes, action, budget_change_percent, cooldown_hours, enabled, ad_accounts(name)')
    .order('priority', { ascending: true });

  const dryRunLabel = 'ค่า default ของระบบคือ dry-run (log อย่างเดียว ไม่ยิงจริง) จนกว่าจะมีคนตั้งค่า ADS_AUTOMATION_DRY_RUN=false เอง';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Automation Rules</h1>
          <p className="ads-muted">{dryRunLabel}</p>
        </div>
        {canManage && (
          <Link href="/ads/rules/new" className="ads-btn-primary">
            + สร้าง Rule
          </Link>
        )}
      </div>
      <div className="mb-6">
        <Link href="/ads" className="ads-muted text-sm hover:text-white">
          ← กลับไปภาพรวม
        </Link>
      </div>

      {searchParams.error && <div className="ads-card p-4 mb-4 text-red-400 text-sm">{searchParams.error}</div>}
      {error && <div className="ads-card p-4 mb-4 text-red-400 text-sm">โหลดข้อมูลไม่สำเร็จ: {error.message}</div>}

      {!error && (rules?.length ?? 0) === 0 && (
        <div className="ads-card p-8 text-center ads-muted">ยังไม่มี rule — กด &quot;+ สร้าง Rule&quot; เพื่อเริ่มต้น</div>
      )}

      {(rules?.length ?? 0) > 0 && (
        <div className="ads-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">ชื่อ Rule</th>
                <th className="px-4 py-3">ขอบเขต</th>
                <th className="px-4 py-3">เงื่อนไข</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Cooldown</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(rules as unknown as RuleRow[]).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-white font-medium">
                    <Link href={`/ads/rules/${r.id}`} className="hover:text-gold">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 ads-muted">{r.ad_accounts?.name ?? 'ทุกบัญชี'}</td>
                  <td className="px-4 py-3 ads-muted">
                    {r.metric} {r.operator} {r.threshold} (ต่อเนื่อง {r.time_window_minutes} นาที)
                  </td>
                  <td className="px-4 py-3 text-white">
                    {ACTION_LABEL[r.action] ?? r.action}
                    {r.action === 'scale_budget' && r.budget_change_percent !== null && (
                      <span className="ads-muted"> ({r.budget_change_percent > 0 ? '+' : ''}{r.budget_change_percent}%)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 ads-muted">{r.cooldown_hours} ชม.</td>
                  <td className="px-4 py-3">
                    {r.enabled ? (
                      <span className="ads-badge-gold">เปิดใช้งาน</span>
                    ) : (
                      <span className="ads-muted text-xs">ปิดอยู่</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <form action={toggleRuleEnabled.bind(null, r.id, r.enabled)} className="inline">
                          <button type="submit" className="ads-btn-secondary text-xs py-1 px-2 mr-2">
                            {r.enabled ? 'ปิด' : 'เปิด'}
                          </button>
                        </form>
                        <form action={deleteRule.bind(null, r.id)} className="inline">
                          <button type="submit" className="ads-btn-danger text-xs py-1 px-2">
                            ลบ
                          </button>
                        </form>
                      </>
                    )}
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
