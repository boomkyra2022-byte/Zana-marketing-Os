import { z } from 'zod';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { downloadSourceVideo, SourceImportError } from '@/lib/media/source';
import { cleanupFiles } from '@/lib/media/fs-utils';
import { extractAudio, probeMetadata, MediaProcessingError } from '@/lib/media/ffmpeg';
import { uploadEditedClip } from '@/lib/supabase/storage';
import { transcribeAudioWithTimestamps, callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildPunchySubtitlePrompt, PROMPT_VERSION_PUNCHY_SUBTITLE } from '@/prompts/punchy-subtitle';
import { repairCueCoverage, resolveCueTimestampsWithWords, type RawCue } from '@/lib/media/srt';
import { regroupWhisperWordsThai } from '@/lib/media/word-segment';

// Transcribe-only step for the Live Editor (Tamsub-style timeline + live
// caption preview) — added per explicit user request: "ปรับให้หน้าตาเป็นแบบ
// Tamsub สำหรับ Editor" (full timeline + live preview, not just the style
// panel). Runs the same Whisper word-timestamp + GPT cue-grouping pipeline
// as PUNCHY_SRT in /api/tools/editor/run, but stops right after producing
// per-word-timed cues instead of burning them onto the video — the client
// gets real editable cue/word JSON back to render a scrubbable timeline and
// let the user drag word boundaries / retype text before committing to a
// (slow) ffmpeg burn. The extracted audio is also uploaded so the browser
// can decode a waveform for the timeline without re-fetching the whole
// source video (which may be an arbitrary-format Drive link, not something
// the Web Audio API can reliably decode — the extracted mp3 always can).
export const runtime = 'nodejs';
export const maxDuration = 180;

const requestSchema = z.object({
  source_url: z.string().min(1),
  product_id: z.string().uuid().nullable().optional(),
  max_words_per_cue: z.number().int().min(2).max(10).optional(),
  // "อัปโหลดไฟล์จากเครื่อง" mode: `source_url` is already a signed URL to
  // our own Storage (source-uploads bucket), already directly playable by
  // a <video> tag — re-uploading it a second time to edited-clips would be
  // pure waste (double the storage, double the upload time, and doubles
  // the chance of hitting a Storage size-limit error on large files for no
  // benefit). Only "วางลิงก์" mode (which may be an unplayable Drive share
  // page URL) actually needs the re-upload-for-preview trick.
  source_already_playable: z.boolean().optional()
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

  const tmpDir = os.tmpdir();
  const runId = randomUUID();
  const sourcePath = path.join(tmpDir, `transcribe_${runId}_src.mp4`);
  const audioPath = path.join(tmpDir, `transcribe_${runId}_audio.mp3`);

  try {
    await downloadSourceVideo(input.source_url, sourcePath, { maxBytes: 300 * 1024 * 1024 });

    const metadata = await probeMetadata(sourcePath);
    if (!metadata.width || !metadata.height) {
      throw new MediaProcessingError('อ่านขนาดวิดีโอไม่ได้ — ไม่สามารถวางตำแหน่งซับสไตล์ได้', 'probe');
    }

    await extractAudio(sourcePath, audioPath);
    const audioBuffer = fs.readFileSync(audioPath);

    const { words: rawWords } = await transcribeAudioWithTimestamps({ fileBuffer: audioBuffer, filename: 'audio.mp3' });
    if (rawWords.length === 0) {
      throw new AIProviderError('ถอดเสียงไม่สำเร็จ — ไม่พบคำพูดในคลิปนี้ (อาจเป็นคลิปเงียบหรือมีแต่เสียงเพลง)', 502);
    }
    // Whisper's raw word-level tokens for Thai are frequently sub-word
    // fragments (no spaces in Thai script) — regroup into real words before
    // anything downstream (cue grouping, the Live Editor timeline) sees them.
    const words = await regroupWhisperWordsThai(rawWords);

    let productName: string | null = null;
    let brand: string | null = null;
    if (input.product_id) {
      const { data: product } = await supabase.from('products').select('product_name, brand').eq('id', input.product_id).single();
      productName = product?.product_name ?? null;
      brand = product?.brand ?? null;
    }

    const { system, user: userPrompt } = buildPunchySubtitlePrompt({
      words,
      durationSec: metadata.durationSec,
      productName,
      brand,
      knownTerms: [],
      maxWordsPerCue: input.max_words_per_cue ?? 6
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
    const cues = resolveCueTimestampsWithWords(words, repaired, corrections);
    if (cues.length === 0) {
      throw new AIProviderError('สร้าง subtitle ไม่สำเร็จ — AI ไม่ได้คืนค่า cue ที่ใช้ได้', 502);
    }

    const { signedUrl: audioUrl } = await uploadEditedClip(audioBuffer, `transcribe_${runId}_audio.mp3`, 'audio/mpeg');

    // Also re-upload the source video itself so the Live Editor's <video>
    // preview always has a directly-streamable, same-CDN URL to point at —
    // real bug found in testing: when `source_url` is the user's original
    // pasted Google Drive link, a plain <video src> can only play it when
    // Drive happens to serve raw bytes directly (small files); once a file
    // is large enough to trigger Drive's "can't scan for viruses"
    // interstitial, Drive serves an HTML warning page instead of video
    // bytes and the preview player breaks — worked in earlier (smaller)
    // test clips purely by coincidence, not because it was actually
    // reliable. Uploaded-from-device sources didn't have this problem
    // (Supabase Storage always serves real bytes), but Drive/any other
    // remote URL did. Re-uploading the already-downloaded video bytes here
    // (server already has them in memory from downloadSourceVideo, before
    // this route's `finally` cleans up the temp file) fixes every source
    // type the same way.
    let videoUrl: string | null = null;
    if (!input.source_already_playable) {
      const videoBuffer = fs.readFileSync(sourcePath);
      const uploaded = await uploadEditedClip(videoBuffer, `transcribe_${runId}_preview.mp4`, 'video/mp4');
      videoUrl = uploaded.signedUrl;
    }

    return new Response(
      JSON.stringify({
        cues,
        audio_url: audioUrl,
        video_url: videoUrl, // null when source_already_playable — client falls back to its own source_url
        metadata: { width: metadata.width, height: metadata.height, duration_sec: metadata.durationSec },
        prompt_version: PROMPT_VERSION_PUNCHY_SUBTITLE
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    let message = 'ถอดเสียงไม่สำเร็จ';
    if (err instanceof SourceImportError || err instanceof MediaProcessingError || err instanceof AIProviderError) {
      message = err.message;
    } else if (err?.message) {
      message = err.message;
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  } finally {
    cleanupFiles([sourcePath, audioPath]);
  }
}
