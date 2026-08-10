// Thin wrapper around ffmpeg-static / ffprobe-static binaries.
// Invoked via execFile (not fluent-ffmpeg) to keep the surface small.
// MASTER_PROMPT_V2 "Cost Control": dense frames 0-5s, then 1 frame/2-3s,
// max frames configurable, resize frames, extract audio once.

import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const execFileAsync = promisify(execFile);

function ensureExecutable(path: string) {
  try {
    fs.chmodSync(path, 0o755);
  } catch {
    /* no-op: not needed/permitted on some platforms (e.g. Windows) */
  }
}

export class MediaProcessingError extends Error {
  stage: string;
  constructor(message: string, stage = 'ffmpeg') {
    super(message);
    this.stage = stage;
  }
}

export interface VideoMetadata {
  durationSec: number;
  width: number | null;
  height: number | null;
  codec: string | null;
}

export async function probeMetadata(filePath: string): Promise<VideoMetadata> {
  const probePath = ffprobeStatic.path;
  ensureExecutable(probePath);
  try {
    console.log('[ffprobe] path:', probePath, 'exists:', fs.existsSync(probePath));
    console.log('[ffprobe] input file size:', fs.existsSync(filePath) ? fs.statSync(filePath).size : 'MISSING');
    const { stdout } = await execFileAsync(probePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ]);
    const json = JSON.parse(stdout);
    const videoStream = (json.streams ?? []).find((s: any) => s.codec_type === 'video');
    const durationSec = Number(json.format?.duration ?? videoStream?.duration ?? 0);
    if (!durationSec || Number.isNaN(durationSec)) {
      console.error('[ffprobe] no duration found, raw output:', stdout.slice(0, 2000));
      throw new MediaProcessingError('อ่านข้อมูลวิดีโอไม่สำเร็จ (ไม่พบความยาวไฟล์) — ไฟล์อาจเสียหายหรือไม่ใช่วิดีโอที่รองรับ', 'probe');
    }
    return {
      durationSec,
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
      codec: videoStream?.codec_name ?? null
    };
  } catch (err: any) {
    if (err instanceof MediaProcessingError) throw err;
    console.error('[ffprobe] failed:', err?.message, err?.stderr || err?.stdout || '');
    throw new MediaProcessingError('อ่านข้อมูลวิดีโอไม่สำเร็จ — ไฟล์อาจเสียหายหรือไม่ใช่วิดีโอที่รองรับ', 'probe');
  }
}

export async function extractAudio(filePath: string, destPath: string): Promise<void> {
  if (!ffmpegPath) throw new MediaProcessingError('ไม่พบ ffmpeg บนเซิร์ฟเวอร์', 'audio_extract');
  ensureExecutable(ffmpegPath);
  try {
    await execFileAsync(ffmpegPath, ['-y', '-i', filePath, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', destPath], {
      maxBuffer: 1024 * 1024 * 20
    });
  } catch {
    throw new MediaProcessingError('แยกเสียงจากวิดีโอไม่สำเร็จ', 'audio_extract');
  }
}

export interface FramePlan {
  timestampSec: number;
}

export function buildFrameSamplePlan(durationSec: number, maxFrames = 20): FramePlan[] {
  const timestamps: number[] = [];
  // Dense sampling 0-5s, every 1s.
  for (let t = 0; t <= Math.min(5, durationSec); t += 1) {
    timestamps.push(Math.min(t, durationSec - 0.1));
  }
  // Sparse sampling every ~2.5s after that.
  for (let t = 7.5; t < durationSec; t += 2.5) {
    timestamps.push(t);
  }
  const deduped = Array.from(new Set(timestamps.map((t) => Math.max(0, Math.round(t * 10) / 10))));
  deduped.sort((a, b) => a - b);
  return deduped.slice(0, maxFrames).map((timestampSec) => ({ timestampSec }));
}

export async function extractFrame(filePath: string, timestampSec: number, destPath: string): Promise<void> {
  if (!ffmpegPath) throw new MediaProcessingError('ไม่พบ ffmpeg บนเซิร์ฟเวอร์', 'frame_extract');
  ensureExecutable(ffmpegPath);
  try {
    await execFileAsync(
      ffmpegPath,
      ['-y', '-ss', String(timestampSec), '-i', filePath, '-frames:v', '1', '-vf', 'scale=480:-1', '-q:v', '4', destPath],
      { maxBuffer: 1024 * 1024 * 20 }
    );
  } catch {
    throw new MediaProcessingError(`ดึงภาพจากวิดีโอที่วินาที ${timestampSec} ไม่สำเร็จ`, 'frame_extract');
  }
}

export async function extractFrames(filePath: string, plan: FramePlan[], tmpDir: string, prefix: string): Promise<{ timestampSec: number; path: string }[]> {
  const results: { timestampSec: number; path: string }[] = [];
  for (let i = 0; i < plan.length; i++) {
    const destPath = `${tmpDir}/${prefix}_frame_${i}.jpg`;
    await extractFrame(filePath, plan[i].timestampSec, destPath);
    results.push({ timestampSec: plan[i].timestampSec, path: destPath });
  }
  return results;
}

// Re-exported from fs-utils (not redefined here) so callers that only need
// cleanup — like the Tamsub-backed Editor route — can import it without
// pulling ffmpeg-static/ffprobe-static into their function bundle.
export { cleanupFiles } from './fs-utils';
