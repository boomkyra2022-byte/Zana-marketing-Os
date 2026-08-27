-- Ads Automation Bot — Phase 2: rules engine.
-- ADDITIVE ONLY, same convention as 0014.
--
-- ad_automation_rules: conditions to watch (metric/operator/threshold over a
-- time window) and the action to take when they hold. ad_rule_executions:
-- audit log of every rule evaluation that triggered — dry-run or real.

-- ============================================================
-- ad_automation_rules
-- ============================================================
create table if not exists ad_automation_rules (
  id uuid primary key default uuid_generate_v4(),
  name text not null,

  -- Scope: narrowest non-null wins. All null = applies to every ad set.
  ad_account_id uuid references ad_accounts(id) on delete cascade,
  campaign_id uuid references ad_campaigns(id) on delete cascade,
  ad_set_id uuid references ad_sets(id) on delete cascade,

  metric text not null check (metric in ('roas', 'cpa', 'spend', 'frequency', 'ctr', 'cpc')),
  operator text not null check (operator in ('<', '<=', '>', '>=', '=')),
  threshold numeric not null,

  -- All snapshots captured within this trailing window must satisfy the
  -- condition before the rule triggers (guards against acting on one noisy
  -- data point) — see ads-rules-evaluator/rules.ts.
  time_window_minutes integer not null default 60 check (time_window_minutes > 0),

  action text not null check (action in ('pause', 'activate', 'scale_budget')),

  -- Required for action='scale_budget'. Capped at ±20% per run per the
  -- Phase 2 safety spec — enforced here at the schema level, not just in code.
  budget_change_percent numeric check (budget_change_percent between -20 and 20),
  constraint scale_budget_requires_percent check (
    (action = 'scale_budget' and budget_change_percent is not null)
    or (action <> 'scale_budget')
  ),

  cooldown_hours numeric not null default 6 check (cooldown_hours >= 0),
  enabled boolean not null default true,
  priority integer not null default 100,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ad_rules_enabled on ad_automation_rules(enabled) where enabled;
create index if not exists idx_ad_rules_ad_set on ad_automation_rules(ad_set_id);
create index if not exists idx_ad_rules_campaign on ad_automation_rules(campaign_id);
create index if not exists idx_ad_rules_account on ad_automation_rules(ad_account_id);

-- ============================================================
-- ad_rule_executions: audit log. Every rule evaluation that satisfies its
-- condition writes a row here, whether or not it actually called Meta
-- (dry_run=true means logged only, no API call made).
-- ============================================================
create table if not exists ad_rule_executions (
  id uuid primary key default uuid_generate_v4(),
  rule_id uuid not null references ad_automation_rules(id) on delete cascade,
  ad_set_id uuid not null references ad_sets(id) on delete cascade,
  triggered_at timestamptz not null default now(),

  metric_value numeric,
  dry_run boolean not null,
  action_taken text not null,

  budget_before numeric,
  budget_after numeric,
  status_before text,
  status_after text,

  success boolean, -- null when dry_run
  error_message text,
  reasoning text not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_rule_exec_rule_adset_time on ad_rule_executions(rule_id, ad_set_id, triggered_at desc);
create index if not exists idx_rule_exec_time on ad_rule_executions(triggered_at desc);

-- ============================================================
-- RLS
-- ============================================================
alter table ad_automation_rules enable row level security;
alter table ad_rule_executions enable row level security;

create policy "ad_automation_rules_select" on ad_automation_rules for select using (auth.role() = 'authenticated');
create policy "ad_automation_rules_write" on ad_automation_rules for insert with check (public.current_role() in ('admin', 'owner', 'media_buyer'));
create policy "ad_automation_rules_update" on ad_automation_rules for update using (public.current_role() in ('admin', 'owner', 'media_buyer'));
create policy "ad_automation_rules_delete" on ad_automation_rules for delete using (public.current_role() in ('admin', 'owner'));

-- Audit log: read-only for the app. All writes come from the
-- ads-rules-evaluator Edge Function via the service-role key.
create policy "ad_rule_executions_select" on ad_rule_executions for select using (auth.role() = 'authenticated');
