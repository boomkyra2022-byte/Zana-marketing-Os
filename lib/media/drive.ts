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

export async function downloadDriveFile(
  fileId: string,
  destPath: string,
  opts: { maxBytes?: number } = {}
): Promise<{ mimeType: string | null; bytes: number }> {
  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT;
  let url = `https://drive.google.com/uc?export=download&id=${fileId}`;

  let res = await fetch(url, { redirect: 'follow' });
  if (res.status === 404) {
    throw new DriveImportError('ไม่พบไฟล์นี้ใน Google Drive — เช็คว่าลิงก์ถูกต้องและไฟล์ยังอยู่', 'invalid_link');
  }
  if (res.status === 403) {
    throw new DriveImportError('ไม่มีสิทธิ์เข้าถึงไฟล์นี้ — ตั้งค่าแชร์เป็น "Anyone with the link" แล้วลองใหม่', 'permission_denied');
  }

  const contentType = res.headers.get('content-type') ?? '';

  // Large files: Google serves an HTML "can't scan for viruses" confirm page instead of the file.
  if (contentType.includes('text/html')) {
    const html = await res.text();
    const token = extractConfirmToken(html);
    if (!token) {
      if (html.includes('accessDenied') || html.includes('ต้องขออนุญาต') || html.includes('permission')) {
        throw new DriveImportError('ไม่มีสิทธิ์เข้าถึงไฟล์นี้ — ตั้งค่าแชร์เป็น "Anyone with the link" แล้วลองใหม่', 'permission_denied');
      }
      throw new DriveImportError('ดาวน์โหลดไฟล์จาก Google Drive ไม่สำเร็จ — ลองตรวจสอบลิงก์อีกครั้ง', 'download_failed');
    }
    url = `https://drive.google.com/uc?export=download&confirm=${token}&id=${fileId}`;
    res = await fetch(url, { redirect: 'follow' });
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
