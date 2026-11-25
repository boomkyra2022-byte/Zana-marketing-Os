// Ads Intelligence — read-only Meta Marketing API layer (server only).
//
// One pull feeds all four tabs (Dashboard, Ad Spotlight, Creative Fatigue,
// Video Ads): ad-level insights split by day (time_increment=1) for the
// selected range, plus an age × gender breakdown and creative details. The
// client aggregates these rows however each tab needs. Only GET calls —
// nothing here changes an ad, budget or status.

import { createServiceRoleClient } from '@/lib/supabase/server';

const API_VERSION = process.env.META_API_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;

export class MetaReportError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export type ActionList = { action_type: string; value: string }[] | undefined;

interface RawInsight {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  actions?: ActionList;
  action_values?: ActionList;
  video_play_actions?: ActionList;
  video_p25_watched_actions?: ActionList;
  video_p50_watched_actions?: ActionList;
  video_p75_watched_actions?: ActionList;
  video_p95_watched_actions?: ActionList;
  video_p100_watched_actions?: ActionList;
  video_thruplay_watched_actions?: ActionList;
  video_avg_time_watched_actions?: ActionList;
}

// Additive metrics — safe to sum across days / ads.
export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  plays: number;
  views3s: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  p100: number;
  thruplays: number;
  watchSecTotal: number; // avg watch time × plays, so it can be summed
  inbox: number;
  newInbox: number;
  leads: number;
  landingViews: number;
  purchases: number;
  purchaseValue: number;
}

export interface DailyAdRow extends Metrics {
  date: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  adId: string;
  adName: string;
  objective: string;
  reach: number;
  frequency: number;
}

export interface CreativeInfo {
  thumbnailUrl: string | null;
  body: string | null;
  title: string | null;
  videoId: string | null;
}

export interface SegmentRow extends Pick<Metrics, 'spend' | 'impressions' | 'plays' | 'inbox' | 'purchases' | 'purchaseValue' | 'linkClicks'> {
  age: string;
  gender: string;
}

export interface AdsReport {
  accountId: string;
  accountName: string | null;
  currency: string | null;
  timezone: string | null;
  since: string;
  until: string;
  reach: number; // account-level unique reach for the whole range
  rows: DailyAdRow[];
  creatives: Record<string, CreativeInfo>;
  segments: SegmentRow[];
  fetchedAt: string;
}

export function num(v: string | undefined | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function pickAction(list: ActionList, ...types: string[]): number {
  if (!list) return 0;
  // First matching alias wins (preference order) so the same event reported
  // under two names (omni_purchase + purchase) is never double-counted.
  for (const t of types) {
    const hit = list.find((a) => a.action_type === t);
    if (hit) return num(hit.value);
  }
  return 0;
}

const first = (list: ActionList) => (list && list.length > 0 ? num(list[0].value) : 0);

export const PURCHASE = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];
const INBOX = ['onsite_conversion.messaging_conversation_started_7d'];
const NEW_INBOX = ['onsite_conversion.messaging_first_reply'];
const LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
const LANDING = ['omni_landing_page_view', 'landing_page_view'];

export function normalizeAccountId(input: string): string | null {
  const digits = input.trim().replace(/^act_/i, '');
  return /^\d{5,25}$/.test(digits) ? `act_${digits}` : null;
}

// How Graph calls are authorized: a token available to this server (local
// env / Vault), or — when there is none — the `ads-insights-proxy` Edge
// Function, which holds the Supabase-secret token and adds it server-side.
export type MetaConn = { accountId: string; token: string } | { accountId: string; token: null };

function fetchGraph(url: string, conn: MetaConn): Promise<Response> {
  const signal = AbortSignal.timeout(45000);
  if (conn.token) {
    const u = new URL(url);
    u.searchParams.set('access_token', conn.token);
    return fetch(u.toString(), { cache: 'no-store', signal });
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new MetaReportError('ไม่มี META_SYSTEM_USER_TOKEN และตั้งค่า Supabase ไม่ครบ — เรียก ads-insights-proxy ไม่ได้', 500);
  const u = new URL(url);
  u.searchParams.delete('access_token');
  return fetch(`${base}/functions/v1/ads-insights-proxy`, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ accountId: conn.accountId, url: u.toString() })
  });
}

async function metaGetUrl<T>(url: string, conn: MetaConn): Promise<T> {
  let res: Response;
  try {
    res = await fetchGraph(url, conn);
  } catch (err: any) {
    if (err instanceof MetaReportError) throw err;
    throw new MetaReportError(err?.name === 'TimeoutError' ? 'Meta API ตอบช้าเกินไป — ลองเลือกช่วงวันสั้นลง' : 'เชื่อมต่อ Meta API ไม่ได้', 504);
  }
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    const msg: string = json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || `HTTP ${res.status}`;
    const code = json?.error?.code;
    if (res.status === 404 && !conn.token && /not found|NOT_FOUND/i.test(msg + JSON.stringify(json))) {
      throw new MetaReportError('ยังไม่ได้ deploy Edge Function ads-insights-proxy บน Supabase', 500);
    }
    if (code === 'NO_TOKEN') throw new MetaReportError('Supabase ไม่มี META_SYSTEM_USER_TOKEN สำหรับบัญชีนี้ — ตั้งด้วย supabase secrets set', 500);
    if (code === 190) {
      throw new MetaReportError(
        `Meta token หมดอายุหรือไม่ถูกต้อง — สร้าง System User token ใหม่ แล้วตั้งด้วย "npx supabase secrets set META_SYSTEM_USER_TOKEN=..." (${msg.slice(0, 120)})`,
        401
      );
    }
    if (code === 10 || code === 200 || code === 100) {
      throw new MetaReportError(`token นี้ไม่มีสิทธิ์อ่านบัญชีโฆษณานี้ หรือ ID ไม่ถูกต้อง (${msg})`, 403);
    }
    if (code === 17 || code === 4 || code === 80004) throw new MetaReportError('Meta จำกัดการเรียกข้อมูลชั่วคราว — รอสักครู่แล้วลองใหม่', 429);
    throw new MetaReportError(`Meta API error: ${msg}`, 502);
  }
  return json as T;
}

export function metaGet<T>(path: string, params: Record<string, string>, conn: MetaConn): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return metaGetUrl<T>(url.toString(), conn);
}

export async function getAllPages<T>(path: string, params: Record<string, string>, conn: MetaConn, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  let page = await metaGet<{ data: T[]; paging?: { next?: string } }>(path, params, conn);
  out.push(...(page.data ?? []));
  for (let n = 1; page.paging?.next && n < maxPages; n++) {
    page = await metaGetUrl(page.paging.next, conn);
    out.push(...(page.data ?? []));
  }
  return out;
}

// Token: an ad_accounts row may name a Vault secret (multi-Business-Manager
// setup, same rule as supabase/functions/_shared/accounts.ts); otherwise the
// single META_SYSTEM_USER_TOKEN env var. With neither, calls go through the
// ads-insights-proxy Edge Function (token: null).
export async function resolveMetaConn(accountId: string): Promise<MetaConn> {
  try {
    const admin = createServiceRoleClient();
    const { data: row } = await admin.from('ad_accounts').select('meta_token_secret_name').eq('meta_account_id', accountId).maybeSingle();
    if (row?.meta_token_secret_name) {
      const { data: secret } = await admin.rpc('get_vault_secret', { secret_name: row.meta_token_secret_name });
      if (typeof secret === 'string' && secret) return { accountId, token: secret };
    }
  } catch {
    // fall back to the env token / proxy
  }
  const envToken = process.env.META_SYSTEM_USER_TOKEN?.trim();
  return envToken ? { accountId, token: envToken } : { accountId, token: null };
}

const AD_FIELDS = [
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'objective',
  'spend',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'actions',
  'action_values',
  'video_play_actions',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p95_watched_actions',
  'video_p100_watched_actions',
  'video_thruplay_watched_actions',
  'video_avg_time_watched_actions'
].join(',');

export async function fetchAdsReport(opts: { accountId: string; since: string; until: string }): Promise<AdsReport> {
  const { accountId, since, until } = opts;
  const conn = await resolveMetaConn(accountId);
  const timeRange = JSON.stringify({ since, until });

  const [account, daily, segments, accountTotals] = await Promise.all([
    metaGet<{ name?: string; currency?: string; timezone_name?: string }>(`/${accountId}`, { fields: 'name,currency,timezone_name' }, conn),
    getAllPages<RawInsight>(
      `/${accountId}/insights`,
      { level: 'ad', time_increment: '1', fields: AD_FIELDS, time_range: timeRange, use_unified_attribution_setting: 'true', limit: '500' },
      conn
    ),
    getAllPages<any>(
      `/${accountId}/insights`,
      {
        level: 'account',
        breakdowns: 'age,gender',
        fields: 'spend,impressions,clicks,actions,action_values,video_play_actions',
        time_range: timeRange,
        use_unified_attribution_setting: 'true',
        limit: '100'
      },
      conn,
      3
    ),
    metaGet<{ data: { reach?: string }[] }>(`/${accountId}/insights`, { level: 'account', fields: 'reach', time_range: timeRange }, conn)
  ]);

  const rows: DailyAdRow[] = daily.map((r) => {
    const plays = first(r.video_play_actions);
    return {
      date: r.date_start,
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      adsetId: r.adset_id,
      adsetName: r.adset_name,
      adId: r.ad_id,
      adName: r.ad_name,
      objective: r.objective ?? '',
      reach: num(r.reach),
      frequency: num(r.frequency),
      spend: num(r.spend),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      linkClicks: pickAction(r.actions, 'link_click'),
      plays,
      views3s: pickAction(r.actions, 'video_view'),
      p25: first(r.video_p25_watched_actions),
      p50: first(r.video_p50_watched_actions),
      p75: first(r.video_p75_watched_actions),
      p95: first(r.video_p95_watched_actions),
      p100: first(r.video_p100_watched_actions),
      thruplays: first(r.video_thruplay_watched_actions),
      watchSecTotal: first(r.video_avg_time_watched_actions) * plays,
      inbox: pickAction(r.actions, ...INBOX),
      newInbox: pickAction(r.actions, ...NEW_INBOX),
      leads: pickAction(r.actions, ...LEAD),
      landingViews: pickAction(r.actions, ...LANDING),
      purchases: pickAction(r.actions, ...PURCHASE),
      purchaseValue: pickAction(r.action_values, ...PURCHASE)
    };
  });

  // Creative context (thumbnail, copy, video id) — nice-to-have, never fatal.
  const creatives: Record<string, CreativeInfo> = {};
  const adIds = [...new Set(rows.filter((r) => r.spend > 0).map((r) => r.adId))];
  for (let i = 0; i < adIds.length; i += 50) {
    try {
      const res = await metaGet<Record<string, any>>(
        '/',
        { ids: adIds.slice(i, i + 50).join(','), fields: 'creative{thumbnail_url,body,title,video_id,object_story_spec}' },
        conn
      );
      for (const [adId, ad] of Object.entries(res)) {
        const c = ad?.creative ?? {};
        const vd = c.object_story_spec?.video_data ?? {};
        creatives[adId] = {
          thumbnailUrl: c.thumbnail_url ?? vd.image_url ?? null,
          body: c.body ?? vd.message ?? null,
          title: c.title ?? vd.title ?? null,
          videoId: c.video_id ?? vd.video_id ?? null
        };
      }
    } catch {
      // keep going — numbers render without thumbnails
    }
  }

  return {
    accountId,
    accountName: account?.name ?? null,
    currency: account?.currency ?? null,
    timezone: account?.timezone_name ?? null,
    since,
    until,
    reach: num(accountTotals?.data?.[0]?.reach),
    rows,
    creatives,
    segments: segments
      .map((s) => ({
        age: String(s.age ?? 'unknown'),
        gender: String(s.gender ?? 'unknown'),
        spend: num(s.spend),
        impressions: num(s.impressions),
        linkClicks: pickAction(s.actions, 'link_click'),
        plays: first(s.video_play_actions),
        inbox: pickAction(s.actions, ...INBOX),
        purchases: pickAction(s.actions, ...PURCHASE),
        purchaseValue: pickAction(s.action_values, ...PURCHASE)
      }))
      .filter((s) => s.impressions > 0),
    fetchedAt: new Date().toISOString()
  };
}
