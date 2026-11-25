// Types + pure helpers for the Ads Board (Meta Ads Manager-style table).
// No imports, so both the client and Node tests can use it.

export type BoardLevel = 'campaign' | 'adset' | 'ad';

export interface BoardMetrics {
  spend: number;
  impressions: number;
  reach: number | null; // unique — never summed across entities / accounts
  clicks: number;
  linkClicks: number;
  contacts: number; // messaging contacts (total_messaging_connection)
  conversations: number; // messaging conversations started (7d)
  purchases: number;
  purchaseValue: number;
}

export interface BoardRow extends BoardMetrics {
  accountId: string;
  accountName: string;
  level: BoardLevel;
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  adsetId: string | null;
  adsetName: string | null;
  status: string | null; // Meta effective_status
  dailyBudget: number | null; // major currency units
  lifetimeBudget: number | null;
  budgetFrom: 'self' | 'campaign' | 'adset' | null; // where the budget is set
  resultType: string | null; // Meta indicator, e.g. actions:onsite_conversion.purchase
  results: number | null;
  costPerResult: number | null;
}

export interface BoardReport {
  accountId: string;
  accountName: string;
  currency: string;
  timezone: string | null;
  level: BoardLevel;
  since: string;
  until: string;
  rows: BoardRow[];
  totalReach: number | null;
  warnings: string[];
  fetchedAt: string;
}

export interface BoardRates {
  roas: number | null;
  costPerPurchase: number | null;
  costPerContact: number | null;
  cpc: number | null; // CPC (all)
  ctr: number | null; // CTR (all), fraction
  linkCpc: number | null;
  linkCtr: number | null;
  cpm: number | null;
  frequency: number | null;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export function boardRates(m: BoardMetrics): BoardRates {
  const perImpression = div(m.spend, m.impressions);
  return {
    roas: m.purchaseValue > 0 ? div(m.purchaseValue, m.spend) : null,
    costPerPurchase: div(m.spend, m.purchases),
    costPerContact: div(m.spend, m.contacts),
    cpc: div(m.spend, m.clicks),
    ctr: div(m.clicks, m.impressions),
    linkCpc: div(m.spend, m.linkClicks),
    linkCtr: div(m.linkClicks, m.impressions),
    cpm: perImpression === null ? null : perImpression * 1000,
    frequency: m.reach ? m.impressions / m.reach : null
  };
}

export interface BoardTotals extends BoardMetrics {
  results: number | null;
  resultType: string | null;
  costPerResult: number | null;
}

// Reach is unique people (not additive) and Meta prices it per 1,000.
export function isReachResult(indicator: string | null): boolean {
  return !!indicator && /(^|[:_.])reach$/i.test(indicator);
}

// Totals add up what is additive. Reach is only known when one account's own
// total is passed in; results only when every row counts the same thing.
export function boardTotals(rows: BoardRow[], reach: number | null): BoardTotals {
  const t: BoardTotals = {
    spend: 0,
    impressions: 0,
    reach,
    clicks: 0,
    linkClicks: 0,
    contacts: 0,
    conversations: 0,
    purchases: 0,
    purchaseValue: 0,
    results: null,
    resultType: null,
    costPerResult: null
  };
  for (const r of rows) {
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.clicks += r.clicks;
    t.linkClicks += r.linkClicks;
    t.contacts += r.contacts;
    t.conversations += r.conversations;
    t.purchases += r.purchases;
    t.purchaseValue += r.purchaseValue;
  }
  const spent = rows.filter((r) => r.spend > 0);
  const types = new Set(spent.map((r) => r.resultType));
  const type = types.size === 1 ? [...types][0] : null;
  if (type && !isReachResult(type)) {
    t.resultType = type;
    t.results = spent.reduce((s, r) => s + (r.results ?? 0), 0);
    t.costPerResult = div(t.spend, t.results);
  }
  return t;
}

const RESULT_LABELS: [RegExp, string][] = [
  [/messaging_conversation_started/, 'เริ่มการสนทนา'],
  [/messaging_first_reply/, 'ผู้ติดต่อใหม่'],
  [/total_messaging_connection/, 'ผู้ติดต่อผ่านข้อความ'],
  [/messaging/, 'ข้อความ'],
  [/onsite_conversion\.purchase/, 'การซื้อบน Meta'],
  [/purchase/, 'การซื้อ'],
  [/lead/, 'ลูกค้าเป้าหมาย'],
  [/landing_page_view/, 'ดูหน้า Landing'],
  [/link_click/, 'คลิกลิงก์'],
  [/thruplay/i, 'ThruPlay'],
  [/video_view|video_play/, 'ดูวิดีโอ'],
  [/post_engagement|page_engagement/, 'การมีส่วนร่วม'],
  [/like|follow/, 'ถูกใจ/ติดตาม'],
  [/reach/, 'การเข้าถึง'],
  [/impressions/, 'อิมเพรสชัน']
];

export function resultLabel(indicator: string | null): string {
  if (!indicator) return '';
  return RESULT_LABELS.find(([re]) => re.test(indicator))?.[1] ?? indicator.replace(/^actions:/, '');
}

export type BoardTone = 'ok' | 'warn' | 'bad' | 'muted';

const STATUS: Record<string, { label: string; tone: BoardTone }> = {
  ACTIVE: { label: 'เปิดใช้งาน', tone: 'ok' },
  PAUSED: { label: 'ปิดอยู่', tone: 'muted' },
  CAMPAIGN_PAUSED: { label: 'แคมเปญปิดอยู่', tone: 'muted' },
  ADSET_PAUSED: { label: 'ชุดโฆษณาปิดอยู่', tone: 'muted' },
  PENDING_REVIEW: { label: 'รอตรวจสอบ', tone: 'warn' },
  IN_PROCESS: { label: 'กำลังดำเนินการ', tone: 'warn' },
  PREAPPROVED: { label: 'อนุมัติล่วงหน้า', tone: 'warn' },
  WITH_ISSUES: { label: 'มีปัญหา', tone: 'bad' },
  DISAPPROVED: { label: 'ไม่ผ่านการอนุมัติ', tone: 'bad' },
  PENDING_BILLING_INFO: { label: 'รอข้อมูลชำระเงิน', tone: 'bad' },
  ARCHIVED: { label: 'เก็บถาวร', tone: 'muted' },
  DELETED: { label: 'ลบแล้ว', tone: 'muted' }
};

export function statusInfo(s: string | null): { label: string; tone: BoardTone } {
  return (s && STATUS[s]) || { label: s ?? '—', tone: 'muted' };
}

// ── Dates (Thailand time — matches the ad accounts' Asia/Bangkok timezone) ──
export interface DateRange {
  since: string;
  until: string;
}

export const DATE_PRESETS: { key: string; label: string }[] = [
  { key: 'today', label: 'วันนี้' },
  { key: 'yesterday', label: 'เมื่อวาน' },
  { key: 'last_3d', label: '3 วันล่าสุด' },
  { key: 'last_7d', label: '7 วันล่าสุด' },
  { key: 'last_14d', label: '14 วันล่าสุด' },
  { key: 'last_30d', label: '30 วันล่าสุด' },
  { key: 'this_month', label: 'เดือนนี้' },
  { key: 'last_month', label: 'เดือนที่แล้ว' }
];

export function bangkokToday(now: number = Date.now()): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "N วันล่าสุด" ends yesterday, the same as Ads Manager.
export function rangeForPreset(key: string, today: string = bangkokToday()): DateRange {
  const lastN = /^last_(\d+)d$/.exec(key);
  if (lastN) return { since: addDays(today, -Number(lastN[1])), until: addDays(today, -1) };
  if (key === 'yesterday') return { since: addDays(today, -1), until: addDays(today, -1) };
  if (key === 'this_month') return { since: `${today.slice(0, 7)}-01`, until: today };
  if (key === 'last_month') {
    const until = addDays(`${today.slice(0, 7)}-01`, -1);
    return { since: `${until.slice(0, 7)}-01`, until };
  }
  return { since: today, until: today };
}

// Name as it appears in Meta first; our own label only when Meta's is unknown.
export function accountDisplayName(a: { name: string; meta_name?: string | null }): string {
  return a.meta_name?.trim() || a.name;
}
