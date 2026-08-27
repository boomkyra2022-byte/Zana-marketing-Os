// Meta Marketing API read calls specific to the ads-sync Edge Function
// (ad-set insights + ad-set metadata). Built on the shared HTTP client in
// _shared/meta-client.ts — see that file for why token is passed explicitly.

import { metaGet } from '../_shared/meta-client.ts';

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
