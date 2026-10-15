// Pure helpers for the /ads accounts panel: turn what ads-sync recorded on an
// ad_accounts row (migration 0031) into badges and plain-Thai advice.
// No imports, so it is unit-tested in Node (tests/ads-accounts.test.cjs).

export type Tone = 'ok' | 'warn' | 'bad' | 'muted';

// 'act_123', ' 123 ' -> 'act_123'; anything else -> null.
export function normalizeActId(input: string): string | null {
  const match = input.trim().match(/^(?:act_)?(\d{5,20})$/i);
  return match ? `act_${match[1]}` : null;
}

// Meta's numeric account_status codes.
export function metaStatusInfo(code: number | null | undefined): { label: string; tone: Tone } {
  switch (code) {
    case 1:
      return { label: 'Active', tone: 'ok' };
    case 2:
      return { label: 'ถูก Meta ปิดใช้งาน', tone: 'bad' };
    case 3:
      return { label: 'ค้างชำระ (UNSETTLED)', tone: 'warn' };
    case 7:
      return { label: 'รอ Meta ตรวจความเสี่ยง', tone: 'warn' };
    case 8:
      return { label: 'รอชำระเงิน', tone: 'warn' };
    case 9:
      return { label: 'อยู่ในช่วงผ่อนผัน', tone: 'warn' };
    case 100:
      return { label: 'กำลังจะถูกปิด', tone: 'bad' };
    case 101:
      return { label: 'ปิดแล้ว (CLOSED)', tone: 'bad' };
    default:
      return { label: 'ยังไม่ทราบสถานะ', tone: 'muted' };
  }
}

export type ConnectionState = 'connected' | 'stale' | 'needs_permission' | 'token_invalid' | 'error' | 'not_synced' | 'off';

export interface ConnectionInput {
  status: string; // ad_accounts.status: active | paused | disabled
  last_sync_ok: boolean | null;
  last_error_code: number | null;
  last_sync_at: string | null;
}

// A sync normally lands every 15 minutes; three missed cycles = stale.
export const STALE_AFTER_MS = 45 * 60 * 1000;

export function connectionState(acc: ConnectionInput, now = Date.now()): ConnectionState {
  if (acc.status !== 'active') return 'off';
  if (acc.last_sync_ok === null || acc.last_sync_at === null) return 'not_synced';
  if (acc.last_sync_ok) {
    const age = now - Date.parse(acc.last_sync_at);
    return Number.isFinite(age) && age > STALE_AFTER_MS ? 'stale' : 'connected';
  }
  if (acc.last_error_code === 200 || acc.last_error_code === 10) return 'needs_permission';
  if (acc.last_error_code === 190) return 'token_invalid';
  return 'error';
}

export const CONNECTION_LABEL: Record<ConnectionState, { label: string; tone: Tone }> = {
  connected: { label: 'เชื่อมต่อแล้ว', tone: 'ok' },
  stale: { label: 'ข้อมูลเก่า', tone: 'warn' },
  needs_permission: { label: 'ต้องแก้สิทธิ์', tone: 'bad' },
  token_invalid: { label: 'Token ใช้ไม่ได้', tone: 'bad' },
  error: { label: 'ดึงข้อมูลไม่สำเร็จ', tone: 'bad' },
  not_synced: { label: 'รอ sync รอบแรก', tone: 'muted' },
  off: { label: 'ยังไม่เปิดใช้', tone: 'muted' }
};

// What the person should DO about a failed account. Meta error codes:
// 200/10 = permissions, 190 = token, 4/17/32/613 = rate limits, 100 = bad id/field.
export function errorAdvice(code: number | null, hasOwnTokenSecret: boolean): string | null {
  switch (code) {
    case 200:
    case 10:
      return hasOwnTokenSecret
        ? 'Token ของ Business Manager นี้ยังไม่มีสิทธิ์อ่านบัญชีนี้ — ให้เจ้าของบัญชีโฆษณากำหนดบัญชีนี้ให้ System User ตัวที่ใช้ token (สิทธิ์ ads_read ขึ้นไป)'
        : 'Token กลางยังเข้าบัญชีนี้ไม่ได้ — ให้เจ้าของบัญชีโฆษณาแชร์บัญชีให้ Business portfolio กลาง (กำหนดพาร์ทเนอร์) แล้วมอบสิทธิ์ให้ System User หรือใช้ token ของ portfolio เจ้าของบัญชีนี้';
    case 190:
      return 'Token หมดอายุหรือถูกเพิกถอน — สร้าง token ใหม่ของ System User แล้วอัปเดต secret';
    case 4:
    case 17:
    case 32:
    case 613:
      return 'ชนข้อจำกัดอัตราเรียกของ Meta ชั่วคราว — รอรอบ sync ถัดไป ไม่ต้องทำอะไร';
    case 100:
      return 'ไม่พบบัญชีนี้หรือเลข ID ไม่ถูกต้อง — ตรวจเลข act_… อีกครั้ง';
    case null:
    case undefined:
      return null;
    default:
      return `Meta ตอบ error code ${code} — ดูรายละเอียดข้อความด้านล่าง`;
  }
}
