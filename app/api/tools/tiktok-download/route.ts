import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { uploadEditedClip } from '@/lib/supabase/storage';
import { cleanupFiles } from '@/lib/media/fs-utils';
import { downloadDirectUrl, SourceImportError } from '@/lib/media/source';
import { extractTikTokUrl, resolveTikTokVideo, tiktokDownloadHeaders, TikTokError } from '@/lib/media/tiktok';

// TikTok link -> watermark-free (HD when available) MP4. The file is stored
// in the same private bucket the Editor uses and handed back as a signed
// URL, so the bytes never pass through a Vercel Function response (4.5MB
// cap). The signed URL can also be pasted into the Editor as a source link.
export const runtime = 'nodejs';
export const maxDuration = 60;

// 50MB — matches the Supabase Free plan's Global Storage limit that already
// caps every other video path in this app (see lib/media/source.ts).
const MAX_BYTES = 50 * 1024 * 1024;

const bodySchema = z.object({
  url: z.string().trim().min(8).max(2000),
  // 'hd' = sharpest (HEVC); 'compat' = H.264, plays on every device.
  quality: z.enum(['hd', 'compat']).default('hd')
});

// Best-effort per-instance limiter (serverless instances do not share
// memory), so it only blunts accidental double-clicks and loops. The real
// abuse guard is that the route requires a signed-in user.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

function safeName(value: string | null): string {
  return (value ?? 'video').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 30) || 'video';
}

const STATUS_BY_STAGE: Record<string, number> = {
  invalid_link: 400,
  not_found: 404,
  rate_limited: 429,
  file_too_large: 413
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  if (rateLimited(user.id)) {
    return Response.json({ error: 'ใช้งานถี่เกินไป — รอสักครู่แล้วลองใหม่' }, { status: 429 });
  }

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'กรุณาวางลิงก์ TikTok' }, { status: 400 });
  }
  if (!extractTikTokUrl(input.url)) {
    return Response.json({ error: 'ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์จาก tiktok.com' }, { status: 400 });
  }

  const tmpPath = path.join(os.tmpdir(), `tiktok-${randomUUID()}.mp4`);
  try {
    const video = await resolveTikTokVideo(input.url, { prefer: input.quality === 'compat' ? 'compat' : 'hd' });
    await downloadDirectUrl(video.videoUrl, tmpPath, { maxBytes: MAX_BYTES, headers: tiktokDownloadHeaders() });

    const buffer = fs.readFileSync(tmpPath);
    const filename = `tiktok_${safeName(video.author)}_${video.id}.mp4`;
    const { signedUrl } = await uploadEditedClip(buffer, filename, 'video/mp4');
    // `download=` makes Storage answer with Content-Disposition: attachment,
    // so the browser saves the file instead of playing it inline.
    const downloadUrl = `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(filename)}`;

    return Response.json({
      ok: true,
      video: {
        id: video.id,
        author: video.author,
        title: video.title,
        duration_sec: video.durationSec,
        cover: video.cover,
        quality: video.quality,
        bytes: buffer.byteLength
      },
      filename,
      download_url: downloadUrl,
      expires_in_hours: 24
    });
  } catch (err) {
    if (err instanceof TikTokError || err instanceof SourceImportError) {
      return Response.json({ error: err.message, stage: err.stage }, { status: STATUS_BY_STAGE[err.stage] ?? 502 });
    }
    console.error('[tiktok-download]', err instanceof Error ? err.message : 'unknown error');
    return Response.json({ error: 'ดาวน์โหลดคลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, { status: 500 });
  } finally {
    cleanupFiles([tmpPath]);
  }
}
