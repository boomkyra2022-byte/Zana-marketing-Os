'use client';

import { useState } from 'react';
import type { AdsReport, Metrics } from '@/lib/meta/ads-report';
import { aggregate, baht, diagnoseVideo, int, objectiveLabel, pct, rates, sumRows, videoScore, type EntityRow, type Level } from '@/lib/meta/ads-metrics';
import { Badge, downloadCsv, Kpi, Section, Thumb } from './ui';

const STAGE_TONE: Record<string, string> = { low_data: 'muted', hook: 'bad', hold: 'warn', click: 'warn', convert: 'info', ok: 'good' };

function videoRows(report: AdsReport) {
  return report.rows.filter((r) => r.plays > 0);
}

export function videoAiData(report: AdsReport) {
  const ads = aggregate(videoRows(report), 'ad', report.creatives);
  return {
    totals: (() => {
      const t = sumRows(videoRows(report));
      return { spend: t.spend, plays: t.plays, ...pickVideoRates(t) };
    })(),
    ads: ads
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 40)
      .map((a) => ({
        name: a.name,
        campaign: a.campaignName,
        objective: objectiveLabel(a.objective),
        spend: a.spend,
        impressions: a.impressions,
        ...pickVideoRates(a),
        inbox: a.inbox,
        purchases: a.purchases,
        diagnosis: diagnoseVideo(a).label,
        copy: a.creative?.body?.slice(0, 200) ?? null
      }))
  };
}

function pickVideoRates(a: Metrics) {
  const r = rates(a);
  return { hookRate: r.hookRate, holdRate: r.holdRate, completion: r.completion, linkCtr: r.linkCtr, cpm: r.cpm, avgWatchSec: r.avgWatchSec, roas: r.roas };
}

type SortKey = 'completion' | 'hookRate' | 'holdRate' | 'linkCtr' | 'spend' | 'plays';

export function VideoTab({ report }: { report: AdsReport }) {
  const [level, setLevel] = useState<Level>('ad');
  const [sort, setSort] = useState<SortKey>('completion');
  const rows = videoRows(report);
  const t = sumRows(rows);
  const tr = rates(t);
  const entities = aggregate(rows, level, report.creatives);
  const sortVal = (e: EntityRow) => (sort === 'spend' ? e.spend : sort === 'plays' ? e.plays : (rates(e)[sort] ?? -1));
  const sorted = [...entities].sort((a, b) => sortVal(b) - sortVal(a));
  const ads = level === 'ad' ? entities : aggregate(rows, 'ad', report.creatives);
  const best = ads
    .map((a) => ({ a, s: videoScore(a, ads) }))
    .filter((x): x is { a: EntityRow; s: number } => x.s !== null)
    .sort((x, y) => y.s - x.s)[0]?.a;

  if (rows.length === 0) {
    return <div className="card p-8 text-center text-[var(--text-muted)]">ช่วงวันที่นี้ไม่มีโฆษณาวิดีโอที่ถูกเล่น</div>;
  }

  const objectiveSplit = (() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.objective, (m.get(r.objective) ?? 0) + r.plays);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const exportCsv = () =>
    downloadCsv(
      `video-ads_${report.accountId}_${report.since}_${report.until}.csv`,
      ['level', 'name', 'parent', 'spend', 'impressions', 'plays', '3s views', 'thruplays', 'p95', 'hook rate', 'hold rate', 'completion', 'link CTR', 'avg watch sec', 'inbox', 'purchases', 'diagnosis'],
      sorted.map((e) => {
        const r = rates(e);
        return [level, e.name, e.parentName, e.spend, e.impressions, e.plays, e.views3s, e.thruplays, e.p95, r.hookRate, r.holdRate, r.completion, r.linkCtr, r.avgWatchSec, e.inbox, e.purchases, diagnoseVideo(e).label];
      })
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi label="Spend (วิดีโอ)" value={baht(t.spend, 0)} />
        <Kpi label="การเล่นวิดีโอ" value={int(t.plays)} />
        <Kpi label="Hook rate" value={pct(tr.hookRate)} sub="ดูเกิน 3 วิ / อิมเพรสชัน" />
        <Kpi label="Hold rate" value={pct(tr.holdRate)} sub="ThruPlay / ดูเกิน 3 วิ" />
        <Kpi label="ดูจบเฉลี่ย" value={pct(tr.completion, 2)} sub="ดูถึง 95% / เล่น" />
        <Kpi label="ดูเฉลี่ย" value={tr.avgWatchSec === null ? '—' : `${tr.avgWatchSec.toFixed(1)} วิ`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="ยอดเล่นตามวัตถุประสงค์">
          <ul className="space-y-2 text-sm">
            {objectiveSplit.map(([o, plays]) => (
              <li key={o}>
                <div className="flex justify-between">
                  <span>{objectiveLabel(o)}</span>
                  <span className="tabular-nums">
                    {int(plays)} · {pct(plays / t.plays)}
                  </span>
                </div>
                <div className="h-2 bg-stone-100 rounded mt-1 overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${(plays / t.plays) * 100}%`, background: 'var(--accent-analytics)' }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="คลิปที่แนะนำ" hint="ให้น้ำหนักผลลัพธ์จริง (ซื้อ/แชท/คลิก) ก่อน แล้วค่อยดู Hook, Hold, CTR · ต้องมีอิมเพรสชัน ≥ 1,000">
          {best ? (
            <div className="flex gap-3">
              <Thumb creative={best.creative} size={72} />
              <div className="min-w-0 text-sm">
                <div className="font-medium">{best.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{best.campaignName}</div>
                <div className="text-xs mt-1 tabular-nums">
                  Hook {pct(rates(best).hookRate)} · Hold {pct(rates(best).holdRate)} · CTR {pct(rates(best).linkCtr, 2)} · แชท {int(best.inbox)} · ซื้อ {int(best.purchases)}
                </div>
                <div className="text-xs mt-1">{diagnoseVideo(best).detail}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">ยังไม่มีคลิปที่ข้อมูลพอให้แนะนำ</p>
          )}
        </Section>
        <Section title="วิธีอ่าน funnel วิดีโอ">
          <ul className="text-xs space-y-1 text-[var(--text-muted)]">
            <li>
              <b className="text-[var(--text-main)]">Hook rate</b> &lt; 25% → 3 วิแรกไม่หยุดนิ้ว
            </li>
            <li>
              <b className="text-[var(--text-main)]">Hold rate</b> &lt; 15% → กลางคลิปยืด
            </li>
            <li>
              <b className="text-[var(--text-main)]">CTR ลิงก์</b> &lt; 0.8% → CTA/ข้อเสนอไม่ชัด
            </li>
            <li>มีคลิกแต่ไม่มีแชท/ซื้อ → ปัญหาหลังคลิก (landing, ราคา, แอดมิน)</li>
            <li>เกณฑ์เป็นจุดเริ่มต้น ไม่ใช่ค่าตายตัวของทุกสินค้า</li>
          </ul>
        </Section>
      </div>

      <Section
        title="ประสิทธิภาพโฆษณาวิดีโอ"
        right={
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
              {(
                [
                  ['campaign', 'แคมเปญ'],
                  ['adset', 'ชุดโฆษณา'],
                  ['ad', 'โฆษณา']
                ] as [Level, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setLevel(k)} className={`px-3 py-1.5 ${level === k ? 'bg-[var(--accent-terracotta)] text-white' : 'bg-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={exportCsv}>
              Download CSV
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="text-[var(--text-muted)] text-xs">
              <tr>
                <th className="text-left font-medium py-1">ชื่อ</th>
                {(
                  [
                    ['spend', 'ใช้ไป'],
                    ['plays', 'เล่น'],
                    ['hookRate', 'Hook'],
                    ['holdRate', 'Hold'],
                    ['completion', 'ดูจบ'],
                    ['linkCtr', 'CTR ลิงก์']
                  ] as [SortKey, string][]
                ).map(([k, label]) => (
                  <th key={k} className="text-right font-medium">
                    <button type="button" onClick={() => setSort(k)} className={sort === k ? 'text-[var(--text-main)] font-semibold' : ''}>
                      {label} {sort === k ? '▼' : '⇅'}
                    </button>
                  </th>
                ))}
                <th className="text-right font-medium">ดูเฉลี่ย</th>
                <th className="text-right font-medium">แชท</th>
                <th className="text-right font-medium">ซื้อ</th>
                <th className="text-left font-medium pl-3">จุดรั่ว</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sorted.map((e) => {
                const r = rates(e);
                const d = diagnoseVideo(e);
                return (
                  <tr key={e.id} className="border-t border-[var(--border)] align-top">
                    <td className="py-2 pr-2">
                      <div className="flex gap-2">
                        {level === 'ad' ? <Thumb creative={e.creative} size={36} /> : null}
                        <div className="min-w-0">
                          <div className="font-medium font-sans">{e.name}</div>
                          {e.parentName ? <div className="text-xs text-[var(--text-muted)]">{e.parentName}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-right">{baht(e.spend, 0)}</td>
                    <td className="py-2 text-right">{int(e.plays)}</td>
                    <td className={`py-2 text-right ${r.hookRate !== null && r.hookRate < 0.25 ? 'text-red-700' : ''}`}>{pct(r.hookRate)}</td>
                    <td className={`py-2 text-right ${r.holdRate !== null && r.holdRate < 0.15 ? 'text-red-700' : ''}`}>{pct(r.holdRate)}</td>
                    <td className="py-2 text-right">{pct(r.completion, 2)}</td>
                    <td className="py-2 text-right">{pct(r.linkCtr, 2)}</td>
                    <td className="py-2 text-right">{r.avgWatchSec === null ? '—' : `${r.avgWatchSec.toFixed(1)}s`}</td>
                    <td className="py-2 text-right">{int(e.inbox)}</td>
                    <td className="py-2 text-right">{int(e.purchases)}</td>
                    <td className="py-2 pl-3 max-w-[260px]">
                      <Badge tone={STAGE_TONE[d.stage]}>{d.label}</Badge>
                      <div className="text-xs text-[var(--text-muted)] mt-1 font-sans">{d.detail}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
