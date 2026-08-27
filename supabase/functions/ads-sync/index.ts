// ads-sync Edge Function — Phase 1 data pipe.
// Invoked every 15 min by pg_cron (see 0015_ads_cron_schedule.sql).
// For every active row in `ad_accounts`: pulls ad-set-level insights +
// ad-set metadata from the Meta Marketing API, upserts ad_campaigns/ad_sets,
// inserts a snapshot row per ad set into ad_set_insight_snapshots, and logs
// the run to ad_sync_runs.
//
// Read-only against Meta — this function never writes back to Meta. Rules
// engine + actual pause/scale calls land in Phase 2.

import { fetchAdSetInsights, fetchAdSets } from './meta.ts';
import {
  finishSyncRun,
  getActiveAdAccounts,
  getServiceClient,
  insertInsightSnapshots,
  resolveTokenForAccount,
  startSyncRun,
  upsertCampaignsAndAdSets
} from './db.ts';

Deno.serve(async (_req) => {
  const client = getServiceClient();
  const runId = await startSyncRun(client);

  let accountsSynced = 0;
  let adSetsSynced = 0;
  const errors: string[] = [];

  try {
    const accounts = await getActiveAdAccounts(client);

    for (const account of accounts) {
      try {
        const token = await resolveTokenForAccount(client, account);
        const [adSets, insights] = await Promise.all([
          fetchAdSets(account.meta_account_id, token),
          fetchAdSetInsights(account.meta_account_id, token)
        ]);

        const campaignNamesById = new Map(insights.map((i) => [i.campaign_id, i.campaign_name]));

        const { campaignIdByMeta, adSetIdByMeta } = await upsertCampaignsAndAdSets(
          client,
          account.id,
          adSets,
          campaignNamesById
        );

        const inserted = await insertInsightSnapshots(client, account.id, insights, campaignIdByMeta, adSetIdByMeta);

        accountsSynced += 1;
        adSetsSynced += inserted;
      } catch (accountErr) {
        errors.push(`account ${account.meta_account_id}: ${(accountErr as Error).message}`);
      }
    }

    const status = errors.length === 0 ? 'success' : accountsSynced > 0 ? 'partial' : 'failed';
    await finishSyncRun(client, runId, {
      status,
      accounts_synced: accountsSynced,
      ad_sets_synced: adSetsSynced,
      error_message: errors.length > 0 ? errors.join('\n') : null
    });

    return new Response(JSON.stringify({ status, accountsSynced, adSetsSynced, errors }), {
      status: errors.length > 0 && accountsSynced === 0 ? 500 : 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (fatalErr) {
    await finishSyncRun(client, runId, {
      status: 'failed',
      accounts_synced: accountsSynced,
      ad_sets_synced: adSetsSynced,
      error_message: (fatalErr as Error).message
    });
    return new Response(JSON.stringify({ status: 'failed', error: (fatalErr as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
