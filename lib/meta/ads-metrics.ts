// Pure, client-safe metric helpers for Ads Intelligence. Every tab works off
// the same daily ad rows from lib/meta/ads-report.ts; these functions roll
// them up (by day, by campaign / ad set / ad), derive rates, and apply the
// Spotlight / Fatigue / Video rules. No server imports — used by the client.
//
// The rules and thresholds here are ZANA's own starting points, shown to the
// user on the page (and adjustable there), not copied from any other tool.

import type { CreativeInfo, DailyAdRow, Metrics } from './ads-report';

export type Level = 'campaign' | 'adset' | 'ad';

const METRIC_KEYS: (keyof Metrics)[] = [
  'spend',
  'impressions',
  'clicks',
  'linkClicks',
  'plays',
  'views3s',
  'p25',
  'p50',
  'p75',
  'p95',
  'p100',
  'thruplays',
  'watchSecTotal',
  'inbox',
  'newInbox',
  'leads',
  'landingViews',
  'purchases',
  'purchaseValue'
];

export function emptyMetrics(): Metrics {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as unknown as Metrics;
}

function addInto(target: Metrics, src: Metrics) {
  for (const k of METRIC_KEYS) target[k] += src[k];
}

export function sumRows(rows: DailyAdRow[]): Metrics {
  const m = emptyMetrics();
  for (const r of rows) addInto(m, r);
  return m;
}

// ── Rates ───────────────────────────────────────────────────────────────
export interface Rates {
  cpm: number | null;
  ctrAll: number | null;
  linkCtr: number | null;
  cpc: number | null;
  hookRate: number | null; // 3-sec views / impressions
  holdRate: number | null; // ThruPlays / 3-sec views
  completion: number | null; // 95% views / plays
  avgWatchSec: number | null;
  costPerInbox: number | null;
  costPerNewInbox: number | null;
  costPerLead: number | null;
  costPerPurchase: number | null;
  roas: number | null;
  inboxPerClick: number | null;
  purchasePerInbox: number | null;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);
const cost = (spend: number, n: number) => (n > 0 ? spend / n : null);

export function rates(m: Metrics): Rates {
  return {
    cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null,
    ctrAll: div(m.clicks, m.impressions),
    linkCtr: div(m.linkClicks, m.impressions),
    cpc: cost(m.spend, m.linkClicks),
    hookRate: m.plays > 0 ? div(m.views3s, m.impressions) : null,
    holdRate: div(m.thruplays, m.views3s),
    completion: div(m.p95, m.plays),
    avgWatchSec: div(m.watchSecTotal, m.plays),
    costPerInbox: cost(m.spend, m.inbox),
    costPerNewInbox: cost(m.spend, m.newInbox),
    costPerLead: cost(m.spend, m.leads),
    costPerPurchase: cost(m.spend, m.purchases),
    roas: m.spend > 0 ? m.purchaseValue / m.spend : null,
    inboxPerClick: div(m.inbox, m.linkClicks),
    purchasePerInbox: div(m.purchases, m.inbox)
  };
}

// ── Roll-ups ────────────────────────────────────────────────────────────
export interface DayRow extends Metrics {
  date: string;
}

export function byDay(rows: DailyAdRow[], since: string, until: string): DayRow[] {
  const map = new Map<string, DayRow>();
  // Pre-fill every date so charts show zero-spend days instead of gaps.
  for (let d = new Date(`${since}T00:00:00Z`); d <= new Date(`${until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, ...emptyMetrics() });
  }
  for (const r of rows) {
    let day = map.get(r.date);
    if (!day) {
      day = { date: r.date, ...emptyMetrics() };
      map.set(r.date, day);
    }
    addInto(day, r);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface EntityRow extends Metrics {
  level: Level;
  id: string;
  name: string;
  parentName: string | null;
  campaignName: string;
  objective: string;
  adCount: number;
  activeDays: number;
  firstDate: string;
  lastDate: string;
  avgFrequency: number | null; // impression-weighted mean of daily frequency
  creative: CreativeInfo | null;
}

export function aggregate(rows: DailyAdRow[], level: Level, creatives: Record<string, CreativeInfo> = {}): EntityRow[] {
  const map = new Map<string, EntityRow & { _ads: Set<string>; _days: Set<string>; _freqW: number }>();
  for (const r of rows) {
    const id = level === 'campaign' ? r.campaignId : level === 'adset' ? r.adsetId : r.adId;
    let e = map.get(id);
    if (!e) {
      e = {
        level,
        id,
        name: level === 'campaign' ? r.campaignName : level === 'adset' ? r.adsetName : r.adName,
        parentName: level === 'campaign' ? null : level === 'adset' ? r.campaignName : `${r.campaignName} › ${r.adsetName}`,
        campaignName: r.campaignName,
        objective: r.objective,
        adCount: 0,
        activeDays: 0,
        firstDate: r.date,
        lastDate: r.date,
        avgFrequency: null,
        creative: level === 'ad' ? creatives[r.adId] ?? null : null,
        ...emptyMetrics(),
        _ads: new Set(),
        _days: new Set(),
        _freqW: 0
      };
      map.set(id, e);
    }
    addInto(e, r);
    e._ads.add(r.adId);
    if (r.spend > 0) e._days.add(r.date);
    e._freqW += r.frequency * r.impressions;
    if (r.date < e.firstDate) e.firstDate = r.date;
    if (r.date > e.lastDate) e.lastDate = r.date;
    if (!e.creative && level !== 'ad' && creatives[r.adId]) e.creative = creatives[r.adId];
  }
  return [...map.values()].map(({ _ads, _days, _freqW, ...e }) => ({
    ...e,
    adCount: _ads.size,
    activeDays: _days.size,
    avgFrequency: e.impressions > 0 ? _freqW / e.impressions : null
  }));
}

export function byObjective(rows: DailyAdRow[]) {
  const map = new Map<string, Metrics>();
  for (const r of rows) {
    const key = r.objective || 'UNKNOWN';
    if (!map.has(key)) map.set(key, emptyMetrics());
    addInto(map.get(key)!, r);
  }
  return [...map.entries()].map(([objective, m]) => ({ objective, ...m })).sort((a, b) => b.spend - a.spend);
}

export function objectiveLabel(o: string): string {
  const map: Record<string, string> = {
    OUTCOME_AWARENESS: 'Awareness',
    OUTCOME_ENGAGEMENT: 'Engagement',
    OUTCOME_TRAFFIC: 'Traffic',
    OUTCOME_LEADS: 'Leads',
    OUTCOME_SALES: 'Sales',
    OUTCOME_APP_PROMOTION: 'App',
    MESSAGES: 'Messages',
    CONVERSIONS: 'Conversions',
    LINK_CLICKS: 'Traffic',
    VIDEO_VIEWS: 'Video views',
    POST_ENGAGEMENT: 'Engagement',
    REACH: 'Reach',
    BRAND_AWARENESS: 'Awareness'
  };
  return map[o] ?? o;
}

// ── Ad Spotlight ────────────────────────────────────────────────────────
export type ResultKind = 'inbox' | 'purchase';

export interface SpotlightItem {
  row: EntityRow;
  cpr: number | null;
  results: number;
  reason: string;
}

export interface SpotlightResult {
  eligible: number;
  medianCpr: number | null;
  scale: SpotlightItem[];
  kill: SpotlightItem[];
  creatives: EntityRow[];
  health: { label: string; count: number; tone: 'good' | 'warn' | 'bad' | 'muted' }[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function spotlight(entities: EntityRow[], opts: { minSpend: number; result: ResultKind }): SpotlightResult {
  const resultOf = (e: EntityRow) => (opts.result === 'inbox' ? e.inbox : e.purchases);
  const eligible = entities.filter((e) => e.spend >= opts.minSpend);
  const cprs = eligible.filter((e) => resultOf(e) > 0).map((e) => e.spend / resultOf(e));
  const med = median(cprs);
  const label = opts.result === 'inbox' ? 'แชท' : 'ยอดซื้อ';

  const scale: SpotlightItem[] = [];
  const kill: SpotlightItem[] = [];
  for (const e of eligible) {
    const results = resultOf(e);
    const cpr = results > 0 ? e.spend / results : null;
    if (cpr !== null && med !== null && results >= 2 && cpr <= med * 0.8) {
      scale.push({ row: e, cpr, results, reason: `ต้นทุนต่อ${label} ${baht(cpr)} ต่ำกว่าค่ากลางบัญชี (${baht(med)}) ${pct(1 - cpr / med, 0)}` });
    } else if (results === 0 && (med === null ? e.spend >= opts.minSpend * 2 : e.spend >= med * 2)) {
      kill.push({ row: e, cpr, results, reason: `ใช้ไป ${baht(e.spend)} ยังไม่มี${label}เลย` });
    } else if (cpr !== null && med !== null && cpr >= med * 1.5) {
      kill.push({ row: e, cpr, results, reason: `ต้นทุนต่อ${label} ${baht(cpr)} แพงกว่าค่ากลางบัญชี ${(cpr / med).toFixed(1)} เท่า` });
    }
  }
  scale.sort((a, b) => (a.cpr ?? Infinity) - (b.cpr ?? Infinity));
  kill.sort((a, b) => b.row.spend - a.row.spend);

  const creatives = eligible
    .filter((e) => e.level === 'ad' && e.impressions >= 1000)
    .sort((a, b) => (rates(b).linkCtr ?? 0) - (rates(a).linkCtr ?? 0) || resultOf(b) - resultOf(a))
    .slice(0, 8);

  const neutral = eligible.length - scale.length - kill.length;
  return {
    eligible: eligible.length,
    medianCpr: med,
    scale,
    kill,
    creatives,
    health: [
      { label: 'ควรเพิ่มงบ', count: scale.length, tone: 'good' },
      { label: 'ทรงตัว', count: Math.max(neutral, 0), tone: 'muted' },
      { label: 'ควรพิจารณาปิด', count: kill.length, tone: 'bad' },
      { label: `ใช้เงินไม่ถึง ${baht(opts.minSpend, 0)}`, count: entities.length - eligible.length, tone: 'warn' }
    ]
  };
}

// ── Creative Fatigue ────────────────────────────────────────────────────
export type FatigueStatus = 'replace_now' | 'fatigued' | 'early' | 'fresh' | 'low_data';

export interface FatigueRow {
  ad: EntityRow;
  status: FatigueStatus;
  ctrPeak: number | null;
  ctrRecent: number | null;
  ctrChange: number | null; // recent vs peak, negative = drop
  cpmChange: number | null; // recent vs first window, positive = more expensive
  freqRecent: number | null;
  cprChange: number | null;
  series: { date: string; ctr: number | null; cpm: number | null; frequency: number | null; spend: number }[];
  reasons: string[];
}

export const FATIGUE_STATUS: Record<FatigueStatus, { label: string; tone: string }> = {
  replace_now: { label: 'ต้องเปลี่ยนภายในสัปดาห์นี้', tone: 'bad' },
  fatigued: { label: 'ล้าแล้ว', tone: 'bad' },
  early: { label: 'เริ่มล้า', tone: 'warn' },
  fresh: { label: 'ยังสด', tone: 'good' },
  low_data: { label: 'ข้อมูลยังไม่พอ', tone: 'muted' }
};

function windowMetrics(days: DayRow[]) {
  const m = emptyMetrics();
  for (const d of days) addInto(m, d);
  return m;
}

export function fatigue(rows: DailyAdRow[], creatives: Record<string, CreativeInfo>, opts: { minSpend: number; minDays: number; result: ResultKind }): FatigueRow[] {
  const ads = aggregate(rows, 'ad', creatives);
  const rowsByAd = new Map<string, DailyAdRow[]>();
  for (const r of rows) {
    if (!rowsByAd.has(r.adId)) rowsByAd.set(r.adId, []);
    rowsByAd.get(r.adId)!.push(r);
  }

  const out: FatigueRow[] = [];
  for (const ad of ads) {
    if (ad.spend <= 0) continue;
    const adRows = rowsByAd.get(ad.id) ?? [];
    const days = byDay(adRows, ad.firstDate, ad.lastDate).filter((d) => d.spend > 0);
    const freqByDate = new Map<string, number>();
    for (const r of adRows) freqByDate.set(r.date, r.frequency);
    const series = days.map((d) => ({
      date: d.date,
      ctr: div(d.linkClicks, d.impressions),
      cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : null,
      frequency: freqByDate.get(d.date) ?? null,
      spend: d.spend
    }));

    const base: FatigueRow = {
      ad,
      status: 'low_data',
      ctrPeak: null,
      ctrRecent: null,
      ctrChange: null,
      cpmChange: null,
      freqRecent: ad.avgFrequency,
      cprChange: null,
      series,
      reasons: []
    };

    if (ad.spend < opts.minSpend || days.length < opts.minDays) {
      base.reasons.push(`ใช้เงิน ${baht(ad.spend, 0)} · รัน ${days.length} วัน (เกณฑ์ ≥ ${baht(opts.minSpend, 0)} และ ≥ ${opts.minDays} วัน)`);
      out.push(base);
      continue;
    }

    // Peak = best rolling 3-day link CTR; recent = last 3 active days.
    const win = 3;
    let peak: number | null = null;
    for (let i = 0; i + win <= days.length - win; i++) {
      const m = windowMetrics(days.slice(i, i + win));
      const ctr = div(m.linkClicks, m.impressions);
      if (ctr !== null && (peak === null || ctr > peak)) peak = ctr;
    }
    const recentM = windowMetrics(days.slice(-win));
    const firstM = windowMetrics(days.slice(0, win));
    const recentCtr = div(recentM.linkClicks, recentM.impressions);
    const recentCpm = recentM.impressions > 0 ? (recentM.spend / recentM.impressions) * 1000 : null;
    const firstCpm = firstM.impressions > 0 ? (firstM.spend / firstM.impressions) * 1000 : null;
    const resultOf = (m: Metrics) => (opts.result === 'inbox' ? m.inbox : m.purchases);
    const firstCpr = cost(firstM.spend, resultOf(firstM));
    const recentCpr = cost(recentM.spend, resultOf(recentM));
    const recentFreqRows = adRows.filter((r) => days.slice(-win).some((d) => d.date === r.date));
    const freqImpr = recentFreqRows.reduce((s, r) => s + r.impressions, 0);
    const freqRecent = freqImpr > 0 ? recentFreqRows.reduce((s, r) => s + r.frequency * r.impressions, 0) / freqImpr : null;

    const ctrChange = peak !== null && peak > 0 && recentCtr !== null ? recentCtr / peak - 1 : null;
    const cpmChange = firstCpm && recentCpm !== null ? recentCpm / firstCpm - 1 : null;
    const cprChange = firstCpr && recentCpr ? recentCpr / firstCpr - 1 : null;

    const reasons: string[] = [];
    if (ctrChange !== null && ctrChange <= -0.15) reasons.push(`CTR ลิงก์ลดจากช่วงพีค ${pct(-ctrChange, 0)} (${pct(peak, 2)} → ${pct(recentCtr, 2)})`);
    if (cpmChange !== null && cpmChange >= 0.25) reasons.push(`CPM แพงขึ้น ${pct(cpmChange, 0)} จากช่วงแรก`);
    if (freqRecent !== null && freqRecent >= 2.5) reasons.push(`ความถี่ช่วงหลัง ${freqRecent.toFixed(1)} ครั้ง/คน/วัน`);
    if (cprChange !== null && cprChange >= 0.3) reasons.push(`ต้นทุนต่อผลลัพธ์แพงขึ้น ${pct(cprChange, 0)}`);

    let status: FatigueStatus = 'fresh';
    const bigDrop = ctrChange !== null && ctrChange <= -0.3;
    const someDrop = ctrChange !== null && ctrChange <= -0.15;
    const pressure = (freqRecent !== null && freqRecent >= 2.5) || (cpmChange !== null && cpmChange >= 0.25) || (cprChange !== null && cprChange >= 0.3);
    if (bigDrop && pressure) status = 'replace_now';
    else if (bigDrop || (someDrop && pressure)) status = 'fatigued';
    else if (someDrop || pressure) status = 'early';
    if (status === 'fresh') reasons.push('CTR ยังใกล้ช่วงพีค ไม่มีสัญญาณล้า');

    out.push({ ...base, status, ctrPeak: peak, ctrRecent: recentCtr, ctrChange, cpmChange, freqRecent, cprChange, reasons });
  }

  const order: FatigueStatus[] = ['replace_now', 'fatigued', 'early', 'fresh', 'low_data'];
  return out.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.ad.spend - a.ad.spend);
}

// ── Video funnel ────────────────────────────────────────────────────────
export const VIDEO_BENCH = { hookRate: 0.25, holdRate: 0.15, linkCtr: 0.008, minImpressions: 1000 };

export type VideoStage = 'low_data' | 'hook' | 'hold' | 'click' | 'convert' | 'ok';

export function diagnoseVideo(e: EntityRow): { stage: VideoStage; label: string; detail: string } {
  const r = rates(e);
  if (e.impressions < VIDEO_BENCH.minImpressions) {
    return { stage: 'low_data', label: 'ข้อมูลยังน้อย', detail: `อิมเพรสชันแค่ ${int(e.impressions)} — รอให้ถึง ~1,000 ก่อนตัดสิน` };
  }
  if (r.hookRate !== null && r.hookRate < VIDEO_BENCH.hookRate) {
    return { stage: 'hook', label: 'Hook อ่อน', detail: `ดูเกิน 3 วิแค่ ${pct(r.hookRate)} ของคนที่เห็น — 3 วิแรกไม่หยุดนิ้ว ลองเปลี่ยนภาพเปิด/ประโยคแรก` };
  }
  if (r.holdRate !== null && r.holdRate < VIDEO_BENCH.holdRate) {
    return { stage: 'hold', label: 'กลางคลิปหลุด', detail: `ผ่าน hook แล้วแต่ดูต่อถึง ThruPlay แค่ ${pct(r.holdRate)} — ช่วงกลางยืด/ไม่มีเหตุผลให้ดูต่อ` };
  }
  if (r.linkCtr !== null && r.linkCtr < VIDEO_BENCH.linkCtr && e.inbox === 0) {
    return { stage: 'click', label: 'ดูแต่ไม่กด', detail: `CTR ลิงก์แค่ ${pct(r.linkCtr, 2)} — CTA/ข้อเสนอไม่ชัด หรือวัตถุประสงค์แคมเปญไม่ได้ดันคลิก` };
  }
  if (e.purchases === 0 && e.inbox === 0 && e.linkClicks > 20) {
    return { stage: 'convert', label: 'คลิกแล้วไม่ปิด', detail: `มีคลิก ${int(e.linkClicks)} ครั้งแต่ยังไม่มีแชท/ยอดซื้อ — เช็กหน้า landing ราคา หรือการตอบแชท` };
  }
  return { stage: 'ok', label: 'Funnel ผ่าน', detail: 'ทุกขั้นผ่านเกณฑ์เบื้องต้น — ตัวเลือกสำหรับเพิ่มงบ/ทำคลิปต่อยอด' };
}

// Composite pick for "แนะนำ" on the Video tab — real outcomes first, then
// the funnel. Rows under the data threshold are never recommended.
export function videoScore(e: EntityRow, all: EntityRow[]): number | null {
  if (e.impressions < VIDEO_BENCH.minImpressions) return null;
  const pool = all.filter((x) => x.impressions >= VIDEO_BENCH.minImpressions);
  const norm = (pick: (x: EntityRow) => number) => {
    const max = Math.max(...pool.map(pick), 0);
    return max > 0 ? pick(e) / max : 0;
  };
  const resultsPer1k = (x: EntityRow) => ((x.purchases * 5 + x.inbox * 2 + x.linkClicks * 0.2) / x.impressions) * 1000;
  return (
    0.35 * norm(resultsPer1k) +
    0.25 * norm((x) => rates(x).hookRate ?? 0) +
    0.2 * norm((x) => rates(x).holdRate ?? 0) +
    0.2 * norm((x) => rates(x).linkCtr ?? 0)
  );
}

// ── Formatting ──────────────────────────────────────────────────────────
export function pct(v: number | null, digits = 1): string {
  return v === null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`;
}

export function baht(v: number | null, digits = 2): string {
  return v === null || !Number.isFinite(v)
    ? '—'
    : `฿${v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function int(v: number): string {
  return Math.round(v).toLocaleString('th-TH');
}

export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
