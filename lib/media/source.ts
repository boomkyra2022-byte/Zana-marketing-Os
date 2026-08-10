// Generalized source-video downloader for tools that accept either a Google
// Drive share link OR a plain HTTPS URL (e.g. a signed Supabase Storage URL
// from a previous Editor step — this is what makes result-chaining possible:
// operation A's output URL can be pasted straight back in as operation B's
// source_url). Wraps the existing, proven Drive logic in lib/media/drive.ts
// unchanged; adds a parallel direct-URL path with the same size/type guards.

import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { extractDriveFileId, downloadDriveFile, DriveImportError } from './drive';

export class SourceImportError extends Error {
  stage: string;
  constructor(message: string, stage = 'download') {
    super(message);
    this.stage = stage;
  }
}

const ALLOWED_MIME_PREFIXES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const MAX_BYTES_DEFAULT = 300 * 1024 * 1024; // 300MB

export type SourceKind = 'drive' | 'url';

export function detectSourceKind(input: string): SourceKind {
  return /drive\.google\.com/.test(input) ? 'drive' : 'url';
}

async function downloadDirectUrl(
  url: string,
  destPath: string,
  opts: { maxBytes?: number } = {}
): Promise<{ mimeType: string | null; bytes: number }> {
  const maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT;

  let res: Response;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch {
    throw new SourceImportError('เชื่อมต่อลิงก์วิดีโอไม่สำเร็จ — ตรวจสอบ URL อีกครั้ง', 'download_failed');
  }

  if (res.status === 404) {
    throw new SourceImportError('ไม่พบไฟล์ที่ URL นี้', 'invalid_link');
  }
  if (res.status === 403 || res.status === 401) {
    throw new SourceImportError('ไม่มีสิทธิ์เข้าถึงไฟล์นี้ — ลิงก์อาจหมดอายุหรือเป็นไฟล์ส่วนตัว', 'permission_denied');
  }
  if (!res.ok || !res.body) {
    throw new SourceImportError(`ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP ${res.status})`, 'download_failed');
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isAllowedType =
    ALLOWED_MIME_PREFIXES.some((p) => contentType.startsWith(p)) ||
    contentType === 'application/octet-stream' ||
    contentType === ''; // some signed-URL/CDN responses omit content-type
  if (!isAllowedType) {
    throw new SourceImportError(`ไม่รองรับไฟล์ประเภทนี้ (${contentType || 'ไม่ทราบชนิด'}) — รองรับเฉพาะ MP4 / MOV / WEBM`, 'unsupported_format');
  }

  const declaredLength = Number(res.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    throw new SourceImportError(`ไฟล์ใหญ่เกินกำหนด (${(declaredLength / 1024 / 1024).toFixed(0)}MB) — จำกัดไว้ที่ ${(maxBytes / 1024 / 1024).toFixed(0)}MB`, 'file_too_large');
  }

  let written = 0;
  const fileStream = fs.createWriteStream(destPath);
  const nodeReadable = Readable.fromWeb(res.body as any);
  nodeReadable.on('data', (chunk: Buffer) => {
    written += chunk.length;
    if (written > maxBytes) {
      nodeReadable.destroy(new SourceImportError(`ไฟล์ใหญ่เกินกำหนด — จำกัดไว้ที่ ${(maxBytes / 1024 / 1024).toFixed(0)}MB`, 'file_too_large'));
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
    if (err instanceof SourceImportError) throw err;
    throw new SourceImportError('ดาวน์โหลดไฟล์ไม่สำเร็จระหว่างทาง กรุณาลองใหม่', 'download_failed');
  }

  return { mimeType: contentType || null, bytes: written };
}

export async function downloadSourceVideo(
  sourceUrl: string,
  destPath: string,
  opts: { maxBytes?: number } = {}
): Promise<{ mimeType: string | null; bytes: number }> {
  if (detectSourceKind(sourceUrl) === 'drive') {
    try {
      const fileId = extractDriveFileId(sourceUrl);
      return await downloadDriveFile(fileId, destPath, opts);
    } catch (err) {
      if (err instanceof DriveImportError) {
        throw new SourceImportError(err.message, err.stage);
      }
      throw err;
    }
  }
  return downloadDirectUrl(sourceUrl, destPath, opts);
}
