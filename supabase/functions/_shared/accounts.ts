// Ad account lookups + per-account Meta token resolution.
// Shared by ads-sync (Phase 1) and ads-rules-evaluator (Phase 2) — both need
// to know which ad accounts to work with and which Meta token authorizes
// calls for each one.

import type { ServiceClient } from './supabase-client.ts';

const DEFAULT_META_TOKEN = Deno.env.get('META_SYSTEM_USER_TOKEN');

export interface AdAccountRow {
  id: string;
  meta_account_id: string;
  status: string;
  meta_token_secret_name: string | null;
}

export async function getActiveAdAccounts(client: ServiceClient): Promise<AdAccountRow[]> {
  const { data, error } = await client
    .from('ad_accounts')
    .select('id, meta_account_id, status, meta_token_secret_name')
    .eq('status', 'active');
  if (error) throw new Error(`getActiveAdAccounts: ${error.message}`);
  return data ?? [];
}

export async function getAdAccountById(client: ServiceClient, id: string): Promise<AdAccountRow | null> {
  const { data, error } = await client
    .from('ad_accounts')
    .select('id, meta_account_id, status, meta_token_secret_name')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getAdAccountById ${id}: ${error.message}`);
  return data ?? null;
}

// Ad accounts can live under different Business Managers, each with its own
// System User token. If the account row names a Vault secret, resolve the
// token from there (via the get_vault_secret() RPC — PostgREST doesn't
// expose the vault schema directly). Otherwise fall back to the single
// META_SYSTEM_USER_TOKEN env var for the common single-BM case.
export async function resolveTokenForAccount(client: ServiceClient, account: AdAccountRow): Promise<string> {
  if (account.meta_token_secret_name) {
    const { data, error } = await client.rpc('get_vault_secret', { secret_name: account.meta_token_secret_name });
    if (error) throw new Error(`resolveTokenForAccount ${account.meta_account_id}: ${error.message}`);
    if (!data) {
      throw new Error(`resolveTokenForAccount ${account.meta_account_id}: no secret named '${account.meta_token_secret_name}' in Vault`);
    }
    return data as string;
  }
  if (!DEFAULT_META_TOKEN) {
    throw new Error(
      `resolveTokenForAccount ${account.meta_account_id}: no meta_token_secret_name set and META_SYSTEM_USER_TOKEN env var is empty`
    );
  }
  return DEFAULT_META_TOKEN;
}
