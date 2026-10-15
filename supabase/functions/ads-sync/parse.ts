// Pure helpers for ads-sync — no Deno globals and no imports, so they can be
// unit-tested in Node (tests/ads-sync.test.cjs).

export interface ParsedMetaError {
  /** Meta's own error code (e.g. 200 permissions, 190 token), NOT the HTTP status. */
  code: number | null;
  subcode: number | null;
  /** Human-readable message with URLs removed, capped at 300 chars. */
  text: string;
}

// metaGet/metaPost throw `Meta API error <http> on GET <path>: <json body>`.
export function parseMetaError(message: string): ParsedMetaError {
  let code: number | null = null;
  let subcode: number | null = null;
  let text = message;

  const start = message.indexOf('{');
  if (start >= 0) {
    try {
      const body = JSON.parse(message.slice(start));
      const err = body && typeof body === 'object' ? (body.error ?? body) : null;
      if (err && typeof err.code === 'number') code = err.code;
      if (err && typeof err.error_subcode === 'number') subcode = err.error_subcode;
      if (err && typeof err.message === 'string') text = err.message;
    } catch {
      /* keep the raw message */
    }
  }

  text = text.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return { code, subcode, text };
}

// 'act_123', ' 123 ', 'ACT_123' -> 'act_123'; anything else -> null.
export function normalizeActId(input: string): string | null {
  const match = input.trim().match(/^(?:act_)?(\d{5,20})$/i);
  return match ? `act_${match[1]}` : null;
}

export interface DiscoveredAccount {
  id: string; // act_...
  name: string | null;
  account_status: number | null;
  currency: string | null;
  timezone_name: string | null;
  business_id: string | null;
  business_name: string | null;
}

// Shapes one element of Meta's GET /me/adaccounts `data` array. Returns null
// for entries without a usable id so one odd row can't break discovery.
export function toDiscovered(raw: unknown): DiscoveredAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? normalizeActId(r.id) : null;
  if (!id) return null;
  const business = r.business && typeof r.business === 'object' ? (r.business as Record<string, unknown>) : null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  return {
    id,
    name: str(r.name),
    account_status: typeof r.account_status === 'number' ? r.account_status : null,
    currency: str(r.currency),
    timezone_name: str(r.timezone_name),
    business_id: business ? str(business.id) : null,
    business_name: business ? str(business.name) : null
  };
}
