// Rule matching + condition evaluation for the ads-rules-evaluator Edge
// Function.

import type { ServiceClient } from '../_shared/supabase-client.ts';

export type Metric = 'roas' | 'cpa' | 'spend' | 'frequency' | 'ctr' | 'cpc';
export type Operator = '<' | '<=' | '>' | '>=' | '=';
export type RuleAction = 'pause' | 'activate' | 'scale_budget';

export interface Rule {
  id: string;
  name: string;
  ad_account_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  metric: Metric;
  operator: Operator;
  threshold: number;
  time_window_minutes: number;
  action: RuleAction;
  budget_change_percent: number | null;
  cooldown_hours: number;
  enabled: boolean;
  priority: number;
}

export interface TargetAdSet {
  id: string;
  meta_adset_id: string;
  campaign_id: string;
  ad_account_id: string;
  status: string;
  daily_budget: number | null;
}

export async function getEnabledRules(client: ServiceClient): Promise<Rule[]> {
  const { data, error } = await client
    .from('ad_automation_rules')
    .select(
      'id, name, ad_account_id, campaign_id, ad_set_id, metric, operator, threshold, time_window_minutes, action, budget_change_percent, cooldown_hours, enabled, priority'
    )
    .eq('enabled', true)
    .order('priority', { ascending: true });
  if (error) throw new Error(`getEnabledRules: ${error.message}`);
  return data ?? [];
}

// Narrowest non-null scope on the rule wins: a specific ad_set beats a
// campaign beats an account beats "every ad set" (all scope columns null).
export async function getTargetAdSets(client: ServiceClient, rule: Rule): Promise<TargetAdSet[]> {
  let query = client.from('ad_sets').select('id, meta_adset_id, campaign_id, ad_account_id, status, daily_budget');

  if (rule.ad_set_id) {
    query = query.eq('id', rule.ad_set_id);
  } else if (rule.campaign_id) {
    query = query.eq('campaign_id', rule.campaign_id);
  } else if (rule.ad_account_id) {
    query = query.eq('ad_account_id', rule.ad_account_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getTargetAdSets rule ${rule.id}: ${error.message}`);
  return data ?? [];
}

const METRIC_COLUMN: Record<Metric, string> = {
  roas: 'roas',
  cpa: 'cpa',
  spend: 'spend',
  frequency: 'frequency',
  ctr: 'ctr',
  cpc: 'cpc'
};

function compare(value: number, operator: Operator, threshold: number): boolean {
  switch (operator) {
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '=':
      return value === threshold;
  }
}

export interface ConditionResult {
  triggered: boolean;
  latestValue: number | null;
  snapshotCount: number;
}

// A rule only triggers when EVERY snapshot captured within time_window_minutes
// satisfies the condition — guards against acting on one noisy data point.
// Requires at least 2 snapshots in the window (insufficient data = no trigger).
// A null metric value anywhere in the window (e.g. roas/cpa when spend or
// purchases is zero) also blocks the trigger, since we can't confirm the
// condition held for the whole window.
export async function evaluateCondition(client: ServiceClient, rule: Rule, adSet: TargetAdSet): Promise<ConditionResult> {
  const column = METRIC_COLUMN[rule.metric];
  const since = new Date(Date.now() - rule.time_window_minutes * 60_000).toISOString();

  const { data, error } = await client
    .from('ad_set_insight_snapshots')
    .select(`captured_at, ${column}`)
    .eq('ad_set_id', adSet.id)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });
  if (error) throw new Error(`evaluateCondition rule ${rule.id} ad_set ${adSet.id}: ${error.message}`);

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length < 2) {
    return { triggered: false, latestValue: null, snapshotCount: rows.length };
  }

  const values = rows.map((row) => row[column]);
  if (values.some((v) => v === null || v === undefined)) {
    const lastNonNull = [...values].reverse().find((v) => v !== null && v !== undefined);
    return { triggered: false, latestValue: (lastNonNull as number) ?? null, snapshotCount: rows.length };
  }

  const numericValues = values as number[];
  const allSatisfy = numericValues.every((v) => compare(v, rule.operator, rule.threshold));
  return { triggered: allSatisfy, latestValue: numericValues[numericValues.length - 1], snapshotCount: rows.length };
}

// Skip if this exact (rule, ad_set) pair fired within its cooldown window.
export async function isInCooldown(client: ServiceClient, rule: Rule, adSetId: string): Promise<boolean> {
  const { data, error } = await client
    .from('ad_rule_executions')
    .select('triggered_at')
    .eq('rule_id', rule.id)
    .eq('ad_set_id', adSetId)
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`isInCooldown rule ${rule.id} ad_set ${adSetId}: ${error.message}`);
  if (!data) return false;

  const cooldownMs = rule.cooldown_hours * 60 * 60 * 1000;
  return Date.now() - new Date(data.triggered_at as string).getTime() < cooldownMs;
}
