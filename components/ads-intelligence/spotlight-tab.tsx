'use client';

import type { AdsReport } from '@/lib/meta/ads-report';
import { aggregate, baht, int, pct, rates, spotlight, type Level, type ResultKind, type SpotlightItem } from '@/lib/meta/ads-metrics';
import { Badge, Section, Thumb } from './ui';

export interface SpotlightOpts {
  minSpend: number;
  result: ResultKind;
  level: Level;
}

export function spotlightAiData(report: AdsReport, opts: SpotlightOpts) {
  const s = spotlight(aggregate(report.rows, opts.level, report.creatives), opts);
  const item = (i: SpotlightItem) => ({
    name: i.row.name,
    parent: i.row.parentName,
    spend: i.row.spend,
    results: i.results,
    costPerResult: i.cpr,
    linkCtr: rates(i.row).linkCtr,
    reason: i.reason
  });
  return {
    resultType: opts.result,
    level: opts.level,
    minSpend: opts.minSpend,
    eligible: s.eligible,
    medianCostPerResult: s.medianCpr,
    scale: s.scale.map(item),
    kill: s.kill.map(item),
    topCreatives: s.creatives.map((c) => ({ name: c.name, linkCtr: rates(c).linkCtr, spend: c.spend, inbox: c.inbox, purchases: c.purchases, copy: c.creative?.body?.slice(0, 200) ?? null }))
  };
}

export function SpotlightTab({ report, opts, setOpts }: { report: AdsReport; opts: SpotlightOpts; setOpts: (o: SpotlightOpts) => void }) {
  const entities = aggregate(report.rows, opts.level, report.creatives);
  const ads = opts.level === 'ad' ? entities : aggregate(report.rows, 'ad', report.creatives);
  const s = spotlight(entities, opts);
  const creatives = opts.level === 'ad' ? s.creatives : spotlight(ads, opts).creatives;
  const resultLabel = opts.result === 'inbox' ? 'แชท' : 'ยอดซื้อ';

  return (
    <div className="space-y-4">
      <div className="card p-3 sm:p-4 flex flex-wrap items-end gap-3">
        <div>
          <span className="field-label">ผลลัพธ์หลัก</span>
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['inbox', 'purchase'] as ResultKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setOpts({ ...opts, result: k })}
                className={`px-3 py-2 text-sm ${opts.result === k ? 'bg-[var(--accent-terracotta)] text-white' : 'bg-white'}`}
              >
                {k === 'inbox' ? 'Inbox' : 'Purchase'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="field-label">ระดับ</span>
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(
              [
                ['campaign', 'แคมเปญ'],
                ['adset', 'ชุดโฆษณา'],
                ['ad', 'โฆษณา']
              ] as [Level, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setOpts({ ...opts, level: k })}
                className={`px-3 py-2 text-sm ${opts.level === k ? 'bg-[var(--accent-terracotta)] text-white' : 'bg-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-40">
          <label className="field-label" htmlFor="spot-min">
            ใช้เงินขั้นต่ำ (฿)
          </label>
          <input id="spot-min" type="number" min={0} step={50} value={opts.minSpend} onChange={(e) => setOpts({ ...opts, minSpend: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
        <p className="text-xs text-[var(--text-muted)] basis-full">
          เกณฑ์: เพิ่มงบ = ต้นทุนต่อ{resultLabel} ต่ำกว่าค่ากลางบัญชี ≥ 20% และมีผลลัพธ์ ≥ 2 · พิจารณาปิด = ใช้เงิน ≥ 2 เท่าของค่ากลางแต่ยังไม่มีผลลัพธ์ หรือแพงกว่าค่ากลาง ≥ 1.5 เท่า · ค่ากลางบัญชีตอนนี้{' '}
          <b>{baht(s.medianCpr)}</b> ต่อ{resultLabel} (จาก {s.eligible} รายการที่ใช้เงินถึงเกณฑ์)
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {s.health.map((h) => (
          <div key={h.label} className="card px-3 py-3">
            <Badge tone={h.tone}>{h.label}</Badge>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{h.count}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`ควรเพิ่มงบ · ${s.scale.length}`} hint="แนะนำเพิ่มทีละ 20–30% แล้วดูผล 2–3 วัน">
          <SpotList items={s.scale} empty={`ยังไม่มีรายการที่ต้นทุนต่อ${resultLabel}ดีกว่าค่ากลางชัดเจน — ต้องมีรายการที่ใช้เงินถึงเกณฑ์และมีผลลัพธ์อย่างน้อย 2 รายการ`} tone="good" resultLabel={resultLabel} />
        </Section>
        <Section title={`ควรพิจารณาปิด · ${s.kill.length}`} hint="เช็กก่อนว่าไม่ได้อยู่ในช่วง learning หรือเพิ่งแก้ไข">
          <SpotList items={s.kill} empty="ไม่มีรายการที่เปลืองงบเกินเกณฑ์" tone="bad" resultLabel={resultLabel} />
        </Section>
      </div>

      <Section title="ครีเอทีฟที่ให้ผลดี" hint="โฆษณาที่ใช้เงินถึงเกณฑ์และอิมเพรสชัน ≥ 1,000 เรียงตาม CTR ลิงก์">
        {creatives.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">ยังไม่มีโฆษณาที่เข้าเกณฑ์ — ลองลด “ใช้เงินขั้นต่ำ”</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {creatives.map((c) => {
              const r = rates(c);
              return (
                <div key={c.id} className="rounded-lg border border-[var(--border)] p-3 bg-white">
                  <div className="flex gap-3">
                    <Thumb creative={c.creative} size={64} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium line-clamp-2">{c.name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{c.campaignName}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-2 text-xs tabular-nums">
                    <div>
                      <div className="text-[var(--text-muted)]">CTR</div>
                      <div className="font-semibold">{pct(r.linkCtr, 2)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Inbox</div>
                      <div className="font-semibold">{int(c.inbox)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Purchase</div>
                      <div className="font-semibold">{int(c.purchases)}</div>
                    </div>
                  </div>
                  {c.creative?.body ? <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-3">{c.creative.body}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function SpotList({ items, empty, tone, resultLabel }: { items: SpotlightItem[]; empty: string; tone: string; resultLabel: string }) {
  if (items.length === 0) return <p className="text-sm text-[var(--text-muted)]">{empty}</p>;
  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((i) => (
        <li key={i.row.id} className="py-2.5 flex gap-3">
          {i.row.level === 'ad' ? <Thumb creative={i.row.creative} size={44} /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-sm">{i.row.name}</span>
              <Badge tone={tone}>{i.cpr === null ? `0 ${resultLabel}` : `${baht(i.cpr, 0)} / ${resultLabel}`}</Badge>
            </div>
            {i.row.parentName ? <div className="text-xs text-[var(--text-muted)] truncate">{i.row.parentName}</div> : null}
            <div className="text-xs mt-0.5">{i.reason}</div>
            <div className="text-xs text-[var(--text-muted)] tabular-nums mt-0.5">
              ใช้ไป {baht(i.row.spend, 0)} · {resultLabel} {int(i.results)} · CTR ลิงก์ {pct(rates(i.row).linkCtr, 2)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
