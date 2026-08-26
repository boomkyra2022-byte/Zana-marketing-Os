-- Ads Automation Bot — Phase 1: data pipe (Meta Marketing API ad-set-level
-- insight snapshots). ADDITIVE ONLY — no drops, no renames, mirrors the
-- convention set in 0001_init.sql / 0003_v2_schema.sql.
--
-- Naming note: V1 already has `campaigns` / `ad_creatives` / `performance_daily`
-- tables for organic/creative-content tracking (see 0003_v2_schema.sql). Those
-- are a different concept and are left untouched. This migration uses the
-- `ad_` prefix (ad_accounts / ad_campaigns / ad_sets / ad_set_insight_snapshots)
-- to avoid any collision with those V1 tables.

-- ============================================================
-- ad_accounts: Meta ad accounts tracked by the bot (multi-account)
-- ============================================================
create table if not exists ad_accounts (
  id uuid primary key default uuid_generate_v4(),
  meta_account_id text not null unique, -- e.g. 'act_1234567890'
  name text not null,
  currency text,
  timezone_name text,
  business_id text,
  status text not null default 'active' check (status in ('active', 'paused', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ad_campaigns: Meta campaigns, one per ad_account
-- ============================================================
create table if not exists ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  meta_campaign_id text not null unique,
  name text not null,
  objective text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ad_campaigns_account on ad_campaigns(ad_account_id);

-- ============================================================
-- ad_sets: Meta ad sets, one per ad_campaign
-- ============================================================
create table if not exists ad_sets (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  ad_account_id uuid not null references ad_accounts(id) on delete cascade, -- denormalized for fast cross-account queries
  meta_adset_id text not null unique,
  name text not null,
  status text,
  daily_budget numeric(14,2),
  lifetime_budget numeric(14,2),
  bid_strategy text,
  optimization_goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ad_sets_campaign on ad_sets(campaign_id);
create index if not exists idx_ad_sets_account on ad_sets(ad_account_id);

-- ============================================================
-- ad_set_insight_snapshots: the core metrics table.
-- One row per ad set per sync run (every 15-30 min via ads-sync Edge Function).
-- `raw` keeps the full Meta insights object so new metrics can be read later
-- without a schema migration.
-- ============================================================
create table if not exists ad_set_insight_snapshots (
  id uuid primary key default uuid_generate_v4(),
  ad_account_id uuid not null references ad_accounts(id) on delete cascade,
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  ad_set_id uuid not null references ad_sets(id) on delete cascade,
  captured_at timestamptz not null default now(),
  date_start date,
  date_stop date,
  spend numeric(14,2),
  impressions bigint,
  clicks bigint,
  reach bigint,
  frequency numeric(8,4),
  ctr numeric(8,4),
  cpc numeric(14,4),
  cpm numeric(14,4),
  purchases integer,
  purchase_value numeric(14,2),
  roas numeric(10,4),
  cpa numeric(14,4),
  result_type text,
  results integer,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_insight_snap_adset_time on ad_set_insight_snapshots(ad_set_id, captured_at desc);
create index if not exists idx_insight_snap_account_time on ad_set_insight_snapshots(ad_account_id, captured_at desc);
create index if not exists idx_insight_snap_campaign_time on ad_set_insight_snapshots(campaign_id, captured_at desc);

-- ============================================================
-- ad_sync_runs: observability log, one row per ads-sync Edge Function run
-- ============================================================
create table if not exists ad_sync_runs (
  id uuid primary key default uuid_generate_v4(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  accounts_synced integer default 0,
  ad_sets_synced integer default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ad_sync_runs_started on ad_sync_runs(started_at desc);

-- ============================================================
-- RLS: read-only for the app. All writes come from the ads-sync Edge
-- Function using the service-role key, which bypasses RLS entirely — so
-- no insert/update/delete policy is defined for any authenticated role.
-- ============================================================
alter table ad_accounts enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_sets enable row level security;
alter table ad_set_insight_snapshots enable row level security;
alter table ad_sync_runs enable row level security;

create policy "ad_accounts_select" on ad_accounts for select using (auth.role() = 'authenticated');
create policy "ad_campaigns_select" on ad_campaigns for select using (auth.role() = 'authenticated');
create policy "ad_sets_select" on ad_sets for select using (auth.role() = 'authenticated');
create policy "ad_set_insight_snapshots_select" on ad_set_insight_snapshots for select using (auth.role() = 'authenticated');
create policy "ad_sync_runs_select" on ad_sync_runs for select using (auth.role() = 'authenticated');

-- admin/owner/media_buyer may register or retire ad accounts to track
-- (this is account registration only — not a Meta API write, just which
-- accounts the sync job should poll).
create policy "ad_accounts_write" on ad_accounts for insert with check (public.current_role() in ('admin', 'owner', 'media_buyer'));
create policy "ad_accounts_update" on ad_accounts for update using (public.current_role() in ('admin', 'owner', 'media_buyer'));
