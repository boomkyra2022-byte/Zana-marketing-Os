// ads-rules-evaluator Edge Function — Phase 2 rules engine.
// Invoked every 15 min by pg_cron, offset 5 min after ads-sync (see
// 0018_ads_rules_cron_schedule.sql) so it evaluates against a snapshot that
// just landed.
//
// For every enabled rule: find the ad sets it applies to, check whether the
// metric condition held across every snapshot in the trailing time window,
// skip if in cooldown, then apply the action (pause/activate/scale_budget).
// Every trigger is logged to ad_rule_executions regardless of dry-run.
//
// Safety: ADS_AUTOMATION_DRY_RUN defaults to true (log-only) — see actions.ts.

import { getServiceClient } from '../_shared/supabase-client.ts';
import { getAdAccountById, resolveTokenForAccount } from '../_shared/accounts.ts';
import { evaluateCondition, getEnabledRules, getTargetAdSets, isInCooldown } from './rules.ts';
import { applyAction, logExecution } from './actions.ts';

Deno.serve(async (_req) => {
  const client = getServiceClient();

  let rulesEvaluated = 0;
  let actionsTriggered = 0;
  const errors: string[] = [];

  try {
    const rules = await getEnabledRules(client);

    for (const rule of rules) {
      rulesEvaluated += 1;
      try {
        const adSets = await getTargetAdSets(client, rule);

        for (const adSet of adSets) {
          try {
            // Only evaluate ad sets whose current status makes the action
            // meaningful (no point pausing an already-paused ad set, etc).
            if (rule.action === 'pause' && adSet.status !== 'ACTIVE') continue;
            if (rule.action === 'activate' && adSet.status !== 'PAUSED') continue;
            if (rule.action === 'scale_budget' && adSet.status !== 'ACTIVE') continue;

            const { triggered, latestValue, snapshotCount } = await evaluateCondition(client, rule, adSet);
            if (!triggered) continue;

            if (await isInCooldown(client, rule, adSet.id)) continue;

            const account = await getAdAccountById(client, adSet.ad_account_id);
            if (!account) throw new Error(`ad_account ${adSet.ad_account_id} not found`);
            const token = await resolveTokenForAccount(client, account);

            const log = await applyAction(client, rule, adSet, token, latestValue, snapshotCount);
            await logExecution(client, log);
            actionsTriggered += 1;
          } catch (adSetErr) {
            errors.push(`rule "${rule.name}" / ad_set ${adSet.meta_adset_id}: ${(adSetErr as Error).message}`);
          }
        }
      } catch (ruleErr) {
        errors.push(`rule "${rule.name}": ${(ruleErr as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ rulesEvaluated, actionsTriggered, errors }), {
      status: errors.length > 0 && actionsTriggered === 0 && rulesEvaluated === 0 ? 500 : 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (fatalErr) {
    return new Response(JSON.stringify({ error: (fatalErr as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
