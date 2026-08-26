// Thin Meta Marketing API client for the ads-sync Edge Function.
// Uses a System User access token (META_SYSTEM_USER_TOKEN) — never a
// personal/short-lived user token.

const META_API_VERSION = Deno.env.get('META_API_VERSION') ?? 'v21.0';
const META_SYSTEM_USER_TOKEN = Deno.env.get('META_SYSTEM_USER_TOKEN');

const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaAdSetInsight {
  ad_id?: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  frequency: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export interface MetaAdSetMeta {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  optimization_goal?: string;
  campaign_id: string;
}

function assertToken(): string {
  if (!META_SYSTEM_USER_TOKEN) {
    throw new Error('META_SYSTEM_USER_TOKEN is not set (Edge Function secret)');
  }
  return META_SYSTEM_USER_TOKEN;
}

async function metaGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = assertToken();
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// Ad-set-level insights (spend, ROAS ingredients, frequency, results) for
// a single ad account, "today" attribution window.
export async function fetchAdSetInsights(metaAccountId: string): Promise<MetaAdSetInsight[]> {
  const fields = [
    'adset_id',
    'adset_name',
    'campaign_id',
    'campaign_name',
    'date_start',
    'date_stop',
    'spend',
    'impressions',
    'clicks',
    'reach',
    'frequency',
    'ctr',
    'cpc',
    'cpm',
    'actions',
    'action_values'
  ].join(',');

  const data = await metaGet<{ data: MetaAdSetInsight[] }>(`/${metaAccountId}/insights`, {
    level: 'adset',
    date_preset: 'today',
    fields
  });
  return data.data;
}

// Ad-set metadata (budget, status, optimization goal) — merged with
// insights so ad_sets stays current even for ad sets with no spend today.
export async function fetchAdSets(metaAccountId: string): Promise<MetaAdSetMeta[]> {
  const fields = ['id', 'name', 'status', 'daily_budget', 'lifetime_budget', 'bid_strategy', 'optimization_goal', 'campaign_id'].join(
    ','
  );

  const data = await metaGet<{ data: MetaAdSetMeta[] }>(`/${metaAccountId}/adsets`, {
    fields,
    effective_status: JSON.stringify(['ACTIVE', 'PAUSED']),
    limit: '500'
  });
  return data.data;
}

export function sumActionValue(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === type);
  return match ? Number(match.value) : 0;
}
