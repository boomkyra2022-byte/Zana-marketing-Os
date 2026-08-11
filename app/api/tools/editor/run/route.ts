import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { downloadSourceVideo, SourceImportError } from '@/lib/media/source';
import { cleanupFiles } from '@/lib/media/fs-utils';
import { extractAudio, probeMetadata, applyDelogo, computeDelogoRegion, MediaProcessingError, type WatermarkCorner } from '@/lib/media/ffmpeg';
import { uploadEditedClip } from '@/lib/supabase/storage';
import { tamsubSilenceCut, tamsubRender, tamsubSubtitlesSrt, tamsubDewatermark, TamsubError, type TamsubResult } from '@/lib/tamsub/client';
import { transcribeAudioWithTimestamps, callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildPunchySubtitlePrompt, PROMPT_VERSION_PUNCHY_SUBTITLE } from '@/prompts/punchy-subtitle';
import { repairCueCoverage, resolveCueTimestamps, cuesToSrt, type RawCue } from '@/lib/media/srt';

// Editor tool (silence-cut / subtitle burn-in / SRT export / dewatermark /
// punchy-subtitle). Most operations delegate to the Tamsub API — no local
// ffmpeg needed for those. PUNCHY_SRT is the exception: it runs its own
// Whisper word-timestamp + GPT cue-grouping pipeline (see
// prompts/punchy-subtitle.ts) so we control the exact Thai segmentation
// rules instead of relying on Tamsub's opaque captioning. Streamed NDJSON
// progress, same pattern as /api/creative/videos/import.
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BYTES_DEFAULT = 300 * 1024 * 1024;

const requestSchema = z.object({
  operation: z.enum(['SILENCE_CUT', 'RENDER', 'SUBTITLE_SRT', 'DEWATERMARK', 'PUNCHY_SRT', 'DEWATERMARK_LOCAL']),
  source_url: z.string().min(1),
  product_id: z.string().uuid().nullable().optional(),
  template_id: z.string().optional(),
  language: z.string().optional(),
  threshold_db: z.number().optional(),
  min_silence_ms: z.number().optional(),
  watermark_corner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  watermark_size: z.enum(['small', 'medium', 'large']).optional()
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

async function runPunchySubtitle(
  sourcePath: string,
  runId: string,
  tmpDir: string,
  productId: string | null,
  supabase: ReturnType<typeof createClient>
): Promise<{ text: string }> {
  const audioPath = path.join(tmpDir, `editor_${runId}_audio.mp3`);
  try {
    const metadata = await probeMetadata(sourcePath);
    await extractAudio(sourcePath, audioPath);
    const audioBuffer = fs.readFileSync(audioPath);

    const { words } = await transcribeAudioWithTimestamps({ fileBuffer: audioBuffer, filename: 'audio.mp3' });

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
      knownTerms: []
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
    const timedCues = resolveCueTimestamps(words, repaired, corrections);
    if (timedCues.length === 0) {
      throw new AIProviderError('สร้าง subtitle ไม่สำเร็จ — AI ไม่ได้คืนค่า cue ที่ใช้ได้', 502);
    }

    return { text: cuesToSrt(timedCues) };
  } finally {
    cleanupFiles([audioPath]);
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

      const { data: job, error: insertError } = await supabase
        .from('editor_jobs')
        .insert({
          operation: input.operation,
          source_url: input.source_url,
          template_id: input.template_id ?? null,
          options: {
            language: input.language ?? null,
            threshold_db: input.threshold_db ?? null,
            min_silence_ms: input.min_silence_ms ?? null,
            watermark_corner: input.watermark_corner ?? null,
            watermark_size: input.watermark_size ?? null
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

        // ---- PROCESSING (Tamsub for most ops; own Whisper+GPT pipeline for PUNCHY_SRT) ----
        await setStatus(job.id, 'PROCESSING');
        const filename = `source_${runId}.mp4`;

        let result: TamsubResult;
        if (input.operation === 'PUNCHY_SRT') {
          const punchy = await runPunchySubtitle(sourcePath, runId, tmpDir, input.product_id ?? null, supabase);
          result = { kind: 'text', text: punchy.text, meta: { prompt_version: PROMPT_VERSION_PUNCHY_SUBTITLE } };
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
          const fileBuffer = fs.readFileSync(sourcePath);
          switch (input.operation) {
            case 'SILENCE_CUT':
              result = await tamsubSilenceCut(fileBuffer, filename, {
                threshold_db: input.threshold_db,
                min_silence_ms: input.min_silence_ms
              });
              break;
            case 'RENDER':
              result = await tamsubRender(fileBuffer, filename, {
                template_id: input.template_id,
                language: input.language
              });
              break;
            case 'SUBTITLE_SRT':
              result = await tamsubSubtitlesSrt(fileBuffer, filename, { language: input.language });
              break;
            case 'DEWATERMARK':
              result = await tamsubDewatermark(fileBuffer, filename);
              break;
            default:
              // Unreachable given the zod enum above — satisfies TS definite-assignment.
              throw new Error(`Unsupported operation: ${input.operation}`);
          }
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
        if (err instanceof SourceImportError || err instanceof TamsubError || err instanceof MediaProcessingError || err instanceof AIProviderError) {
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
