// Supabase upsert/insert helpers specific to the ads-sync Edge Function.
// Service client + account/token lookups now live in _shared/ — see
// _shared/supabase-client.ts and _shared/accounts.ts.

import type { ServiceClient } from '../_shared/supabase-client.ts';
import { sumActionValue } from '../_shared/meta-client.ts';
import type { MetaAdSetInsight, MetaAdSetMeta } from './meta.ts';

export { getServiceClient } from '../_shared/supabase-client.ts';
export { getActiveAdAccounts, resolveTokenForAccount } from '../_shared/accounts.ts';
export type { AdAccountRow } from '../_shared/accounts.ts';

// Upserts campaigns/ad sets discovered this run, returns id maps keyed by
// the Meta-side id so the insight snapshot insert can resolve local uuids.
export async function upsertCampaignsAndAdSets(
  client: ServiceClient,
  adAccountUuid: string,
  adSets: MetaAdSetMeta[],
  campaignNamesById: Map<string, string>
): Promise<{ campaignIdByMeta: Map<string, string>; adSetIdByMeta: Map<string, string> }> {
  const campaignIdByMeta = new Map<string, string>();
  const adSetIdByMeta = new Map<string, string>();

  const uniqueCampaignIds = [...new Set(adSets.map((a) => a.campaign_id))];
  for (const metaCampaignId of uniqueCampaignIds) {
    const { data, error } = await client
      .from('ad_campaigns')
      .upsert(
        {
          ad_account_id: adAccountUuid,
          meta_campaign_id: metaCampaignId,
          name: campaignNamesById.get(metaCampaignId) ?? metaCampaignId,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'meta_campaign_id' }
      )
      .select('id, meta_campaign_id')
      .single();
    if (error) throw new Error(`upsert ad_campaigns ${metaCampaignId}: ${error.message}`);
    campaignIdByMeta.set(metaCampaignId, data.id);
  }

  for (const adSet of adSets) {
    const campaignUuid = campaignIdByMeta.get(adSet.campaign_id);
    if (!campaignUuid) continue;

    const { data, error } = await client
      .from('ad_sets')
      .upsert(
        {
          campaign_id: campaignUuid,
          ad_account_id: adAccountUuid,
          meta_adset_id: adSet.id,
          name: adSet.name,
          status: adSet.status,
          daily_budget: adSet.daily_budget ? Number(adSet.daily_budget) / 100 : null,
          lifetime_budget: adSet.lifetime_budget ? Number(adSet.lifetime_budget) / 100 : null,
          bid_strategy: adSet.bid_strategy ?? null,
          optimization_goal: adSet.optimization_goal ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'meta_adset_id' }
      )
      .select('id, meta_adset_id')
      .single();
    if (error) throw new Error(`upsert ad_sets ${adSet.id}: ${error.message}`);
    adSetIdByMeta.set(adSet.id, data.id);
  }

  return { campaignIdByMeta, adSetIdByMeta };
}

export async function insertInsightSnapshots(
  client: ServiceClient,
  adAccountUuid: string,
  insights: MetaAdSetInsight[],
  campaignIdByMeta: Map<string, string>,
  adSetIdByMeta: Map<string, string>
): Promise<number> {
  if (insights.length === 0) return 0;

  const capturedAt = new Date().toISOString();
  const rows = insights
    .map((insight) => {
      const campaignId = campaignIdByMeta.get(insight.campaign_id);
      const adSetId = adSetIdByMeta.get(insight.adset_id);
      if (!campaignId || !adSetId) return null;

      const spend = Number(insight.spend ?? 0);
      const purchases = sumActionValue(insight.actions, 'omni_purchase') || sumActionValue(insight.actions, 'purchase');
      const purchaseValue =
        sumActionValue(insight.action_values, 'omni_purchase') || sumActionValue(insight.action_values, 'purchase');

      return {
        ad_account_id: adAccountUuid,
        campaign_id: campaignId,
        ad_set_id: adSetId,
        captured_at: capturedAt,
        date_start: insight.date_start,
        date_stop: insight.date_stop,
        spend,
        impressions: Number(insight.impressions ?? 0),
        clicks: Number(insight.clicks ?? 0),
        reach: Number(insight.reach ?? 0),
        frequency: Number(insight.frequency ?? 0),
        ctr: Number(insight.ctr ?? 0),
        cpc: Number(insight.cpc ?? 0),
        cpm: Number(insight.cpm ?? 0),
        purchases,
        purchase_value: purchaseValue,
        roas: spend > 0 ? purchaseValue / spend : null,
        cpa: purchases > 0 ? spend / purchases : null,
        result_type: 'omni_purchase',
        results: purchases,
        raw: insight
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const { error } = await client.from('ad_set_insight_snapshots').insert(rows);
  if (error) throw new Error(`insert ad_set_insight_snapshots: ${error.message}`);
  return rows.length;
}

export interface SyncRunUpdate {
  status: 'success' | 'partial' | 'failed';
  accounts_synced: number;
  ad_sets_synced: number;
  error_message?: string | null;
}

export async function startSyncRun(client: ReturnType<typeof getServiceClient>): Promise<string> {
  const { data, error } = await client.from('ad_sync_runs').insert({ status: 'running' }).select('id').single();
  if (error) throw new Error(`startSyncRun: ${error.message}`);
  return data.id;
}

export async function finishSyncRun(client: ServiceClient, runId: string, update: SyncRunUpdate) {
  const { error } = await client
    .from('ad_sync_runs')
    .update({ ...update, finished_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) throw new Error(`finishSyncRun: ${error.message}`);
}
