-- Ads Automation Bot — Phase 1 follow-up: per-account Meta tokens.
--
-- Discovered during setup: the tracked ad accounts span more than one
-- Business Manager, each with its own System User and access token — a
-- token from one BM cannot read another BM's ad accounts. The original
-- 0014 design assumed a single shared META_SYSTEM_USER_TOKEN, which only
-- covers accounts in one BM. This migration adds an optional per-account
-- override so each ad_accounts row can point at the Vault secret holding
-- the token for whichever BM it actually belongs to.
--
-- Accounts that don't set meta_token_secret_name keep using the single
-- META_SYSTEM_USER_TOKEN Edge Function secret (single-BM case still works
-- unchanged).

alter table ad_accounts add column if not exists meta_token_secret_name text;

comment on column ad_accounts.meta_token_secret_name is
  'Name of the Supabase Vault secret holding the Meta System User access token for this account''s Business Manager. NULL falls back to the META_SYSTEM_USER_TOKEN Edge Function env var.';

-- ============================================================
-- get_vault_secret: the ads-sync Edge Function talks to Postgres via
-- PostgREST, which does not expose the `vault` schema. This
-- security-definer function is a narrow, explicit bridge: given a secret
-- name, return its decrypted value. Execute is granted to service_role
-- only — the Edge Function is the only caller, using the service-role key.
-- ============================================================
create or replace function public.get_vault_secret(secret_name text)
returns text
language sql
security definer
set search_path = vault, public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;

revoke all on function public.get_vault_secret(text) from public;
revoke all on function public.get_vault_secret(text) from anon, authenticated;
grant execute on function public.get_vault_secret(text) to service_role;
