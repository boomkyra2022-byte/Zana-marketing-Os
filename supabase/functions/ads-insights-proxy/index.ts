// ads-insights-proxy Edge Function — read-only Meta Graph API GET proxy for
// the Ads Intelligence page (app/(dashboard)/ads-intelligence).
//
// Why: the Meta System User token lives only as a Supabase secret
// (META_SYSTEM_USER_TOKEN, or a per-account Vault secret) for ads-sync /
// ads-rules-evaluator, and Supabase never lets anyone read a secret back.
// Rather than copying the token into .env.local / Vercel, the Next.js server
// sends the Graph URL it wants here, and this function adds the token.
//
// Safety:
// - Caller must present the project's service-role key (only the Next.js
//   server has it), so browsers / other users can't call this directly.
// - GET only, host must be graph.facebook.com, and the path must be the
//   account itself, its /insights edge, or the batch "/?ids=" lookup with a
//   `fields` param. Nothing that writes to Meta can pass through.
// - access_token supplied by the caller is stripped and replaced.

import { getServiceClient } from '../_shared/supabase-client.ts';
import { resolveTokenForAccount, type AdAccountRow } from '../_shared/accounts.ts';

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// The Supabase gateway verifies the JWT signature before this function runs
// (verify_jwt is on), so the claims can be trusted here: only a service-role
// JWT (held by the Next.js server alone) may use the proxy — the anon key and
// signed-in users' JWTs are rejected. Exact match on the injected key is kept
// as a fallback for projects on the newer non-JWT secret keys.
function isServiceRole(auth: string): boolean {
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  if (SERVICE_KEY && token === SERVICE_KEY) return true;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

function allowedPath(pathname: string, accountId: string, params: URLSearchParams): boolean {
  const m = pathname.match(/^\/v\d+\.\d+(\/.*)?$/);
  if (!m) return false;
  const rest = m[1] ?? '/';
  if (rest === `/${accountId}` || rest === `/${accountId}/insights`) return true;
  // Batch lookup of ad creatives: /?ids=1,2,3&fields=creative{...}
  if (rest === '/' && params.get('ids') && /^[0-9,]+$/.test(params.get('ids')!) && params.get('fields')?.startsWith('creative')) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!isServiceRole(req.headers.get('Authorization') ?? '')) return json({ error: 'unauthorized' }, 401);

  let body: { accountId?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const accountId = String(body.accountId ?? '');
  if (!/^act_\d{5,25}$/.test(accountId)) return json({ error: 'invalid accountId' }, 400);

  let target: URL;
  try {
    target = new URL(String(body.url ?? ''));
  } catch {
    return json({ error: 'invalid url' }, 400);
  }
  if (target.protocol !== 'https:' || target.hostname !== 'graph.facebook.com') return json({ error: 'host not allowed' }, 400);
  target.searchParams.delete('access_token');
  if (!allowedPath(target.pathname, accountId, target.searchParams)) return json({ error: 'path not allowed' }, 400);

  const client = getServiceClient();
  const { data: row } = await client
    .from('ad_accounts')
    .select('id, meta_account_id, status, meta_token_secret_name')
    .eq('meta_account_id', accountId)
    .maybeSingle();
  const account: AdAccountRow = row ?? { id: '', meta_account_id: accountId, status: 'active', meta_token_secret_name: null };

  let token: string;
  try {
    token = await resolveTokenForAccount(client, account);
  } catch (e) {
    return json({ error: { message: `no Meta token available: ${(e as Error).message}`, code: 'NO_TOKEN' } }, 500);
  }
  target.searchParams.set('access_token', token);

  const res = await fetch(target.toString(), { method: 'GET' });
  const text = await res.text();
  // Meta's paging.next URLs embed the token — strip it before returning so
  // the token never leaves this function.
  const safe = text.replace(/access_token=[^&"\\]+/g, 'access_token=REDACTED');
  return new Response(safe, { status: res.status, headers: { 'Content-Type': 'application/json' } });
});
