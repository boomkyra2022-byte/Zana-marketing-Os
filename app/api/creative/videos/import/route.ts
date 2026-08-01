import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getRelevantCreativeContext } from '@/lib/ai/context';
import { callOpenAIVisionJSON, transcribeAudio, AIProviderError } from '@/lib/ai/openai';
import { extractDriveFileId, downloadDriveFile, DriveImportError } from '@/lib/media/drive';
import { probeMetadata, extractAudio, buildFrameSamplePlan, extractFrames, cleanupFiles, MediaProcessingError } from '@/lib/media/ffmpeg';
import { buildVideoAnalyzerPrompt, PROMPT_VERSION_VIDEO_ANALYZER } from '@/prompts/video-analyzer';
import { SCORE_DIMENSIONS } from '@/prompts/creative-score';

// Real ffmpeg + transcription + vision pipeline in one request, streamed back
// as newline-delimited JSON progress events (DOWNLOADING/EXTRACTING/...).
// Needs a long timeout — Vercel Hobby caps around 60s; this requires Pro.
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_MINUTES_DEFAULT = 10;
const MAX_FRAMES_DEFAULT = 20;
const MAX_BYTES_DEFAULT = 300 * 1024 * 1024;

const requestSchema = z.object({
  drive_url: z.string().min(1),
  product_id: z.string().uuid(),
  persona_id: z.string().uuid().nullable().optional(),
  objective: z.string().optional(),
  platform: z.string().optional(),
  idea_id: z.string().uuid().nullable().optional(),
  script_id: z.string().uuid().nullable().optional(),
  storyboard_id: z.string().uuid().nullable().optional()
});

const dimensionKeys = SCORE_DIMENSIONS.map((d) => d.key) as [string, ...string[]];

const scoreBreakdownEntrySchema = z.object({
  score: z.number(),
  what_works: z.string().nullable(),
  what_hurts: z.string().nullable(),
  recommendation: z.string().nullable()
});

const analysisSchema = z.object({
  score_total: z.number().min(0).max(100),
  verdict: z.enum(['REJECT', 'REVISE', 'READY TO TEST', 'PRIORITY TEST']),
  score_breakdown: z.record(z.enum(dimensionKeys), scoreBreakdownEntrySchema),
  timeline_findings: z.array(
    z.object({
      start_time: z.string(),
      end_time: z.string(),
      status: z.enum(['KEEP', 'FIX', 'IMPROVE']),
      finding: z.string(),
      recommendation: z.string()
    })
  ),
  storyboard_comparison: z
    .array(
      z.object({
        aspect: z.string(),
        planned: z.string().nullable(),
        actual: z.string().nullable(),
        status: z.enum(['Followed', 'Changed', 'Missing']),
        result: z.string().nullable(),
        recommendation: z.string().nullable()
      })
    )
    .nullable(),
  risk_flags: z.array(z.string())
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

  let fileId: string;
  try {
    fileId = extractDriveFileId(input.drive_url);
  } catch (err) {
    const message = err instanceof DriveImportError ? err.message : 'ลิงก์ Google Drive ไม่ถูกต้อง';
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      async function setStatus(videoId: string, status: string) {
        emit({ type: 'status', status });
        await supabase.from('videos').update({ status }).eq('id', videoId);
      }

      const { data: video, error: insertVideoError } = await supabase
        .from('videos')
        .insert({
          script_id: input.script_id ?? null,
          storyboard_id: input.storyboard_id ?? null,
          product_id: input.product_id,
          source_url: input.drive_url,
          status: 'DOWNLOADING',
          creator_id: user.id
        })
        .select('*')
        .single();

      if (insertVideoError || !video) {
        emit({ type: 'error', error: insertVideoError?.message || 'Could not create video record' });
        controller.close();
        return;
      }

      emit({ type: 'video_created', video });

      const tmpDir = os.tmpdir();
      const runId = randomUUID();
      const videoPath = path.join(tmpDir, `zana_${runId}.mp4`);
      const audioPath = path.join(tmpDir, `zana_${runId}.mp3`);
      const framePaths: string[] = [];

      try {
        // ---- DOWNLOADING ----
        emit({ type: 'status', status: 'DOWNLOADING' });
        await downloadDriveFile(fileId, videoPath, { maxBytes: MAX_BYTES_DEFAULT });

        // ---- EXTRACTING (metadata + audio + frames) ----
        await setStatus(video.id, 'EXTRACTING');
        const metadata = await probeMetadata(videoPath);
        if (metadata.durationSec > MAX_MINUTES_DEFAULT * 60) {
          throw new MediaProcessingError(`วิดีโอยาว ${(metadata.durationSec / 60).toFixed(1)} นาที เกินกำหนด ${MAX_MINUTES_DEFAULT} นาที`, 'duration_limit');
        }
        await extractAudio(videoPath, audioPath);
        const framePlan = buildFrameSamplePlan(metadata.durationSec, MAX_FRAMES_DEFAULT);
        const frames = await extractFrames(videoPath, framePlan, tmpDir, runId);
        framePaths.push(...frames.map((f) => f.path));

        // ---- TRANSCRIBING ----
        await setStatus(video.id, 'TRANSCRIBING');
        const audioBuffer = fs.readFileSync(audioPath);
        const { text: transcript } = await transcribeAudio({ fileBuffer: audioBuffer, filename: 'audio.mp3' });

        // ---- ANALYZING (build context + prompt) ----
        await setStatus(video.id, 'ANALYZING');
        const ctx = await getRelevantCreativeContext(supabase, { productId: input.product_id, personaId: input.persona_id });
        if (!ctx.product) throw new Error('Product not found');

        let originalIdea: any = null;
        let originalScript: any = null;
        let originalStoryboard: any = null;
        if (input.idea_id) {
          const { data } = await supabase.from('ideas').select('title, hook, visual_concept').eq('id', input.idea_id).single();
          originalIdea = data ?? null;
        }
        if (input.script_id) {
          const { data } = await supabase.from('scripts').select('full_script, hook, cta').eq('id', input.script_id).single();
          originalScript = data ?? null;
        }
        if (input.storyboard_id) {
          const { data } = await supabase.from('storyboards').select('scenes').eq('id', input.storyboard_id).single();
          originalStoryboard = data ?? null;
        }

        const imageDataUrls = frames.map((f) => {
          const buf = fs.readFileSync(f.path);
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        });

        const { system, user: userPrompt } = buildVideoAnalyzerPrompt({
          product: ctx.product,
          persona: ctx.persona,
          objective: input.objective ?? null,
          platform: input.platform ?? null,
          transcript,
          frameTimestamps: frames.map((f) => f.timestampSec),
          durationSec: metadata.durationSec,
          originalIdea,
          originalScript,
          originalStoryboard,
          knowledgeText: ctx.knowledgeText
        });

        // ---- SCORING ----
        await setStatus(video.id, 'SCORING');
        const { text: aiText, model } = await callOpenAIVisionJSON({ system, user: userPrompt, images: imageDataUrls, temperature: 0.3, timeoutMs: 240000 });

        let analysis: z.infer<typeof analysisSchema>;
        try {
          const rawJson = JSON.parse(aiText);
          const validated = analysisSchema.safeParse(rawJson);
          if (!validated.success) {
            throw new Error(`AI response did not match expected schema: ${JSON.stringify(validated.error.flatten())}`);
          }
          analysis = validated.data;
        } catch (err: any) {
          throw new AIProviderError(err.message || 'AI response was not valid JSON', 502);
        }

        const { data: analysisRow, error: analysisInsertError } = await supabase
          .from('video_analysis')
          .insert({
            video_id: video.id,
            transcript,
            metadata: { duration_sec: metadata.durationSec, width: metadata.width, height: metadata.height, codec: metadata.codec },
            frames: frames.map((f) => ({ timestamp_sec: f.timestampSec })),
            score_total: analysis.score_total,
            score_breakdown: analysis.score_breakdown,
            verdict: analysis.verdict,
            timeline_findings: analysis.timeline_findings,
            storyboard_comparison: analysis.storyboard_comparison,
            risk_flags: analysis.risk_flags,
            provider: 'openai',
            model,
            prompt_version: PROMPT_VERSION_VIDEO_ANALYZER
          })
          .select('*')
          .single();

        if (analysisInsertError) throw new Error(analysisInsertError.message);

        await supabase.from('videos').update({ status: 'DONE', duration_sec: metadata.durationSec }).eq('id', video.id);

        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'ai_analyze_video',
          entity_type: 'video',
          entity_id: video.id,
          new_value: { provider: 'openai', model, prompt_version: PROMPT_VERSION_VIDEO_ANALYZER, score_total: analysis.score_total, verdict: analysis.verdict },
          reason: `Analyzed video for product ${ctx.product.product_name}`
        });

        emit({ type: 'done', video: { ...video, status: 'DONE', duration_sec: metadata.durationSec }, analysis: analysisRow });
      } catch (err: any) {
        await supabase.from('videos').update({ status: 'FAILED' }).eq('id', video.id);

        let message = 'เกิดข้อผิดพลาดระหว่างวิเคราะห์วิดีโอ';
        if (err instanceof DriveImportError || err instanceof MediaProcessingError) {
          message = err.message;
        } else if (err instanceof AIProviderError) {
          message = err.message;
        } else if (err?.message) {
          message = err.message;
        }
        emit({ type: 'error', error: message });
      } finally {
        cleanupFiles([videoPath, audioPath, ...framePaths]);
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
