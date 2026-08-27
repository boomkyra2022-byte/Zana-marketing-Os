import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface ExecutionRow {
  id: string;
  triggered_at: string;
  metric_value: number | null;
  dry_run: boolean;
  action_taken: string;
  budget_before: number | null;
  budget_after: number | null;
  status_before: string | null;
  status_after: string | null;
  success: boolean | null;
  error_message: string | null;
  reasoning: string;
  ad_sets: { name: string } | null;
}

function fmtBaht(n: number | null) {
  if (n === null || n === undefined) return '—';
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

export default async function RuleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: rule } = await supabase
    .from('ad_automation_rules')
    .select('*, ad_accounts(name), ad_campaigns(name), ad_sets(name)')
    .eq('id', params.id)
    .maybeSingle();

  if (!rule) notFound();

  const { data: executions } = await supabase
    .from('ad_rule_executions')
    .select(
      'id, triggered_at, metric_value, dry_run, action_taken, budget_before, budget_after, status_before, status_after, success, error_message, reasoning, ad_sets(name)'
    )
    .eq('rule_id', params.id)
    .order('triggered_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <Link href="/ads/rules" className="ads-muted text-sm hover:text-white">
        ← กลับไปรายการ Rules
      </Link>
      <h1 className="text-2xl font-bold text-white mt-2 mb-1">{rule.name}</h1>
      <p className="ads-muted mb-6">
        {rule.metric} {rule.operator} {rule.threshold} ต่อเนื่อง {rule.time_window_minutes} นาที → {rule.action}
        {rule.action === 'scale_budget' && rule.budget_change_percent !== null && ` (${rule.budget_change_percent}%)`}
        {' · '}
        ขอบเขต: {rule.ad_sets?.name ?? rule.ad_campaigns?.name ?? rule.ad_accounts?.name ?? 'ทุกบัญชี'}
        {' · '}
        {rule.enabled ? 'เปิดใช้งานอยู่' : 'ปิดอยู่'}
      </p>

      <h2 className="text-lg font-semibold text-white mb-3">ประวัติการ trigger ({executions?.length ?? 0} ครั้งล่าสุด)</h2>

      {(executions?.length ?? 0) === 0 && (
        <div className="ads-card p-8 text-center ads-muted">ยังไม่เคย trigger — รอ ad set ที่เข้าเงื่อนไขนี้</div>
      )}

      {(executions?.length ?? 0) > 0 && (
        <div className="space-y-3">
          {(executions as unknown as ExecutionRow[]).map((e) => (
            <div key={e.id} className="ads-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-white font-medium">{e.ad_sets?.name ?? '—'}</div>
                  <div className="ads-muted text-sm mt-1">{e.reasoning}</div>
                  {e.budget_before !== null && (
                    <div className="text-sm mt-1 text-white">
                      Budget: {fmtBaht(e.budget_before)} → {fmtBaht(e.budget_after)}
                    </div>
                  )}
                  {e.status_before && e.status_before !== e.status_after && (
                    <div className="text-sm mt-1 text-white">
                      สถานะ: {e.status_before} → {e.status_after}
                    </div>
                  )}
                  {e.error_message && <div className="text-sm mt-1 text-red-400">Error: {e.error_message}</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className="ads-muted text-xs">{new Date(e.triggered_at).toLocaleString('th-TH')}</div>
                  <div className="mt-1">
                    {e.dry_run ? (
                      <span className="ads-badge-gold">คำแนะนำ (dry-run)</span>
                    ) : e.success ? (
                      <span className="text-emerald-400 text-xs font-semibold">ยิงจริงสำเร็จ</span>
                    ) : (
                      <span className="text-red-400 text-xs font-semibold">ยิงจริงล้มเหลว</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
