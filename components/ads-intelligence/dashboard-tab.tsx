'use client';

import type { AdsReport, Metrics } from '@/lib/meta/ads-report';
import { baht, byDay, byObjective, emptyMetrics, int, objectiveLabel, pct, rates, shortDate, sumRows } from '@/lib/meta/ads-metrics';
import { BarLineChart, Kpi, Section } from './ui';

const AGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS: { key: string; label: string }[] = [
  { key: 'male', label: 'ชาย' },
  { key: 'female', label: 'หญิง' },
  { key: 'unknown', label: 'ไม่ระบุ' }
];

function segmentGrid(report: AdsReport) {
  const grid = new Map<string, { spend: number; inbox: number; purchases: number; purchaseValue: number }>();
  for (const s of report.segments) {
    const k = `${s.age}|${s.gender}`;
    const g = grid.get(k) ?? { spend: 0, inbox: 0, purchases: 0, purchaseValue: 0 };
    g.spend += s.spend;
    g.inbox += s.inbox;
    g.purchases += s.purchases;
    g.purchaseValue += s.purchaseValue;
    grid.set(k, g);
  }
  return grid;
}

export function dashboardAiData(report: AdsReport) {
  const t = sumRows(report.rows);
  const days = byDay(report.rows, report.since, report.until);
  const r = rates(t);
  return {
    totals: { ...t, reach: report.reach, ...r },
    daily: days.map((d) => ({ date: d.date, spend: d.spend, linkClicks: d.linkClicks, inbox: d.inbox, purchases: d.purchases, purchaseValue: d.purchaseValue })),
    objectives: byObjective(report.rows).map((o) => ({ objective: objectiveLabel(o.objective), spend: o.spend, ...pickRates(o) })),
    segments: report.segments.map((s) => ({ age: s.age, gender: s.gender, spend: s.spend, inbox: s.inbox, purchases: s.purchases }))
  };
}

function pickRates(m: Metrics) {
  const r = rates(m);
  return { cpm: r.cpm, linkCtr: r.linkCtr, costPerInbox: r.costPerInbox, costPerPurchase: r.costPerPurchase, roas: r.roas };
}

export function DashboardTab({ report }: { report: AdsReport }) {
  const t = sumRows(report.rows);
  const r = rates(t);
  const days = byDay(report.rows, report.since, report.until);
  const dayCount = days.length || 1;
  const hasPurchases = t.purchases > 0;

  // Snapshot: last day in range vs the day before vs the whole range.
  const last = days[days.length - 1] ?? { ...emptyMetrics(), date: report.until };
  const prev = days[days.length - 2] ?? { ...emptyMetrics(), date: '' };
  const snapRows: { label: string; get: (m: Metrics) => string }[] = [
    { label: 'Spend', get: (m) => baht(m.spend) },
    { label: 'Revenue', get: (m) => baht(m.purchaseValue) },
    { label: 'ROAS', get: (m) => (m.spend > 0 ? `${(m.purchaseValue / m.spend).toFixed(2)}x` : '—') },
    { label: 'Link Clicks', get: (m) => int(m.linkClicks) },
    { label: 'Inbox', get: (m) => int(m.inbox) },
    { label: 'Lead', get: (m) => int(m.leads) },
    { label: 'Purchase', get: (m) => int(m.purchases) }
  ];

  const funnel = [
    { label: 'Impression', value: t.impressions, note: 'ฐานการมองเห็นทั้งหมด' },
    { label: 'Link Clicks', value: t.linkClicks, note: `CTR ลิงก์ ${pct(r.linkCtr, 2)}` },
    { label: 'Inbox', value: t.inbox, note: `แชท / คลิก ${pct(r.inboxPerClick)}` },
    { label: 'Lead', value: t.leads, note: `Lead / คลิก ${pct(t.linkClicks > 0 ? t.leads / t.linkClicks : null)}` },
    { label: 'Purchase', value: t.purchases, note: `ซื้อ / แชท ${pct(r.purchasePerInbox)}` }
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  const grid = segmentGrid(report);
  const maxSegSpend = Math.max(...[...grid.values()].map((g) => g.spend), 1);
  const objectives = byObjective(report.rows);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={hasPurchases ? 'ROAS, รายได้ และค่าโฆษณา' : 'ค่าโฆษณา และ ROAS'} hint="แท่ง = ค่าโฆษณารายวัน · เส้น = ROAS">
          <BarLineChart
            data={days}
            bar={(d) => d.spend}
            line={(d) => (d.spend > 0 ? d.purchaseValue / d.spend : null)}
            barLabel="Spend"
            lineLabel="ROAS"
            fmtBar={(v) => baht(v, 0)}
            fmtLine={(v) => (v === null ? '—' : `${v.toFixed(2)}x`)}
          />
        </Section>
        <Section title="แชทใหม่ และต้นทุนต่อแชท" hint="แท่ง = ค่าโฆษณารายวัน · เส้น = ต้นทุนต่อแชท">
          <BarLineChart
            data={days}
            bar={(d) => d.spend}
            line={(d) => (d.inbox > 0 ? d.spend / d.inbox : null)}
            barLabel="Spend"
            lineLabel="Cost / Inbox"
            fmtBar={(v) => baht(v, 0)}
            fmtLine={(v) => baht(v, 0)}
          />
        </Section>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <Kpi label="Total Spend" value={baht(t.spend, 0)} />
        <Kpi label="Avg Spend / Day" value={baht(t.spend / dayCount, 0)} />
        <Kpi label="CPM" value={baht(r.cpm, 0)} />
        <Kpi label="Impressions" value={int(t.impressions)} sub={`Reach ${int(report.reach)}`} />
        <Kpi label="Link Clicks" value={int(t.linkClicks)} sub={`CPC ${baht(r.cpc)}`} />
        <Kpi label="CTR (All)" value={pct(r.ctrAll, 2)} sub={`ลิงก์ ${pct(r.linkCtr, 2)}`} />
        <Kpi label="Total Inbox" value={int(t.inbox)} sub={`${(t.inbox / dayCount).toFixed(1)} / วัน`} />
        <Kpi label="Cost / Inbox" value={baht(r.costPerInbox, 0)} />
        <Kpi label="New Inbox" value={int(t.newInbox)} sub={`ต้นทุน ${baht(r.costPerNewInbox, 0)}`} />
        <Kpi label="Leads" value={int(t.leads)} sub={`ต้นทุน ${baht(r.costPerLead, 0)}`} />
        <Kpi label="Purchases" value={int(t.purchases)} sub={`ต้นทุน ${baht(r.costPerPurchase, 0)}`} />
        <Kpi label="Purchase Value" value={baht(t.purchaseValue, 0)} sub={`ROAS ${r.roas === null ? '—' : r.roas.toFixed(2) + 'x'}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Response Funnel" hint="จากการมองเห็นไปจนถึงการซื้อ ในช่วงที่เลือก">
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{f.label}</span>
                  <span className="tabular-nums">{int(f.value)}</span>
                </div>
                <div className="h-2 rounded bg-stone-100 mt-1 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${Math.max((f.value / funnelMax) * 100, f.value > 0 ? 1.5 : 0)}%`, background: 'var(--accent-analytics)' }} />
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{f.note}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Timeframe Snapshot" hint={`เทียบวันล่าสุดในช่วง (${shortDate(last.date)}) กับวันก่อนหน้า และทั้งช่วง`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[var(--text-muted)] text-xs">
                <tr>
                  <th className="text-left font-medium py-1">Metric</th>
                  <th className="text-right font-medium">{shortDate(last.date)}</th>
                  <th className="text-right font-medium">{prev.date ? shortDate(prev.date) : 'วันก่อน'}</th>
                  <th className="text-right font-medium">ทั้งช่วง</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {snapRows.map((s) => (
                  <tr key={s.label} className="border-t border-[var(--border)]">
                    <td className="py-1.5">{s.label}</td>
                    <td className="text-right">{s.get(last)}</td>
                    <td className="text-right">{s.get(prev)}</td>
                    <td className="text-right font-medium">{s.get(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="rounded-lg bg-stone-50 p-2">
              <div className="text-[var(--text-muted)]">แชท / คลิกลิงก์</div>
              <div className="font-semibold text-sm">{pct(r.inboxPerClick)}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-2">
              <div className="text-[var(--text-muted)]">สัดส่วนแชทใหม่</div>
              <div className="font-semibold text-sm">{pct(t.inbox > 0 ? t.newInbox / t.inbox : null)}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-2">
              <div className="text-[var(--text-muted)]">แชท / Reach</div>
              <div className="font-semibold text-sm">{pct(report.reach > 0 ? t.inbox / report.reach : null, 2)}</div>
            </div>
            <div className="rounded-lg bg-stone-50 p-2">
              <div className="text-[var(--text-muted)]">ซื้อ / แชท</div>
              <div className="font-semibold text-sm">{pct(r.purchasePerInbox)}</div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="ผลตามวัตถุประสงค์แคมเปญ">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-[var(--text-muted)] text-xs">
              <tr>
                <th className="text-left font-medium py-1">Objective</th>
                <th className="text-right font-medium">Spend</th>
                <th className="text-right font-medium">CPM</th>
                <th className="text-right font-medium">CTR ลิงก์</th>
                <th className="text-right font-medium">Cost / Inbox</th>
                <th className="text-right font-medium">Cost / Purchase</th>
                <th className="text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {objectives.map((o) => {
                const orr = rates(o);
                return (
                  <tr key={o.objective} className="border-t border-[var(--border)]">
                    <td className="py-1.5">{objectiveLabel(o.objective)}</td>
                    <td className="text-right">{baht(o.spend)}</td>
                    <td className="text-right">{baht(orr.cpm)}</td>
                    <td className="text-right">{pct(orr.linkCtr, 2)}</td>
                    <td className="text-right">{baht(orr.costPerInbox)}</td>
                    <td className="text-right">{baht(orr.costPerPurchase)}</td>
                    <td className="text-right">{orr.roas === null ? '—' : `${orr.roas.toFixed(2)}x`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="ค่าโฆษณาตามอายุ × เพศ" hint="สีเข้ม = ใช้เงินมาก">
          <SegTable
            grid={grid}
            cell={(g) => (g && g.spend > 0 ? baht(g.spend, 0) : '—')}
            shade={(g) => (g ? g.spend / maxSegSpend : 0)}
          />
        </Section>
        <Section title={hasPurchases ? 'ต้นทุนต่อการซื้อ ตามอายุ × เพศ' : 'ต้นทุนต่อแชท ตามอายุ × เพศ'} hint='"—" = ใช้เงินแล้วแต่ยังไม่มีผลลัพธ์'>
          <SegTable
            grid={grid}
            cell={(g) => {
              if (!g) return '—';
              const n = hasPurchases ? g.purchases : g.inbox;
              return n > 0 ? baht(g.spend / n, 0) : '—';
            }}
            shade={() => 0}
          />
        </Section>
      </div>
    </div>
  );
}

function SegTable({
  grid,
  cell,
  shade
}: {
  grid: Map<string, { spend: number; inbox: number; purchases: number; purchaseValue: number }>;
  cell: (g: { spend: number; inbox: number; purchases: number } | undefined) => string;
  shade: (g: { spend: number } | undefined) => number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[var(--text-muted)] text-xs">
          <tr>
            <th className="text-left font-medium py-1">อายุ</th>
            {GENDERS.map((g) => (
              <th key={g.key} className="text-right font-medium">
                {g.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {AGES.map((age) => (
            <tr key={age} className="border-t border-[var(--border)]">
              <td className="py-1.5">{age}</td>
              {GENDERS.map((g) => {
                const v = grid.get(`${age}|${g.key}`);
                const a = shade(v);
                return (
                  <td key={g.key} className="text-right px-2" style={a > 0 ? { background: `rgba(200,120,92,${(0.08 + a * 0.5).toFixed(2)})` } : undefined}>
                    {cell(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
