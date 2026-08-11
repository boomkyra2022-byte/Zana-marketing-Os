// Google Drive public/shared-link import — V1 scope per MASTER_PROMPT_V2
// "Google Drive Import": no OAuth/Drive API, just the public download endpoint.
// Errors must be readable Thai (permission denied / invalid link / too large /
// unsupported format / download failed).

import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export class DriveImportError extends Error {
  stage: string;
  constructor(message: string, stage = 'download') {
    super(message);
    this.stage = stage;
  }
}

const DRIVE_ID_PATTERNS = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];

export function extractDriveFileId(url: string): string {
  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  throw new DriveImportError('ลิงก์ Google Drive ไม่ถูกต้อง — กรุณาวางลิงก์แบบ "Anyone with the link" ของไฟล์วิดีโอ', 'invalid_link');
}

const ALLOWED_MIME_PREFIXES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const MAX_BYTES_DEFAULT = 300 * 1024 * 1024; // 300MB

function extractConfirmToken(html: string): string | null {
  const m1 = html.match(/confirm=([0-9A-Za-z_-]+)/);
  if (m1?.[1]) return m1[1];
  const m2 = html.match(/name="confirm"\s+value="([0-9A-Za-z_-]+)"/);
  return m2?.[1] ?? null;
}

// Google's newer large-file "can't scan for viruses" interstitial embeds a
// per-request uuid that the actual download must be replayed with against
// drive.usercontent.google.com — the older uc?export=download&confirm=TOKEN
// form alone increasingly just loops back to the same interstitial.
function extractUuid(html: string): string | null {
  const m = html.match(/name="uuid"\s+value="([0-9A-Za-z_-]+)"/);
  return m?.[1] ?? null;
}

// The interstitial page also sets a cookie that Google checks on the
// follow-up confirm request — without forwarding it, Drive can serve the
// warning page again indefinitely even with a valid confirm token/uuid.
function readSetCookies(res: Response): string[] {
  const getSetCookie = (res.headers as any).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(res.headers);
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function mergeCookies(existing: string | undefined, res: Response): string | undefined {
  const fresh = readSetCookies(res).map((c) => c.split(';')[0]);
  if (fresh.length === 0) return existing;
  return [existing, ...fresh].filter(Boolean).join('; ');
}

export async function downloadDriveFile(
  fileId: string,
  destPath: string,
  opts: { maxBytes?: number } = {}
): Promise<{ mimeType: string | null; bytes: number }> {
  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT;
  let url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  let cookieHeader: string | undefined;

  let res = await fetch(url, { redirect: 'follow' });
  if (res.status === 404) {
    throw new DriveImportError('ไม่พบไฟล์นี้ใน Google Drive — เช็คว่าลิงก์ถูกต้องและไฟล์ยังอยู่', 'invalid_link');
  }
  if (res.status === 403) {
    throw new DriveImportError('ไม่มีสิทธิ์เข้าถึงไฟล์นี้ — ตั้งค่าแชร์เป็น "Anyone with the link" แล้วลองใหม่', 'permission_denied');
  }
  cookieHeader = mergeCookies(cookieHeader, res);

  let contentType = res.headers.get('content-type') ?? '';

  // Large files: Google serves an HTML "can't scan for viruses" confirm page
  // instead of the file. Try up to 2 bypass attempts (uuid-based
  // usercontent.google.com flow, then a direct confirm=t fallback) since
  // Google has changed this flow's exact shape more than once.
  let attempts = 0;
  while (contentType.includes('text/html') && attempts < 2) {
    attempts += 1;
    const html = await res.text();
    const uuid = extractUuid(html);
    const token = extractConfirmToken(html);

    if (uuid) {
      url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuid}`;
    } else if (token) {
      url = `https://drive.google.com/uc?export=download&confirm=${token}&id=${fileId}`;
    } else if (attempts === 1) {
      if (html.includes('accessDenied') || html.includes('ต้องขออนุญาต') || html.includes('permission')) {
        throw new DriveImportError('ไม่มีสิทธิ์เข้าถึงไฟล์นี้ — ตั้งค่าแชร์เป็น "Anyone with the link" แล้วลองใหม่', 'permission_denied');
      }
      // Last-resort bypass attempt even with no token/uuid found.
      url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
    } else {
      throw new DriveImportError(
        'ไฟล์นี้อาจใหญ่เกินกว่า Google Drive จะให้ดาวน์โหลดสาธารณะได้ (ติด virus-scan warning) — ลองลดขนาดไฟล์ หรืออัปโหลดไปที่ storage อื่นที่มีลิงก์ดาวน์โหลดตรง',
        'download_failed'
      );
    }

    res = await fetch(url, { redirect: 'follow', headers: cookieHeader ? { Cookie: cookieHeader } : undefined });
    cookieHeader = mergeCookies(cookieHeader, res);
    contentType = res.headers.get('content-type') ?? '';
  }

  if (!res.ok || !res.body) {
    throw new DriveImportError(`ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP ${res.status})`, 'download_failed');
  }

  const finalContentType = res.headers.get('content-type') ?? contentType;
  const isAllowedType = ALLOWED_MIME_PREFIXES.some((p) => finalContentType.startsWith(p)) || finalContentType === 'application/octet-stream';
  if (!isAllowedType) {
    throw new DriveImportError(`ไม่รองรับไฟล์ประเภทนี้ (${finalContentType || 'ไม่ทราบชนิด'}) — รองรับเฉพาะ MP4 / MOV / WEBM`, 'unsupported_format');
  }

  const declaredLength = Number(res.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    throw new DriveImportError(`ไฟล์ใหญ่เกินกำหนด (${(declaredLength / 1024 / 1024).toFixed(0)}MB) — จำกัดไว้ที่ ${(maxBytes / 1024 / 1024).toFixed(0)}MB`, 'file_too_large');
  }

  let written = 0;
  const fileStream = fs.createWriteStream(destPath);
  const nodeReadable = Readable.fromWeb(res.body as any);
  nodeReadable.on('data', (chunk: Buffer) => {
    written += chunk.length;
    if (written > maxBytes) {
      nodeReadable.destroy(new DriveImportError(`ไฟล์ใหญ่เกินกำหนด — จำกัดไว้ที่ ${(maxBytes / 1024 / 1024).toFixed(0)}MB`, 'file_too_large'));
    }
  });

  try {
    await pipeline(nodeReadable, fileStream);
  } catch (err) {
    try {
      fs.unlinkSync(destPath);
    } catch {
      /* ignore cleanup error */
    }
    if (err instanceof DriveImportError) throw err;
    throw new DriveImportError('ดาวน์โหลดไฟล์ไม่สำเร็จระหว่างทาง กรุณาลองใหม่', 'download_failed');
  }

  return { mimeType: finalContentType || null, bytes: written };
}
