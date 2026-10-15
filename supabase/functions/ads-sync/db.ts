// Supabase upsert/insert helpers specific to the ads-sync Edge Function.
// Service client + account/token lookups now live in _shared/ — see
// _shared/supabase-client.ts and _shared/accounts.ts.

import type { ServiceClient } from '../_shared/supabase-client.ts';
import { sumActionValue } from '../_shared/meta-client.ts';
import type { MetaAdSetInsight, MetaAdSetMeta } from './meta.ts';

export { getServiceClient } from '../_shared/supabase-client.ts';
export { getActiveAdAccounts, resolveTokenForAccount } from '../_shared/accounts.ts';
export type { AdAccountRow } from '../_shared/accounts.ts';

import type { DiscoveredAccount } from './parse.ts';

// Records this run's outcome on the account row itself so the UI can show,
// per account, whether it is connected and why not. Diagnostics only: it must
// never fail a sync, so every error is swallowed (and logged without secrets).
export async function recordAccountResult(
  client: ServiceClient,
  accountId: string,
  result:
    | { ok: true; checkedAt: string; info?: DiscoveredAccount }
    | { ok: false; checkedAt: string; errorCode: number | null; errorText: string }
): Promise<void> {
  const patch: Record<string, unknown> = { last_sync_at: result.checkedAt };
  if (result.ok) {
    patch.last_sync_ok = true;
    patch.last_ok_at = result.checkedAt;
    patch.last_error_code = null;
    patch.last_error_text = null;
    if (result.info) {
      patch.meta_name = result.info.name;
      patch.meta_account_status = result.info.account_status;
      patch.currency = result.info.currency;
      patch.timezone_name = result.info.timezone_name;
      patch.business_id = result.info.business_id;
      patch.business_name = result.info.business_name;
      patch.meta_checked_at = result.checkedAt;
    }
  } else {
    patch.last_sync_ok = false;
    patch.last_error_code = result.errorCode;
    patch.last_error_text = result.errorText;
  }
  try {
    const { error } = await client.from('ad_accounts').update(patch).eq('id', accountId);
    if (error) console.error(`[ads-sync] recordAccountResult ${accountId}: ${error.message}`);
  } catch (err) {
    console.error(`[ads-sync] recordAccountResult ${accountId}: ${(err as Error).message}`);
  }
}

// Registers accounts a token can reach but nobody has added yet. New rows are
// created as status='paused' + source='discovered' (so ads-sync does NOT pull
// their data until a person enables them) and remember which Vault secret
// found them, so enabling later uses the right token. Rows that already exist
// only get their Meta-reported fields refreshed, never name/status/token.
export async function upsertDiscovered(
  client: ServiceClient,
  found: DiscoveredAccount[],
  tokenSecretName: string | null,
  checkedAt: string
): Promise<{ inserted: number; refreshed: number }> {
  if (found.length === 0) return { inserted: 0, refreshed: 0 };

  const { data: existing, error } = await client
    .from('ad_accounts')
    .select('meta_account_id, meta_name, meta_account_status, business_name, source')
    .in(
      'meta_account_id',
      found.map((f) => f.id)
    );
  if (error) throw new Error(`upsertDiscovered lookup: ${error.message}`);
  const byId = new Map((existing ?? []).map((row: { meta_account_id: string }) => [row.meta_account_id, row]));

  const fresh = found.filter((f) => !byId.has(f.id));
  if (fresh.length > 0) {
    const { error: insertError } = await client.from('ad_accounts').upsert(
      fresh.map((f) => ({
        meta_account_id: f.id,
        name: f.name ?? f.id,
        meta_name: f.name,
        meta_account_status: f.account_status,
        currency: f.currency,
        timezone_name: f.timezone_name,
        business_id: f.business_id,
        business_name: f.business_name,
        status: 'paused',
        source: 'discovered',
        meta_token_secret_name: tokenSecretName,
        meta_checked_at: checkedAt
      })),
      { onConflict: 'meta_account_id', ignoreDuplicates: true }
    );
    if (insertError) throw new Error(`upsertDiscovered insert: ${insertError.message}`);
  }

  let refreshed = 0;
  for (const f of found) {
    const row = byId.get(f.id) as
      | { meta_name: string | null; meta_account_status: number | null; business_name: string | null }
      | undefined;
    if (!row) continue;
    if (row.meta_name === f.name && row.meta_account_status === f.account_status && row.business_name === f.business_name) continue;
    const { error: updateError } = await client
      .from('ad_accounts')
      .update({
        meta_name: f.name,
        meta_account_status: f.account_status,
        business_id: f.business_id,
        business_name: f.business_name,
        currency: f.currency,
        meta_checked_at: checkedAt
      })
      .eq('meta_account_id', f.id);
    if (!updateError) refreshed += 1;
  }
  return { inserted: fresh.length, refreshed };
}

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
