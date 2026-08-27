// Thin Meta Marketing API HTTP client — GET (read) and POST (write) — shared
// by ads-sync (Phase 1, read-only) and ads-rules-evaluator (Phase 2, writes
// pause/activate/scale_budget actions).
//
// Every call takes the token explicitly rather than reading a global env
// var, because different ad accounts can belong to different Business
// Managers with different System User tokens (see accounts.ts).

const META_API_VERSION = Deno.env.get('META_API_VERSION') ?? 'v21.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export async function metaGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API error ${res.status} on GET ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function metaPost<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const body = new URLSearchParams({ ...params, access_token: token });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`Meta API error ${res.status} on POST ${path}: ${responseBody}`);
  }
  return res.json() as Promise<T>;
}

export function sumActionValue(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  if (!actions) return 0;
  const match = actions.find((a) => a.action_type === type);
  return match ? Number(match.value) : 0;
}
