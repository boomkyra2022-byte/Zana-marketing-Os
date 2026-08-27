// Applies a triggered rule's action against Meta, gated by dry-run, and
// always logs the outcome to ad_rule_executions.
//
// Safety default: ADS_AUTOMATION_DRY_RUN is treated as true unless it is
// set to exactly "false" — an unset or misconfigured env var fails safe
// (log-only, no Meta call), per the Phase 2 spec.

import type { ServiceClient } from '../_shared/supabase-client.ts';
import { metaPost } from '../_shared/meta-client.ts';
import type { Rule, TargetAdSet } from './rules.ts';

const DRY_RUN = (Deno.env.get('ADS_AUTOMATION_DRY_RUN') ?? 'true').trim().toLowerCase() !== 'false';

export interface ExecutionLog {
  rule_id: string;
  ad_set_id: string;
  metric_value: number | null;
  dry_run: boolean;
  action_taken: string;
  budget_before: number | null;
  budget_after: number | null;
  status_before: string | null;
  status_after: string | null;
  success: boolean | null;
  error_message: string | null;
  reasoning: string;
}

export function buildReasoning(rule: Rule, latestValue: number | null, snapshotCount: number): string {
  return `Rule "${rule.name}" triggered: ${rule.metric} ${rule.operator} ${rule.threshold} held across all ${snapshotCount} snapshot(s) in the last ${rule.time_window_minutes} min (latest value: ${latestValue ?? 'n/a'}).`;
}

export async function applyAction(
  client: ServiceClient,
  rule: Rule,
  adSet: TargetAdSet,
  token: string,
  latestValue: number | null,
  snapshotCount: number
): Promise<ExecutionLog> {
  const reasoning = buildReasoning(rule, latestValue, snapshotCount);

  if (rule.action === 'scale_budget') {
    return executeBudgetChange(client, rule, adSet, token, latestValue, reasoning);
  }
  const newStatus = rule.action === 'pause' ? 'PAUSED' : 'ACTIVE';
  return executeStatusChange(client, rule, adSet, token, newStatus, latestValue, reasoning);
}

async function executeStatusChange(
  client: ServiceClient,
  rule: Rule,
  adSet: TargetAdSet,
  token: string,
  newStatus: 'PAUSED' | 'ACTIVE',
  latestValue: number | null,
  reasoning: string
): Promise<ExecutionLog> {
  const statusBefore = adSet.status;

  // No-op guard: ad set is already in the target state (e.g. two rules both
  // want it paused). Log it as a skipped dry-run so it's visible in the
  // audit trail without pretending an action happened.
  if (statusBefore === newStatus) {
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: true,
      action_taken: `${rule.action} (skipped: already ${newStatus})`,
      budget_before: null,
      budget_after: null,
      status_before: statusBefore,
      status_after: newStatus,
      success: null,
      error_message: null,
      reasoning
    };
  }

  if (DRY_RUN) {
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: true,
      action_taken: rule.action,
      budget_before: null,
      budget_after: null,
      status_before: statusBefore,
      status_after: newStatus,
      success: null,
      error_message: null,
      reasoning
    };
  }

  try {
    await metaPost(`/${adSet.meta_adset_id}`, { status: newStatus }, token);
    await client.from('ad_sets').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', adSet.id);
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: false,
      action_taken: rule.action,
      budget_before: null,
      budget_after: null,
      status_before: statusBefore,
      status_after: newStatus,
      success: true,
      error_message: null,
      reasoning
    };
  } catch (err) {
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: false,
      action_taken: rule.action,
      budget_before: null,
      budget_after: null,
      status_before: statusBefore,
      status_after: newStatus,
      success: false,
      error_message: (err as Error).message,
      reasoning
    };
  }
}

async function executeBudgetChange(
  client: ServiceClient,
  rule: Rule,
  adSet: TargetAdSet,
  token: string,
  latestValue: number | null,
  reasoning: string
): Promise<ExecutionLog> {
  const budgetBefore = adSet.daily_budget;

  if (budgetBefore === null || budgetBefore === undefined) {
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: true,
      action_taken: 'scale_budget (skipped: no current daily_budget known)',
      budget_before: null,
      budget_after: null,
      status_before: adSet.status,
      status_after: adSet.status,
      success: null,
      error_message: null,
      reasoning
    };
  }

  // Defensive re-clamp — the DB constraint already caps budget_change_percent
  // at ±20, but never trust a single layer for a money-moving action.
  const pct = Math.max(-20, Math.min(20, rule.budget_change_percent ?? 0));
  const budgetAfter = Math.round(budgetBefore * (1 + pct / 100) * 100) / 100;

  if (DRY_RUN) {
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: true,
      action_taken: 'scale_budget',
      budget_before: budgetBefore,
      budget_after: budgetAfter,
      status_before: adSet.status,
      status_after: adSet.status,
      success: null,
      error_message: null,
      reasoning
    };
  }

  try {
    // Meta budgets are in the currency's minor unit (matches the /100 used
    // when reading budgets in ads-sync's upsertCampaignsAndAdSets).
    const budgetMinorUnits = Math.round(budgetAfter * 100).toString();
    await metaPost(`/${adSet.meta_adset_id}`, { daily_budget: budgetMinorUnits }, token);
    await client.from('ad_sets').update({ daily_budget: budgetAfter, updated_at: new Date().toISOString() }).eq('id', adSet.id);
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: false,
      action_taken: 'scale_budget',
      budget_before: budgetBefore,
      budget_after: budgetAfter,
      status_before: adSet.status,
      status_after: adSet.status,
      success: true,
      error_message: null,
      reasoning
    };
  } catch (err) {
    return {
      rule_id: rule.id,
      ad_set_id: adSet.id,
      metric_value: latestValue,
      dry_run: false,
      action_taken: 'scale_budget',
      budget_before: budgetBefore,
      budget_after: budgetAfter,
      status_before: adSet.status,
      status_after: adSet.status,
      success: false,
      error_message: (err as Error).message,
      reasoning
    };
  }
}

export async function logExecution(client: ServiceClient, log: ExecutionLog): Promise<void> {
  const { error } = await client.from('ad_rule_executions').insert(log);
  if (error) throw new Error(`logExecution: ${error.message}`);
}
