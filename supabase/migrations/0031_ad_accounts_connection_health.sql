-- Ads Automation: per-account connection health + Meta-reported account status.
-- ADDITIVE ONLY (new nullable/defaulted columns). Existing rows and the
-- ads-sync cron keep working unchanged.
--
-- Why: ads-sync only recorded one aggregated error string per run, so the UI
-- could not say WHICH account is connected, which one lacks permission (Meta
-- error 200) and which one Meta itself reports as unpaid/closed. It also
-- never learned about accounts the token can reach but nobody registered yet.
--
-- meta_account_status uses Meta's numeric codes:
--   1 ACTIVE, 2 DISABLED, 3 UNSETTLED (unpaid balance), 7 PENDING_RISK_REVIEW,
--   8 PENDING_SETTLEMENT, 9 IN_GRACE_PERIOD, 100 PENDING_CLOSURE, 101 CLOSED
begin;

alter table ad_accounts
  add column if not exists meta_name text,
  add column if not exists meta_account_status integer,
  add column if not exists business_name text,
  add column if not exists source text not null default 'manual',
  add column if not exists meta_checked_at timestamptz,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_ok_at timestamptz,
  add column if not exists last_sync_ok boolean,
  add column if not exists last_error_code integer,
  add column if not exists last_error_text text;

alter table ad_accounts drop constraint if exists ad_accounts_source_check;
alter table ad_accounts add constraint ad_accounts_source_check check (source in ('manual', 'discovered'));

comment on column ad_accounts.source is
  'manual = registered by a person; discovered = found by ads-sync via /me/adaccounts, created as status=paused until someone enables it.';
comment on column ad_accounts.last_error_code is
  'Meta error code from the last failed sync (e.g. 200 = no ads_read permission on this account for the token used, 190 = invalid token). NULL when the last sync succeeded.';

commit;
