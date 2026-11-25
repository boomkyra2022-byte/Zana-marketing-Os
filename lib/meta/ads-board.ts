// Ads Board — one Meta Ads Manager-style table per account / level / date
// range (server only, read-only GET calls).
//
// Unlike ads-report.ts (daily rows), this asks Meta for the whole range in one
// row per entity, so reach is truly unique and `results` / `cost_per_result`
// are Meta's own numbers under each ad set's own attribution setting — the
// same figures Ads Manager shows.

import {
  getAllPages,
  metaGet,
  MetaReportError,
  normalizeAccountId,
  num,
  pickAction,
  PURCHASE,
  resolveMetaConn,
  type ActionList,
  type MetaConn
} from '@/lib/meta/ads-report';
import { isReachResult, type BoardLevel, type BoardReport, type BoardRow } from '@/lib/meta/ads-board-shared';

const CONTACTS = ['onsite_conversion.total_messaging_connection'];
const CONVERSATIONS = ['onsite_conversion.messaging_conversation_started_7d'];

// Meta returns budgets in the currency's smallest unit, except these.
const ZERO_DECIMAL = new Set(['CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND']);

type ResultList = { indicator?: string; values?: { value?: string }[] }[] | undefined;

interface RawBoardInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: ActionList;
  action_values?: ActionList;
  results?: ResultList;
  cost_per_result?: ResultList;
}

interface RawEntity {
  id: string;
  name: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  campaign?: RawEntity;
  adset?: RawEntity;
}

const EDGE: Record<BoardLevel, string> = { campaign: 'campaigns', adset: 'adsets', ad: 'ads' };
const BUDGET = 'daily_budget,lifetime_budget';
const ENTITY_FIELDS: Record<BoardLevel, string> = {
  campaign: `id,name,effective_status,${BUDGET}`,
  adset: `id,name,effective_status,${BUDGET},campaign{id,name,${BUDGET}}`,
  ad: `id,name,effective_status,adset{id,name,${BUDGET}},campaign{id,name,${BUDGET}}`
};
const ID_FIELDS: Record<BoardLevel, string> = {
  campaign: 'campaign_id,campaign_name',
  adset: 'campaign_id,campaign_name,adset_id,adset_name',
  ad: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name'
};

// Read through field expansion on the account node itself (`/act_x?fields=
// adsets...{...}`): same account, GET only, on a path ads-insights-proxy
// already allows.
async function fetchEntities(conn: MetaConn, level: BoardLevel, modifier: string): Promise<RawEntity[]> {
  const edge = EDGE[level];
  const res = await metaGet<Record<string, { data?: RawEntity[] }>>(
    `/${conn.accountId}`,
    { fields: `${edge}${modifier}{${ENTITY_FIELDS[level]}}` },
    conn
  );
  return res[edge]?.data ?? [];
}

const ACTIVE_LIMIT = 200;

export async function fetchAdsBoard(opts: { accountId: string; since: string; until: string; level: BoardLevel }): Promise<BoardReport> {
  const { since, until, level } = opts;
  const accountId = normalizeAccountId(opts.accountId);
  if (!accountId) throw new MetaReportError('ID บัญชีโฆษณาไม่ถูกต้อง', 400);
  const conn = await resolveMetaConn(accountId);
  const timeRange = JSON.stringify({ since, until });

  const [account, insights, accountTotal] = await Promise.all([
    metaGet<{ name?: string; currency?: string; timezone_name?: string }>(`/${accountId}`, { fields: 'name,currency,timezone_name' }, conn),
    getAllPages<RawBoardInsight>(
      `/${accountId}/insights`,
      {
        level,
        fields: `${ID_FIELDS[level]},spend,impressions,reach,clicks,actions,action_values,results,cost_per_result`,
        time_range: timeRange,
        use_unified_attribution_setting: 'true',
        limit: '200'
      },
      conn
    ),
    metaGet<{ data: { reach?: string }[] }>(`/${accountId}/insights`, { level: 'account', fields: 'reach', time_range: timeRange }, conn)
  ]);

  const currency = account.currency ?? 'THB';
  const offset = ZERO_DECIMAL.has(currency) ? 1 : 100;
  const accountName = account.name ?? accountId;
  const warnings: string[] = [];

  // Settings (status, budget) for everything that delivered in the range plus
  // everything currently active. Numbers still render if this part fails.
  const idOf = (r: RawBoardInsight) => (level === 'campaign' ? r.campaign_id : level === 'adset' ? r.adset_id : r.ad_id) ?? '';
  const delivered = insights.map(idOf).filter(Boolean);
  const calls: Promise<RawEntity[]>[] = [fetchEntities(conn, level, `.effective_status(["ACTIVE"]).limit(${ACTIVE_LIMIT})`)];
  for (let i = 0; i < delivered.length; i += 100) {
    const filtering = JSON.stringify([{ field: `${level}.id`, operator: 'IN', value: delivered.slice(i, i + 100) }]);
    calls.push(fetchEntities(conn, level, `.filtering(${filtering}).limit(100)`));
  }
  const settled = await Promise.allSettled(calls);
  const meta = new Map<string, RawEntity>();
  for (const s of settled) {
    if (s.status === 'fulfilled') for (const e of s.value) meta.set(e.id, e);
  }
  const failed = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failed) warnings.push(`อ่านสถานะ/งบประมาณได้ไม่ครบ (${failed.reason?.message ?? 'ไม่ทราบสาเหตุ'})`);
  if (settled[0].status === 'fulfilled' && settled[0].value.length >= ACTIVE_LIMIT) {
    warnings.push(`รายการที่เปิดใช้งานเกิน ${ACTIVE_LIMIT} รายการ — รายการที่ยังไม่มีการใช้เงินอาจแสดงไม่ครบ`);
  }

  const money = (v?: string) => (v && Number(v) > 0 ? Number(v) / offset : null);
  // Budget lives on the ad set, or on the campaign when it uses a campaign budget.
  function settings(e: RawEntity | undefined): Pick<BoardRow, 'status' | 'dailyBudget' | 'lifetimeBudget' | 'budgetFrom'> {
    const status = e?.effective_status ?? null;
    const sources: [RawEntity | undefined, 'self' | 'adset' | 'campaign'][] = [
      [e, 'self'],
      [e?.adset, 'adset'],
      [e?.campaign, 'campaign']
    ];
    for (const [src, budgetFrom] of sources) {
      const dailyBudget = money(src?.daily_budget);
      const lifetimeBudget = money(src?.lifetime_budget);
      if (dailyBudget !== null || lifetimeBudget !== null) return { status, dailyBudget, lifetimeBudget, budgetFrom };
    }
    return { status, dailyBudget: null, lifetimeBudget: null, budgetFrom: null };
  }

  const rows: BoardRow[] = insights.map((r) => {
    const id = idOf(r);
    // "mixed" = ad sets underneath count different things; Meta shows no single number.
    const res = r.results?.[0]?.indicator === 'mixed' ? undefined : r.results?.[0];
    const results = res ? num(res.values?.[0]?.value) : null;
    const spend = num(r.spend);
    const metaCpr = r.cost_per_result?.[0]?.values?.[0]?.value;
    return {
      accountId,
      accountName,
      level,
      id,
      name: (level === 'campaign' ? r.campaign_name : level === 'adset' ? r.adset_name : r.ad_name) ?? id,
      campaignId: r.campaign_id,
      campaignName: r.campaign_name,
      adsetId: r.adset_id ?? null,
      adsetName: r.adset_name ?? null,
      ...settings(meta.get(id)),
      spend,
      impressions: num(r.impressions),
      reach: num(r.reach),
      clicks: num(r.clicks),
      linkClicks: pickAction(r.actions, 'link_click'),
      contacts: pickAction(r.actions, ...CONTACTS),
      conversations: pickAction(r.actions, ...CONVERSATIONS),
      purchases: pickAction(r.actions, ...PURCHASE),
      purchaseValue: pickAction(r.action_values, ...PURCHASE),
      resultType: res?.indicator ?? null,
      results,
      costPerResult: !res ? null : metaCpr !== undefined ? num(metaCpr) : results ? (spend / results) * (isReachResult(res.indicator ?? null) ? 1000 : 1) : null
    };
  });

  // Active but nothing delivered in this range — Ads Manager lists these too.
  const seen = new Set(delivered);
  for (const e of meta.values()) {
    if (seen.has(e.id)) continue;
    rows.push({
      accountId,
      accountName,
      level,
      id: e.id,
      name: e.name,
      campaignId: level === 'campaign' ? e.id : e.campaign?.id ?? '',
      campaignName: level === 'campaign' ? e.name : e.campaign?.name ?? '',
      adsetId: level === 'adset' ? e.id : e.adset?.id ?? null,
      adsetName: level === 'adset' ? e.name : e.adset?.name ?? null,
      ...settings(e),
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      linkClicks: 0,
      contacts: 0,
      conversations: 0,
      purchases: 0,
      purchaseValue: 0,
      resultType: null,
      results: null,
      costPerResult: null
    });
  }

  const totalReach = accountTotal.data?.[0]?.reach;
  return {
    accountId,
    accountName,
    currency,
    timezone: account.timezone_name ?? null,
    level,
    since,
    until,
    rows,
    totalReach: totalReach === undefined ? null : num(totalReach),
    warnings,
    fetchedAt: new Date().toISOString()
  };
}
