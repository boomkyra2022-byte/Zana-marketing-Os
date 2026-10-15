// ads-sync Edge Function — Phase 1 data pipe.
// Invoked every 15 min by pg_cron (see 0015_ads_cron_schedule.sql).
// For every active row in `ad_accounts`: pulls ad-set-level insights +
// ad-set metadata from the Meta Marketing API, upserts ad_campaigns/ad_sets,
// inserts a snapshot row per ad set into ad_set_insight_snapshots, and logs
// the run to ad_sync_runs.
//
// Per account it also records connection health on the ad_accounts row
// (last sync ok/error code, Meta's own account status, name, owner business —
// migration 0031) and, once per run, asks each token which ad accounts it can
// reach and registers unknown ones as paused ("discovered") so a person can
// enable them from /ads. Discovery never pulls data for an account by itself.
//
// Read-only against Meta — this function never writes back to Meta. Rules
// engine + actual pause/scale calls land in Phase 2.

import { fetchAccessibleAccounts, fetchAccountInfo, fetchAdSetInsights, fetchAdSets } from './meta.ts';
import {
  finishSyncRun,
  getActiveAdAccounts,
  getServiceClient,
  insertInsightSnapshots,
  recordAccountResult,
  resolveTokenForAccount,
  startSyncRun,
  upsertCampaignsAndAdSets,
  upsertDiscovered
} from './db.ts';
import { parseMetaError, type DiscoveredAccount } from './parse.ts';

const DEFAULT_TOKEN_KEY = '__default__';

Deno.serve(async (_req) => {
  const client = getServiceClient();
  const runId = await startSyncRun(client);

  let accountsSynced = 0;
  let adSetsSynced = 0;
  let discoveredInserted = 0;
  const errors: string[] = [];
  const discoveryErrors: string[] = [];
  // One discovery call per distinct token (accounts under the same Business
  // Manager share a token), keyed by the Vault secret name or the default.
  const tokensSeen = new Map<string, string>();

  try {
    const accounts = await getActiveAdAccounts(client);

    for (const account of accounts) {
      const checkedAt = new Date().toISOString();
      try {
        const token = await resolveTokenForAccount(client, account);
        tokensSeen.set(account.meta_token_secret_name ?? DEFAULT_TOKEN_KEY, token);

        // Cheapest permission probe first; a token without ads_read on this
        // account fails here (Meta error 200) and skips the heavier calls.
        // Account info is a nicety: only genuine access errors (permission /
        // invalid token) stop the account; anything else (e.g. a changed field
        // name) must not break the sync that was working before this existed.
        let info: DiscoveredAccount | undefined;
        try {
          info = await fetchAccountInfo(account.meta_account_id, token);
        } catch (infoErr) {
          const code = parseMetaError((infoErr as Error).message).code;
          if (code === 200 || code === 190 || code === 10) throw infoErr;
          console.error(`[ads-sync] account info unavailable for ${account.meta_account_id} (code ${code ?? 'n/a'}); syncing without it`);
        }

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

        await recordAccountResult(client, account.id, { ok: true, checkedAt, info });
        accountsSynced += 1;
        adSetsSynced += inserted;
      } catch (accountErr) {
        const message = (accountErr as Error).message;
        const parsed = parseMetaError(message);
        errors.push(`account ${account.meta_account_id}: ${message}`);
        await recordAccountResult(client, account.id, {
          ok: false,
          checkedAt,
          errorCode: parsed.code,
          errorText: parsed.text
        });
      }
    }

    // Discovery: failures here never affect the sync status.
    for (const [key, token] of tokensSeen) {
      try {
        const found = await fetchAccessibleAccounts(token);
        const result = await upsertDiscovered(client, found, key === DEFAULT_TOKEN_KEY ? null : key, new Date().toISOString());
        discoveredInserted += result.inserted;
      } catch (discoveryErr) {
        discoveryErrors.push(`discovery (${key}): ${parseMetaError((discoveryErr as Error).message).text}`);
      }
    }

    const status = errors.length === 0 ? 'success' : accountsSynced > 0 ? 'partial' : 'failed';
    const allMessages = [...errors, ...discoveryErrors];
    await finishSyncRun(client, runId, {
      status,
      accounts_synced: accountsSynced,
      ad_sets_synced: adSetsSynced,
      error_message: allMessages.length > 0 ? allMessages.join('\n') : null
    });

    return new Response(
      JSON.stringify({ status, accountsSynced, adSetsSynced, discoveredInserted, errors, discoveryErrors }),
      {
        status: errors.length > 0 && accountsSynced === 0 ? 500 : 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
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
