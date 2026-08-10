import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { downloadSourceVideo, SourceImportError } from '@/lib/media/source';
import { cleanupFiles } from '@/lib/media/fs-utils';
import { uploadEditedClip } from '@/lib/supabase/storage';
import { tamsubSilenceCut, tamsubRender, tamsubSubtitlesSrt, tamsubDewatermark, TamsubError, type TamsubResult } from '@/lib/tamsub/client';

// Editor tool (silence-cut / subtitle burn-in / SRT export / dewatermark),
// delegating all actual video processing to the Tamsub API — no local
// ffmpeg needed here. Streamed NDJSON progress, same pattern as
// /api/creative/videos/import, since a real Tamsub call + storage upload can
// take a while and the UI should show live status.
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BYTES_DEFAULT = 300 * 1024 * 1024;

const requestSchema = z.object({
  operation: z.enum(['SILENCE_CUT', 'RENDER', 'SUBTITLE_SRT', 'DEWATERMARK']),
  source_url: z.string().min(1),
  product_id: z.string().uuid().nullable().optional(),
  template_id: z.string().optional(),
  language: z.string().optional(),
  threshold_db: z.number().optional(),
  min_silence_ms: z.number().optional()
});

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
            min_silence_ms: input.min_silence_ms ?? null
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

        // ---- PROCESSING (delegated to Tamsub) ----
        await setStatus(job.id, 'PROCESSING');
        const fileBuffer = fs.readFileSync(sourcePath);
        const filename = `source_${runId}.mp4`;

        let result: TamsubResult;
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
        if (err instanceof SourceImportError || err instanceof TamsubError) {
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
