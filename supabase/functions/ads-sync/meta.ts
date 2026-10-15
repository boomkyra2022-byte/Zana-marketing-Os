// Meta Marketing API read calls specific to the ads-sync Edge Function
// (ad-set insights + ad-set metadata). Built on the shared HTTP client in
// _shared/meta-client.ts — see that file for why token is passed explicitly.

import { metaGet } from '../_shared/meta-client.ts';
import { toDiscovered, type DiscoveredAccount } from './parse.ts';

// Account-level info (name, Meta's own status code, currency, owner business).
// This is also the cheapest permission probe: a token with no ads_read on the
// account fails here with Meta error 200, before the heavier adsets/insights calls.
export async function fetchAccountInfo(metaAccountId: string, token: string): Promise<DiscoveredAccount> {
  const raw = await metaGet<Record<string, unknown>>(
    `/${metaAccountId}`,
    { fields: 'id,name,account_status,currency,timezone_name,business{id,name}' },
    token
  );
  const info = toDiscovered(raw);
  if (!info) throw new Error('Meta account info response had no usable id');
  return info;
}

// Every ad account this token can reach (System User: the accounts assigned to
// it). Used to discover accounts nobody registered yet. Paginates, capped so a
// runaway cursor can never loop forever.
export async function fetchAccessibleAccounts(token: string): Promise<DiscoveredAccount[]> {
  const found: DiscoveredAccount[] = [];
  let after: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const params: Record<string, string> = {
      fields: 'id,name,account_status,currency,timezone_name,business{id,name}',
      limit: '100'
    };
    if (after) params.after = after;
    const res = await metaGet<{ data?: unknown[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      '/me/adaccounts',
      params,
      token
    );
    for (const row of res.data ?? []) {
      const account = toDiscovered(row);
      if (account) found.push(account);
    }
    after = res.paging?.next ? res.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return found;
}

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

// Ad-set-level insights (spend, ROAS ingredients, frequency, results) for
// a single ad account, "today" attribution window.
export async function fetchAdSetInsights(metaAccountId: string, token: string): Promise<MetaAdSetInsight[]> {
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

  const data = await metaGet<{ data: MetaAdSetInsight[] }>(
    `/${metaAccountId}/insights`,
    {
      level: 'adset',
      date_preset: 'today',
      fields
    },
    token
  );
  return data.data;
}

// Ad-set metadata (budget, status, optimization goal) — merged with
// insights so ad_sets stays current even for ad sets with no spend today.
export async function fetchAdSets(metaAccountId: string, token: string): Promise<MetaAdSetMeta[]> {
  const fields = ['id', 'name', 'status', 'daily_budget', 'lifetime_budget', 'bid_strategy', 'optimization_goal', 'campaign_id'].join(
    ','
  );

  const data = await metaGet<{ data: MetaAdSetMeta[] }>(
    `/${metaAccountId}/adsets`,
    {
      fields,
      effective_status: JSON.stringify(['ACTIVE', 'PAUSED']),
      limit: '500'
    },
    token
  );
  return data.data;
}
