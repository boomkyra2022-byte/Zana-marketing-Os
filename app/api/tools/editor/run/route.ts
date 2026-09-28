import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { downloadSourceVideo, SourceImportError } from '@/lib/media/source';
import { cleanupFiles } from '@/lib/media/fs-utils';
import {
  extractAudio,
  probeMetadata,
  applyDelogo,
  computeDelogoRegion,
  burnAssSubtitles,
  detectSilence,
  computeKeepSegments,
  cutSilenceSegments,
  trimAndCropVertical,
  MediaProcessingError,
  type WatermarkCorner
} from '@/lib/media/ffmpeg';
import { uploadEditedClip } from '@/lib/supabase/storage';
// Only the result-shape TYPE is still imported from the Tamsub client — no
// Tamsub function calls remain in this route. Kept because it's just a
// `{kind:'binary'|'text', ...}` discriminated union already used throughout
// this file for every operation's result, not because we still call
// Tamsub's API (see the "Retire Tamsub" note below).
import { type TamsubResult } from '@/lib/tamsub/client';
import { transcribeAudioWithTimestamps, callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildPunchySubtitlePrompt, PROMPT_VERSION_PUNCHY_SUBTITLE } from '@/prompts/punchy-subtitle';
import { buildAutoShortsPrompt } from '@/prompts/auto-shorts';
import {
  repairCueCoverage,
  resolveCueTimestamps,
  resolveCueTimestampsWithWords,
  cuesToSrt,
  sliceWordsByRange,
  groupWordsIntoCuesSimple,
  type RawCue,
  type TimedCueWithWords
} from '@/lib/media/srt';
import { buildKaraokeAss } from '@/lib/media/ass';
import { regroupWhisperWordsThai } from '@/lib/media/word-segment';

// Editor tool (silence-cut / subtitle burn-in / SRT export / dewatermark /
// punchy-subtitle). Everything here runs on our own ffmpeg/Whisper/GPT
// pipeline now — no more Tamsub API dependency. Retired per explicit user
// request ("เลิกพึ่ง Tamsub ทันที 100%") after a real Tamsub rate-limit
// error prompted the question of whether to keep depending on their paid
// API at all. RENDER/SUBTITLE_SRT/DEWATERMARK (the 3 remaining
// Tamsub-backed operations) are removed from the operation enum below —
// PUNCHY_SRT (burn_in on/off) already covers Render + SRT-only using our
// own pipeline, DEWATERMARK_LOCAL already covers dewatermark, and
// SILENCE_CUT below is now a from-scratch ffmpeg implementation
// (silencedetect + trim/concat, see lib/media/ffmpeg.ts) instead of a
// Tamsub proxy call. `lib/tamsub/client.ts` itself is left in the repo
// untouched (not deleted) in case Tamsub is ever wanted again later.
export const runtime = 'nodejs';
export const maxDuration = 300;

// 50MB — matches Supabase Free plan's hard Global Storage limit (see
// components/editor-client.tsx: MAX_UPLOAD_BYTES for the full reasoning).
const MAX_BYTES_DEFAULT = 50 * 1024 * 1024;

const requestSchema = z.object({
  operation: z.enum(['SILENCE_CUT', 'PUNCHY_SRT', 'DEWATERMARK_LOCAL', 'AUTO_SHORTS']),
  source_url: z.string().min(1),
  product_id: z.string().uuid().nullable().optional(),
  // AUTO_SHORTS — "long video -> AI picks best moments -> N vertical clips"
  // (see prompts/auto-shorts.ts). Reuses the existing burn_in style fields
  // above (font_name/font_size_px/text_color/highlight_color/
  // vertical_position_pct/max_words_per_cue) for each clip's captions —
  // captions are always burned in for Auto Shorts (no plain-SRT mode),
  // grouped deterministically per clip (see groupWordsIntoCuesSimple) rather
  // than via a second AI call per clip.
  num_clips: z.number().int().min(1).max(5).optional(),
  // SILENCE_CUT — own ffmpeg silencedetect+cut engine now (see
  // lib/media/ffmpeg.ts). threshold_db is a NEGATIVE dB value (native
  // ffmpeg units, not Tamsub's old % scale); min_silence_sec/bridge_sec are
  // seconds.
  threshold_db: z.number().max(0).optional(),
  min_silence_sec: z.number().min(0.1).max(5).optional(),
  bridge_sec: z.number().min(0).max(2).optional(),
  watermark_corner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  watermark_size: z.enum(['small', 'medium', 'large']).optional(),
  // Styled-caption burn-in (PUNCHY_SRT only) — Tamsub-editor-style font/size/
  // words-per-line/color/highlight picker, added per explicit user request.
  burn_in: z.boolean().optional(),
  font_name: z.string().optional(),
  font_size_px: z.number().int().min(16).max(160).optional(),
  max_words_per_cue: z.number().int().min(2).max(10).optional(),
  text_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  highlight_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  vertical_position_pct: z.number().min(0).max(100).optional(),
  // Live Editor (Tamsub-style timeline + live preview) sends back the
  // user-edited cues from POST /api/tools/editor/transcribe instead of
  // making us re-transcribe + re-run the AI grouping from scratch — this is
  // also what carries any manual drag/retype edits the user made in the
  // timeline through to the actual burn. When present + burn_in=true, this
  // is used verbatim (see runPunchySubtitle below); when absent, the old
  // "transcribe from scratch every time" behavior is kept for backward
  // compatibility (e.g. plain-SRT-only requests that never touched the
  // Live Editor).
  cues: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        text: z.string(),
        words: z.array(
          z.object({
            text: z.string(),
            start: z.number(),
            end: z.number(),
            durationCs: z.number()
          })
        )
      })
    )
    .optional()
});

const punchyCuesSchema = z.object({
  cues: z.array(
    z.object({
      start_word_index: z.number().int().min(0),
      end_word_index: z.number().int().min(0)
    })
  ),
  corrections: z
    .array(
      z.object({
        word_index: z.number().int().min(0),
        corrected_word: z.string()
      })
    )
    .optional()
});

const autoShortsMomentsSchema = z.object({
  clips: z.array(
    z.object({
      start_word_index: z.number().int().min(0),
      end_word_index: z.number().int().min(0),
      title: z.string().min(1),
      reason: z.string().min(1),
      hook_score: z.number().min(1).max(10)
    })
  )
});

interface AutoShortsClipResult {
  clipIndex: number;
  startSec: number;
  endSec: number;
  title: string;
  reason: string;
  hookScore: number;
  buffer: Buffer;
  contentType: string;
}

interface AutoShortsStyleOptions {
  fontName?: string;
  fontSizePx?: number;
  maxWordsPerCue: number;
  textColorHex?: string;
  highlightColorHex?: string;
  verticalPositionPct?: number;
}

// "Long video -> AI picks the N best moments -> N vertical clips, captioned"
// — approved direction after reviewing github.com/backblaze-b2-samples/
// ai-shorts-generator as a reference (see prompts/auto-shorts.ts header).
// Transcribes + runs moment-detection ONCE against the full video, then
// trims/crops/captions each picked moment. Per-clip captions are grouped
// deterministically (groupWordsIntoCuesSimple, no AI call) — running the
// existing AI cue-grouping per clip would multiply cost/latency by however
// many clips are requested and risk this route's 300s ceiling on top of the
// moment-detection call already made.
// onClipReady is called once per finished clip so the caller (POST handler)
// can upload + persist + stream progress incrementally instead of waiting
// for the whole batch to finish before the user sees anything.
async function runAutoShorts(
  sourcePath: string,
  runId: string,
  tmpDir: string,
  productId: string | null,
  supabase: ReturnType<typeof createClient>,
  numClips: number,
  style: AutoShortsStyleOptions,
  onClipReady: (clip: AutoShortsClipResult) => Promise<void>,
  onProgress: (event: Record<string, unknown>) => void
): Promise<void> {
  const audioPath = path.join(tmpDir, `editor_${runId}_autoshorts_audio.mp3`);
  const perClipCleanup: string[] = [];
  try {
    const metadata = await probeMetadata(sourcePath);
    await extractAudio(sourcePath, audioPath);
    const audioBuffer = fs.readFileSync(audioPath);

    onProgress({ type: 'auto_shorts_stage', stage: 'transcribing' });
    const { words: rawWords } = await transcribeAudioWithTimestamps({ fileBuffer: audioBuffer, filename: 'audio.mp3' });
    const words = await regroupWhisperWordsThai(rawWords);

    let productName: string | null = null;
    let brand: string | null = null;
    if (productId) {
      const { data: product } = await supabase.from('products').select('product_name, brand').eq('id', productId).single();
      productName = product?.product_name ?? null;
      brand = product?.brand ?? null;
    }

    onProgress({ type: 'auto_shorts_stage', stage: 'detecting_moments' });
    const { system, user: userPrompt } = buildAutoShortsPrompt({
      words,
      durationSec: metadata.durationSec,
      numClips,
      productName,
      brand
    });
    const { text: aiText } = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.4, timeoutMs: 120000 });

    let moments: z.infer<typeof autoShortsMomentsSchema>['clips'];
    try {
      const parsedJson = JSON.parse(aiText);
      const validated = autoShortsMomentsSchema.safeParse(parsedJson);
      if (!validated.success) {
        throw new Error(`AI response did not match expected schema: ${JSON.stringify(validated.error.flatten())}`);
      }
      moments = validated.data.clips;
    } catch (err: any) {
      throw new AIProviderError(err.message || 'AI response was not valid JSON', 502);
    }

    if (moments.length === 0) {
      throw new AIProviderError('AI ไม่พบช่วงที่น่าสนใจพอสำหรับตัดคลิปสั้นจากวิดีโอนี้ — ลองวิดีโอต้นฉบับอื่น', 502);
    }

    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');

    for (let i = 0; i < moments.length; i++) {
      const m = moments[i];
      const startIdx = Math.max(0, Math.min(m.start_word_index, words.length - 1));
      const endIdx = Math.max(startIdx, Math.min(m.end_word_index, words.length - 1));
      const startSec = Math.max(0, words[startIdx]?.start ?? 0);
      const endSec = Math.min(metadata.durationSec, words[endIdx]?.end ?? startSec);
      if (endSec <= startSec) continue;

      onProgress({ type: 'auto_shorts_stage', stage: 'rendering_clip', clip_index: i, title: m.title });

      const clipRawPath = path.join(tmpDir, `editor_${runId}_autoshorts_${i}_raw.mp4`);
      const assPath = path.join(tmpDir, `editor_${runId}_autoshorts_${i}.ass`);
      const clipBurnedPath = path.join(tmpDir, `editor_${runId}_autoshorts_${i}_burned.mp4`);
      perClipCleanup.push(clipRawPath, assPath, clipBurnedPath);

      await trimAndCropVertical(sourcePath, startSec, endSec, clipRawPath);

      const clipWords = sliceWordsByRange(words, startSec, endSec);
      const clipMeta = await probeMetadata(clipRawPath);

      if (clipWords.length > 0 && clipMeta.width && clipMeta.height) {
        const rawCues = groupWordsIntoCuesSimple(clipWords, style.maxWordsPerCue);
        const timedCuesWithWords = resolveCueTimestampsWithWords(clipWords, rawCues);
        const assContent = buildKaraokeAss(timedCuesWithWords, {
          fontName: style.fontName ?? 'Kanit',
          fontSizePx: style.fontSizePx ?? 56,
          textColorHex: style.textColorHex ?? '#FFFFFF',
          highlightColorHex: style.highlightColorHex ?? '#FACC15',
          videoWidth: clipMeta.width,
          videoHeight: clipMeta.height,
          verticalPositionPct: style.verticalPositionPct
        });
        fs.writeFileSync(assPath, assContent, 'utf8');
        await burnAssSubtitles(clipRawPath, assPath, fontsDir, clipBurnedPath);
      } else {
        // No words landed in this clip's window (rare — e.g. a mostly-silent
        // moment) — ship the cropped clip without captions rather than fail
        // the whole batch over one clip.
        fs.copyFileSync(clipRawPath, clipBurnedPath);
      }

      await onClipReady({
        clipIndex: i,
        startSec,
        endSec,
        title: m.title,
        reason: m.reason,
        hookScore: m.hook_score,
        buffer: fs.readFileSync(clipBurnedPath),
        contentType: 'video/mp4'
      });

      onProgress({ type: 'auto_shorts_stage', stage: 'clip_done', clip_index: i });
    }
  } finally {
    cleanupFiles([audioPath, ...perClipCleanup]);
  }
}

interface PunchyStyleOptions {
  burnIn: boolean;
  fontName?: string;
  fontSizePx?: number;
  maxWordsPerCue: number;
  textColorHex?: string;
  highlightColorHex?: string;
  verticalPositionPct?: number;
  // Pre-transcribed (and possibly manually edited in the Live Editor) cues
  // — when present, skips Whisper + AI grouping entirely and burns these
  // verbatim instead.
  cues?: TimedCueWithWords[];
}

async function runPunchySubtitle(
  sourcePath: string,
  runId: string,
  tmpDir: string,
  productId: string | null,
  supabase: ReturnType<typeof createClient>,
  style: PunchyStyleOptions
): Promise<TamsubResult> {
  const audioPath = path.join(tmpDir, `editor_${runId}_audio.mp3`);
  const assPath = path.join(tmpDir, `editor_${runId}_captions.ass`);
  const burnedPath = path.join(tmpDir, `editor_${runId}_burned.mp4`);
  try {
    const metadata = await probeMetadata(sourcePath);

    let timedCuesWithWords: TimedCueWithWords[];
    let promptVersionMeta: string;

    if (style.cues && style.cues.length > 0) {
      // Live Editor path (Tamsub-style timeline + live preview) — the
      // client already ran /api/tools/editor/transcribe and the user may
      // have dragged word boundaries / retyped text in the browser. Use
      // that verbatim instead of re-transcribing + re-running the AI
      // grouping from scratch, which would silently throw away any manual
      // edits the user just made.
      timedCuesWithWords = style.cues;
      promptVersionMeta = 'live-editor-manual';

      if (!style.burnIn) {
        return { kind: 'text', text: cuesToSrt(timedCuesWithWords), meta: { prompt_version: promptVersionMeta } };
      }
    } else {
      // Legacy/no-preview path — transcribe + AI-group from scratch, same
      // as before the Live Editor existed. Still used when burn_in is
      // requested without going through the transcribe step first.
      await extractAudio(sourcePath, audioPath);
      const audioBuffer = fs.readFileSync(audioPath);

      const { words: rawWords } = await transcribeAudioWithTimestamps({ fileBuffer: audioBuffer, filename: 'audio.mp3' });
      // Same Thai sub-word-fragment fix as the Live Editor's transcribe route.
      const words = await regroupWhisperWordsThai(rawWords);

      let productName: string | null = null;
      let brand: string | null = null;
      if (productId) {
        const { data: product } = await supabase.from('products').select('product_name, brand').eq('id', productId).single();
        productName = product?.product_name ?? null;
        brand = product?.brand ?? null;
      }

      const { system, user: userPrompt } = buildPunchySubtitlePrompt({
        words,
        durationSec: metadata.durationSec,
        productName,
        brand,
        knownTerms: [],
        maxWordsPerCue: style.maxWordsPerCue
      });

      const { text: aiText } = await callOpenAIJSON({ system, user: userPrompt, temperature: 0.2, timeoutMs: 120000 });

      let rawCues: RawCue[];
      let corrections: { word_index: number; corrected_word: string }[];
      try {
        const parsedJson = JSON.parse(aiText);
        const validated = punchyCuesSchema.safeParse(parsedJson);
        if (!validated.success) {
          throw new Error(`AI response did not match expected schema: ${JSON.stringify(validated.error.flatten())}`);
        }
        rawCues = validated.data.cues;
        corrections = validated.data.corrections ?? [];
      } catch (err: any) {
        throw new AIProviderError(err.message || 'AI response was not valid JSON', 502);
      }

      const repaired = repairCueCoverage(words, rawCues);

      if (!style.burnIn) {
        const timedCues = resolveCueTimestamps(words, repaired, corrections);
        if (timedCues.length === 0) {
          throw new AIProviderError('สร้าง subtitle ไม่สำเร็จ — AI ไม่ได้คืนค่า cue ที่ใช้ได้', 502);
        }
        return { kind: 'text', text: cuesToSrt(timedCues), meta: { prompt_version: PROMPT_VERSION_PUNCHY_SUBTITLE } };
      }

      timedCuesWithWords = resolveCueTimestampsWithWords(words, repaired, corrections);
      promptVersionMeta = PROMPT_VERSION_PUNCHY_SUBTITLE;
      if (timedCuesWithWords.length === 0) {
        throw new AIProviderError('สร้าง subtitle ไม่สำเร็จ — AI ไม่ได้คืนค่า cue ที่ใช้ได้', 502);
      }
    }

    // Styled burn-in path — Tamsub-editor-style font/size/color/highlight
    // picker, added per explicit user request ("ยังจำตัวทำซับได้ไหม จาก
    // tamsub.com... สร้าง UI แบบนี้ในเครื่องมือ Editor ของเราเอง"). Same
    // word-index -> real-timestamp grounding as the plain-SRT path; only the
    // output format changes (styled .ass burned onto the video instead of a
    // plain .srt file).
    if (!metadata.width || !metadata.height) {
      throw new MediaProcessingError('อ่านขนาดวิดีโอไม่ได้ — ไม่สามารถวางตำแหน่งซับสไตล์ได้', 'subtitle_burn');
    }

    const assContent = buildKaraokeAss(timedCuesWithWords, {
      fontName: style.fontName ?? 'Kanit',
      fontSizePx: style.fontSizePx ?? 56,
      textColorHex: style.textColorHex ?? '#FFFFFF',
      highlightColorHex: style.highlightColorHex ?? '#FACC15',
      videoWidth: metadata.width,
      videoHeight: metadata.height,
      verticalPositionPct: style.verticalPositionPct
    });
    fs.writeFileSync(assPath, assContent, 'utf8');

    // Bundled font folder — must contain the actual .ttf/.otf files matching
    // fontName (see assets/fonts/README.md). Vercel's serverless filesystem
    // has no system fonts installed, so without a real font file here Thai
    // text would render as tofu/boxes.
    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    await burnAssSubtitles(sourcePath, assPath, fontsDir, burnedPath);

    return {
      kind: 'binary',
      buffer: fs.readFileSync(burnedPath),
      contentType: 'video/mp4',
      meta: {
        prompt_version: promptVersionMeta,
        style: {
          fontName: style.fontName ?? 'Kanit',
          fontSizePx: style.fontSizePx ?? 56,
          textColorHex: style.textColorHex ?? '#FFFFFF',
          highlightColorHex: style.highlightColorHex ?? '#FACC15',
          verticalPositionPct: style.verticalPositionPct ?? null
        }
      }
    };
  } finally {
    cleanupFiles([audioPath, assPath, burnedPath]);
  }
}

async function runLocalDewatermark(
  sourcePath: string,
  runId: string,
  tmpDir: string,
  corner: WatermarkCorner,
  size: 'small' | 'medium' | 'large'
): Promise<{ buffer: Buffer; contentType: string }> {
  const outputPath = path.join(tmpDir, `editor_${runId}_dewm.mp4`);
  try {
    const metadata = await probeMetadata(sourcePath);
    if (!metadata.width || !metadata.height) {
      throw new MediaProcessingError('อ่านขนาดวิดีโอไม่ได้ — ไม่สามารถคำนวณตำแหน่งลายน้ำได้', 'dewatermark');
    }
    const region = computeDelogoRegion(metadata.width, metadata.height, corner, size);
    await applyDelogo(sourcePath, outputPath, region);
    return { buffer: fs.readFileSync(outputPath), contentType: 'video/mp4' };
  } finally {
    cleanupFiles([outputPath]);
  }
}

// Own silence-cut engine — replaces the old Tamsub-backed SILENCE_CUT.
// thresholdDb/minSilenceSec/bridgeSec default to reasonable values matching
// what ffmpeg's own silencedetect examples commonly use.
async function runLocalSilenceCut(
  sourcePath: string,
  runId: string,
  tmpDir: string,
  thresholdDb: number,
  minSilenceSec: number,
  bridgeSec: number
): Promise<{ buffer: Buffer; contentType: string; removedSec: number }> {
  const outputPath = path.join(tmpDir, `editor_${runId}_silencecut.mp4`);
  const listPath = path.join(tmpDir, `editor_${runId}_silencecut_list.txt`);
  const segmentPaths: string[] = [];
  try {
    const metadata = await probeMetadata(sourcePath);
    const silences = await detectSilence(sourcePath, thresholdDb, minSilenceSec);
    const keepSegments = computeKeepSegments(metadata.durationSec, silences, bridgeSec);

    for (let i = 0; i < keepSegments.length; i++) {
      segmentPaths.push(path.join(tmpDir, `editor_${runId}_silencecut_seg${i}.mp4`));
    }

    await cutSilenceSegments(sourcePath, keepSegments, segmentPaths, listPath, outputPath);

    const keptSec = keepSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    const removedSec = Math.max(0, metadata.durationSec - keptSec);

    return { buffer: fs.readFileSync(outputPath), contentType: 'video/mp4', removedSec };
  } finally {
    cleanupFiles([...segmentPaths, listPath, outputPath]);
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), { status: 400 });
  }
  const input = parsed.data;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      async function setStatus(jobId: string, status: string) {
        emit({ type: 'status', status });
        await supabase.from('editor_jobs').update({ status }).eq('id', jobId);
      }

      // AUTO_SHORTS produces N clips, not one — handled entirely separately
      // from the single-job flow below (which every other operation uses)
      // rather than shoehorning a variable result count into the one-row-
      // per-run shape. Each finished clip gets its own editor_jobs row
      // sharing a batch_id, inserted only once we know the real clip
      // count/titles (after moment-detection runs) — see
      // supabase/migrations/0023_auto_shorts.sql.
      if (input.operation === 'AUTO_SHORTS') {
        const tmpDir = os.tmpdir();
        const runId = randomUUID();
        const sourcePath = path.join(tmpDir, `editor_${runId}_src.mp4`);
        const batchId = randomUUID();
        let clipsDone = 0;

        try {
          emit({ type: 'status', status: 'DOWNLOADING' });
          await downloadSourceVideo(input.source_url, sourcePath, { maxBytes: MAX_BYTES_DEFAULT });

          emit({ type: 'status', status: 'PROCESSING' });

          await runAutoShorts(
            sourcePath,
            runId,
            tmpDir,
            input.product_id ?? null,
            supabase,
            input.num_clips ?? 3,
            {
              fontName: input.font_name,
              fontSizePx: input.font_size_px,
              maxWordsPerCue: input.max_words_per_cue ?? 5,
              textColorHex: input.text_color,
              highlightColorHex: input.highlight_color,
              verticalPositionPct: input.vertical_position_pct
            },
            async (clip) => {
              const resultFilename = `auto_shorts_${runId}_${clip.clipIndex}.mp4`;
              const { path: resultPath, signedUrl } = await uploadEditedClip(clip.buffer, resultFilename, clip.contentType);

              const { data: clipJob, error: clipInsertError } = await supabase
                .from('editor_jobs')
                .insert({
                  operation: 'AUTO_SHORTS',
                  source_url: input.source_url,
                  options: {
                    num_clips: input.num_clips ?? 3,
                    font_name: input.font_name ?? null,
                    font_size_px: input.font_size_px ?? null,
                    max_words_per_cue: input.max_words_per_cue ?? null,
                    text_color: input.text_color ?? null,
                    highlight_color: input.highlight_color ?? null,
                    vertical_position_pct: input.vertical_position_pct ?? null
                  },
                  product_id: input.product_id ?? null,
                  status: 'DONE',
                  creator_id: user.id,
                  batch_id: batchId,
                  clip_index: clip.clipIndex,
                  clip_start_sec: clip.startSec,
                  clip_end_sec: clip.endSec,
                  clip_title: clip.title,
                  clip_reason: clip.reason,
                  clip_hook_score: clip.hookScore,
                  result_path: resultPath,
                  result_kind: 'VIDEO'
                })
                .select('*')
                .single();

              if (clipInsertError || !clipJob) {
                emit({ type: 'error', error: clipInsertError?.message || 'บันทึกคลิปไม่สำเร็จ' });
                return;
              }

              clipsDone += 1;
              emit({
                type: 'auto_shorts_clip_done',
                job: clipJob,
                result: { kind: 'VIDEO', signed_url: signedUrl },
                clip: {
                  clip_index: clip.clipIndex,
                  start_sec: clip.startSec,
                  end_sec: clip.endSec,
                  title: clip.title,
                  reason: clip.reason,
                  hook_score: clip.hookScore
                }
              });

              await supabase.from('activity_logs').insert({
                user_id: user.id,
                action: 'editor_run',
                entity_type: 'editor_job',
                entity_id: clipJob.id,
                new_value: { operation: 'AUTO_SHORTS', clip_index: clip.clipIndex, batch_id: batchId },
                reason: `Ran AUTO_SHORTS via Editor tool (clip ${clip.clipIndex + 1})`
              });
            },
            (event) => emit(event)
          );

          emit({ type: 'batch_done', batch_id: batchId, clip_count: clipsDone });
        } catch (err: any) {
          let message = 'เกิดข้อผิดพลาดระหว่างประมวลผล';
          if (err instanceof SourceImportError || err instanceof MediaProcessingError || err instanceof AIProviderError) {
            message = err.message;
          } else if (err?.message) {
            message = err.message;
          }
          emit({ type: 'error', error: message });
        } finally {
          cleanupFiles([sourcePath]);
          controller.close();
        }
        return;
      }

      const { data: job, error: insertError } = await supabase
        .from('editor_jobs')
        .insert({
          operation: input.operation,
          source_url: input.source_url,
          options: {
            threshold_db: input.threshold_db ?? null,
            min_silence_sec: input.min_silence_sec ?? null,
            bridge_sec: input.bridge_sec ?? null,
            watermark_corner: input.watermark_corner ?? null,
            watermark_size: input.watermark_size ?? null,
            burn_in: input.burn_in ?? null,
            font_name: input.font_name ?? null,
            font_size_px: input.font_size_px ?? null,
            max_words_per_cue: input.max_words_per_cue ?? null,
            text_color: input.text_color ?? null,
            highlight_color: input.highlight_color ?? null,
            vertical_position_pct: input.vertical_position_pct ?? null,
            used_live_editor_cues: Boolean(input.cues && input.cues.length > 0)
          },
          product_id: input.product_id ?? null,
          status: 'PENDING',
          creator_id: user.id
        })
        .select('*')
        .single();

      if (insertError || !job) {
        emit({ type: 'error', error: insertError?.message || 'Could not create editor job record' });
        controller.close();
        return;
      }

      emit({ type: 'job_created', job });

      const tmpDir = os.tmpdir();
      const runId = randomUUID();
      const sourcePath = path.join(tmpDir, `editor_${runId}_src.mp4`);

      try {
        // ---- DOWNLOADING ----
        await setStatus(job.id, 'DOWNLOADING');
        await downloadSourceVideo(input.source_url, sourcePath, { maxBytes: MAX_BYTES_DEFAULT });

        // ---- PROCESSING (own ffmpeg/Whisper/GPT pipeline for every operation — no Tamsub calls) ----
        await setStatus(job.id, 'PROCESSING');

        let result: TamsubResult;
        if (input.operation === 'PUNCHY_SRT') {
          result = await runPunchySubtitle(sourcePath, runId, tmpDir, input.product_id ?? null, supabase, {
            burnIn: input.burn_in ?? false,
            fontName: input.font_name,
            fontSizePx: input.font_size_px,
            maxWordsPerCue: input.max_words_per_cue ?? 6,
            textColorHex: input.text_color,
            highlightColorHex: input.highlight_color,
            verticalPositionPct: input.vertical_position_pct,
            cues: input.cues
          });
        } else if (input.operation === 'DEWATERMARK_LOCAL') {
          const dewm = await runLocalDewatermark(
            sourcePath,
            runId,
            tmpDir,
            input.watermark_corner ?? 'bottom-right',
            input.watermark_size ?? 'medium'
          );
          result = { kind: 'binary', buffer: dewm.buffer, contentType: dewm.contentType, meta: { method: 'ffmpeg-delogo' } };
        } else {
          // SILENCE_CUT — own ffmpeg silencedetect+cut engine (see
          // lib/media/ffmpeg.ts), replaces the retired Tamsub call.
          const cut = await runLocalSilenceCut(
            sourcePath,
            runId,
            tmpDir,
            input.threshold_db ?? -30,
            input.min_silence_sec ?? 0.5,
            input.bridge_sec ?? 0.3
          );
          result = { kind: 'binary', buffer: cut.buffer, contentType: cut.contentType, meta: { method: 'ffmpeg-silencedetect', removed_sec: cut.removedSec } };
        }

        // ---- UPLOADING (skip for text/SRT results — small, returned inline) ----
        if (result.kind === 'binary') {
          await setStatus(job.id, 'UPLOADING');
          const resultFilename = `${input.operation.toLowerCase()}_${runId}.mp4`;
          const { path: resultPath, signedUrl } = await uploadEditedClip(result.buffer, resultFilename, result.contentType);

          await supabase
            .from('editor_jobs')
            .update({ status: 'DONE', result_path: resultPath, result_kind: 'VIDEO', tamsub_meta: result.meta ?? null })
            .eq('id', job.id);

          emit({
            type: 'done',
            job: { ...job, status: 'DONE', result_path: resultPath },
            result: { kind: 'VIDEO', signed_url: signedUrl }
          });
        } else {
          await supabase
            .from('editor_jobs')
            .update({ status: 'DONE', result_kind: 'SRT', srt_text: result.text, tamsub_meta: result.meta ?? null })
            .eq('id', job.id);

          emit({
            type: 'done',
            job: { ...job, status: 'DONE' },
            result: { kind: 'SRT', srt_text: result.text }
          });
        }

        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'editor_run',
          entity_type: 'editor_job',
          entity_id: job.id,
          new_value: { operation: input.operation },
          reason: `Ran ${input.operation} via Editor tool`
        });
      } catch (err: any) {
        await supabase.from('editor_jobs').update({ status: 'FAILED', error: err?.message ?? 'unknown error' }).eq('id', job.id);

        let message = 'เกิดข้อผิดพลาดระหว่างประมวลผล';
        if (err instanceof SourceImportError || err instanceof MediaProcessingError || err instanceof AIProviderError) {
          message = err.message;
        } else if (err?.message) {
          message = err.message;
        }
        emit({ type: 'error', error: message });
      } finally {
        cleanupFiles([sourcePath]);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
