// Thin client for the Tamsub ("ทำซับ") API — https://tamsub.com/developers
// Base URL https://api.tamsub.com, Bearer token auth, 4 synchronous multipart
// endpoints. Only 3 of the user's originally-requested 4 capabilities are
// covered (Tamsub has no sound-effect insertion) — confirmed with user,
// sound-effects explicitly deferred/skipped for this build.
//
// Response shape handling is defensive: Tamsub's docs describe synchronous
// endpoints but don't guarantee whether the body comes back as raw
// video/srt bytes or as JSON wrapping a result. We try JSON first (looking
// for common result-url/srt-text field names), and fall back to treating the
// body as the raw file if JSON parsing fails — this is Tamsub-version-proof
// either way.

export class TamsubError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TAMSUB_BASE = 'https://api.tamsub.com';

function mapHttpError(status: number, bodyText: string): TamsubError {
  switch (status) {
    case 401:
      return new TamsubError('TAMSUB_API_TOKEN ไม่ถูกต้องหรือหมดอายุ — ตรวจสอบใน tamsub.com/developers', status);
    case 403:
      return new TamsubError('บัญชี Tamsub ไม่มีสิทธิ์ใช้ฟีเจอร์นี้ (เช็คแพ็กเกจ/เครดิต)', status);
    case 413:
      return new TamsubError('ไฟล์วิดีโอใหญ่เกินกำหนดของ Tamsub', status);
    case 429:
      return new TamsubError('ใช้งาน Tamsub ถี่เกินไป (rate limit) — ลองใหม่อีกครั้งในอีกสักครู่', status);
    case 400:
      return new TamsubError(`คำขอไม่ถูกต้อง: ${bodyText.slice(0, 300)}`, status);
    case 500:
      return new TamsubError('Tamsub เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์ ลองใหม่อีกครั้ง', status);
    default:
      return new TamsubError(`Tamsub API error (${status}): ${bodyText.slice(0, 300)}`, status);
  }
}

export interface TamsubBinaryResult {
  kind: 'binary';
  buffer: Buffer;
  contentType: string;
  meta?: Record<string, unknown>;
}

export interface TamsubTextResult {
  kind: 'text';
  text: string;
  meta?: Record<string, unknown>;
}

export type TamsubResult = TamsubBinaryResult | TamsubTextResult;

async function callTamsub(
  endpoint: string,
  fileFieldName: string,
  fileBuffer: Buffer,
  filename: string,
  fields: Record<string, string>
): Promise<TamsubResult> {
  const token = process.env.TAMSUB_API_TOKEN;
  if (!token) {
    throw new TamsubError('TAMSUB_API_TOKEN ไม่ได้ตั้งค่าไว้บนเซิร์ฟเวอร์', 500);
  }

  const form = new FormData();
  // Field name matters — Tamsub's real API (confirmed against their live
  // /developers docs, 2026-08-19) expects "video" for renders/dewatermark/
  // silence-cut and "media" for /v1/subtitles, NOT a generic "file". Using
  // the wrong field name is indistinguishable from not uploading a video at
  // all from Tamsub's side — this was the actual cause of a real production
  // error: RENDER returned {"error":"pass \"srt\"/\"cues\" in payload, or
  // upload a video to auto-transcribe"} because Tamsub genuinely never saw
  // a video file (it was sitting under the wrong field name "file").
  form.append(fileFieldName, new Blob([new Uint8Array(fileBuffer)]), filename);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') form.append(key, value);
  }

  let res: Response;
  try {
    res = await fetch(`${TAMSUB_BASE}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(240000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new TamsubError('Tamsub ใช้เวลาประมวลผลนานเกินไป (timeout)', 504);
    }
    throw new TamsubError(err?.message || 'เชื่อมต่อ Tamsub ไม่สำเร็จ', 502);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw mapHttpError(res.status, bodyText);
  }

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json: any = await res.json();
    const resultUrl = json.result_url || json.url || json.video_url || json.download_url;
    const srtText = json.srt || json.srt_text || json.subtitles;
    if (typeof srtText === 'string') {
      return { kind: 'text', text: srtText, meta: json };
    }
    if (typeof resultUrl === 'string') {
      const fileRes = await fetch(resultUrl);
      if (!fileRes.ok || !fileRes.body) {
        throw new TamsubError('ดาวน์โหลดผลลัพธ์จาก Tamsub ไม่สำเร็จ', 502);
      }
      const buf = Buffer.from(await fileRes.arrayBuffer());
      return { kind: 'binary', buffer: buf, contentType: fileRes.headers.get('content-type') || 'video/mp4', meta: json };
    }
    // JSON came back but shape is unrecognized — surface it as an error rather
    // than silently mishandling it.
    throw new TamsubError('Tamsub ตอบกลับในรูปแบบที่ไม่รู้จัก', 502);
  }

  if (contentType.startsWith('text/') || contentType.includes('subrip')) {
    const text = await res.text();
    return { kind: 'text', text };
  }

  // Default: treat as raw binary file (video/mp4, etc.)
  const buf = Buffer.from(await res.arrayBuffer());
  return { kind: 'binary', buffer: buf, contentType: contentType || 'video/mp4' };
}

// Real /v1/silence-cut contract: field name "video", flat (non-JSON) form
// fields "thresholdPct" (1-90, % of the clip's peak loudness, default 20),
// "minGapSec" (0.1-2 seconds, default 0.1), "bridgeSec" (0-0.6, default 0).
// The previous version of this function sent "threshold_db"/"min_silence_ms"
// — field names Tamsub's real API doesn't recognize at all, so every
// silence-cut request was silently falling back to Tamsub's own defaults
// regardless of what the user configured.
export async function tamsubSilenceCut(
  fileBuffer: Buffer,
  filename: string,
  opts: { thresholdPct?: number; minGapSec?: number; bridgeSec?: number } = {}
): Promise<TamsubResult> {
  return callTamsub('/v1/silence-cut', 'video', fileBuffer, filename, {
    thresholdPct: opts.thresholdPct != null ? String(opts.thresholdPct) : '',
    minGapSec: opts.minGapSec != null ? String(opts.minGapSec) : '',
    bridgeSec: opts.bridgeSec != null ? String(opts.bridgeSec) : ''
  });
}

// Real /v1/renders contract: field name "video" for the clip, and every
// option (templateId, style, positionRegions, fps, maxWidth, source) goes
// inside ONE form field called "payload" holding a JSON *string* — not as
// individual flat form fields. There is no "language" parameter at all
// (Tamsub auto-transcribes Thai-aware speech server-side); the previous
// version sent flat "template"/"language" fields, which Tamsub's API
// ignores entirely, and — critically — used the wrong file field name
// ("file" instead of "video"), which is the actual root cause of the
// {"error":"pass \"srt\"/\"cues\" in payload, or upload a video to
// auto-transcribe"} error: Tamsub never received a video at all.
export async function tamsubRender(
  fileBuffer: Buffer,
  filename: string,
  opts: { templateId?: string; positionYPct?: number; useWalletCredit?: boolean } = {}
): Promise<TamsubResult> {
  const payload: Record<string, unknown> = {};
  if (opts.templateId) payload.templateId = opts.templateId;
  if (opts.positionYPct != null) payload.style = { positionY: Math.max(0, Math.min(1, opts.positionYPct / 100)) };
  if (opts.useWalletCredit) payload.source = 'wallet';

  return callTamsub('/v1/renders', 'video', fileBuffer, filename, {
    payload: Object.keys(payload).length > 0 ? JSON.stringify(payload) : ''
  });
}

// Real /v1/subtitles contract: field name "media" (not "file"), only other
// optional field is the flat "source" ("auto" | "wallet"). No "language"
// field — same auto-transcribe behavior as renders.
export async function tamsubSubtitlesSrt(
  fileBuffer: Buffer,
  filename: string,
  opts: { useWalletCredit?: boolean } = {}
): Promise<TamsubResult> {
  return callTamsub('/v1/subtitles', 'media', fileBuffer, filename, {
    source: opts.useWalletCredit ? 'wallet' : ''
  });
}

export async function tamsubDewatermark(fileBuffer: Buffer, filename: string): Promise<TamsubResult> {
  return callTamsub('/v1/dewatermark', 'video', fileBuffer, filename, {});
}
