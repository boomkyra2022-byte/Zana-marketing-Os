'use client';

import { useState } from 'react';
import type { AdsReport } from '@/lib/meta/ads-report';
import { baht, FATIGUE_STATUS, fatigue, pct, type FatigueStatus, type ResultKind } from '@/lib/meta/ads-metrics';
import { Badge, Section, Sparkline, Thumb } from './ui';

export interface FatigueOpts {
  minSpend: number;
  minDays: number;
  result: ResultKind;
}

export function fatigueAiData(report: AdsReport, opts: FatigueOpts) {
  return {
    criteria: opts,
    ads: fatigue(report.rows, report.creatives, opts)
      .filter((f) => f.status !== 'low_data')
      .slice(0, 30)
      .map((f) => ({
        name: f.ad.name,
        campaign: f.ad.campaignName,
        status: FATIGUE_STATUS[f.status].label,
        activeDays: f.ad.activeDays,
        spend: f.ad.spend,
        ctrPeak: f.ctrPeak,
        ctrRecent: f.ctrRecent,
        ctrChange: f.ctrChange,
        cpmChange: f.cpmChange,
        frequencyRecent: f.freqRecent,
        costPerResultChange: f.cprChange,
        copy: f.ad.creative?.body?.slice(0, 200) ?? null
      }))
  };
}

const ORDER: FatigueStatus[] = ['replace_now', 'fatigued', 'early', 'fresh', 'low_data'];

export function FatigueTab({ report, opts, setOpts }: { report: AdsReport; opts: FatigueOpts; setOpts: (o: FatigueOpts) => void }) {
  const [filter, setFilter] = useState<FatigueStatus | 'all'>('all');
  const rows = fatigue(report.rows, report.creatives, opts);
  const counts = Object.fromEntries(ORDER.map((s) => [s, rows.filter((r) => r.status === s).length])) as Record<FatigueStatus, number>;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(filter === s ? 'all' : s)}
            className={`card px-3 py-3 text-left ${filter === s ? 'ring-2 ring-[var(--accent-terracotta)]' : ''}`}
          >
            <Badge tone={FATIGUE_STATUS[s].tone}>{FATIGUE_STATUS[s].label}</Badge>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{counts[s]}</div>
          </button>
        ))}
      </div>

      <div className="card p-3 sm:p-4 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="field-label" htmlFor="fat-spend">
            ใช้จ่ายรวมขั้นต่ำ (฿)
          </label>
          <input id="fat-spend" type="number" min={0} step={100} value={opts.minSpend} onChange={(e) => setOpts({ ...opts, minSpend: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
        <div className="w-40">
          <label className="field-label" htmlFor="fat-days">
            รันอย่างน้อย (วัน)
          </label>
          <input id="fat-days" type="number" min={6} max={60} value={opts.minDays} onChange={(e) => setOpts({ ...opts, minDays: Math.min(60, Math.max(6, Number(e.target.value) || 6)) })} />
        </div>
        <div>
          <span className="field-label">ผลลัพธ์ที่ใช้คิดต้นทุน</span>
          <select value={opts.result} onChange={(e) => setOpts({ ...opts, result: e.target.value as ResultKind })}>
            <option value="inbox">Inbox</option>
            <option value="purchase">Purchase</option>
          </select>
        </div>
        <details className="basis-full text-xs text-[var(--text-muted)]">
          <summary className="cursor-pointer">เกณฑ์ที่หน้านี้ใช้ตัดสิน</summary>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>เทียบ CTR ลิงก์ 3 วันล่าสุด กับช่วง 3 วันที่ดีที่สุดก่อนหน้า</li>
            <li>แรงกดดัน = ความถี่ 3 วันล่าสุด ≥ 2.5 หรือ CPM แพงขึ้น ≥ 25% หรือต้นทุนต่อผลลัพธ์แพงขึ้น ≥ 30% (เทียบ 3 วันแรก)</li>
            <li>ต้องเปลี่ยนภายในสัปดาห์นี้ = CTR ตก ≥ 30% + มีแรงกดดัน · ล้าแล้ว = CTR ตก ≥ 30% หรือ (ตก ≥ 15% + แรงกดดัน) · เริ่มล้า = CTR ตก ≥ 15% หรือมีแรงกดดัน</li>
            <li>แนะนำเลือกช่วงวันที่ยาว (30 วัน) เพื่อให้เห็นแนวโน้ม</li>
          </ul>
        </details>
      </div>

      <Section title={`${shown.length} โฆษณา · เรียงจากล้าที่สุด`}>
        {shown.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">ไม่มีโฆษณาในกลุ่มนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="text-[var(--text-muted)] text-xs">
                <tr>
                  <th className="text-left font-medium py-1">โฆษณา</th>
                  <th className="text-left font-medium">สถานะ</th>
                  <th className="text-right font-medium">ใช้ไป</th>
                  <th className="text-right font-medium">วัน</th>
                  <th className="text-right font-medium">CTR พีค → ล่าสุด</th>
                  <th className="text-right font-medium">CPM</th>
                  <th className="text-right font-medium">ความถี่</th>
                  <th className="text-left font-medium pl-3">CTR รายวัน</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.ad.id} className="border-t border-[var(--border)] align-top">
                    <td className="py-2 pr-2">
                      <div className="flex gap-2">
                        <Thumb creative={f.ad.creative} size={40} />
                        <div className="min-w-0">
                          <div className="font-medium">{f.ad.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{f.ad.campaignName}</div>
                          <ul className="text-xs mt-1 space-y-0.5">
                            {f.reasons.map((r, i) => (
                              <li key={i}>• {r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </td>
                    <td className="py-2">
                      <Badge tone={FATIGUE_STATUS[f.status].tone}>{FATIGUE_STATUS[f.status].label}</Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">{baht(f.ad.spend, 0)}</td>
                    <td className="py-2 text-right tabular-nums">{f.ad.activeDays}</td>
                    <td className="py-2 text-right tabular-nums whitespace-nowrap">
                      {pct(f.ctrPeak, 2)} → {pct(f.ctrRecent, 2)}
                      {f.ctrChange !== null ? (
                        <div className={`text-xs ${f.ctrChange < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {f.ctrChange > 0 ? '+' : ''}
                          {pct(f.ctrChange, 0)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {f.cpmChange === null ? '—' : `${f.cpmChange > 0 ? '+' : ''}${pct(f.cpmChange, 0)}`}
                    </td>
                    <td className="py-2 text-right tabular-nums">{f.freqRecent === null ? '—' : f.freqRecent.toFixed(2)}</td>
                    <td className="py-2 pl-3">
                      <Sparkline values={f.series.map((s) => s.ctr)} stroke={FATIGUE_STATUS[f.status].tone === 'bad' ? '#b91c1c' : 'var(--accent-analytics)'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
