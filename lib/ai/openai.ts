// Shared OpenAI JSON-mode caller used by all /api/creative/* routes.
// Keeps provider/model/timeout/error-handling consistent (MASTER_PROMPT_V2
// "Security"/error-handling requirements: timeout + readable error on every AI call).

import { createClient } from '@/lib/supabase/server';

export class AIProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

// Turns a non-OK OpenAI HTTP response into a user-facing Thai message.
// The raw response body (JSON from OpenAI) is logged server-side only —
// never shown to the user (e.g. Content Studio used to surface the full
// "invalid_api_key" JSON when the key expired).
export async function toProviderError(res: Response, context = 'OpenAI'): Promise<AIProviderError> {
  let errText = '';
  try {
    errText = await res.text();
  } catch {
    // body unreadable — status alone is enough
  }
  console.error(`[${context}] HTTP ${res.status}:`, errText.slice(0, 2000));

  const status = res.status;
  if (status === 401) {
    return new AIProviderError('OpenAI API key หมดอายุหรือไม่ถูกต้อง — อัปเดต OPENAI_API_KEY ใน Vercel แล้ว Redeploy', 502);
  }
  if (status === 429) {
    return new AIProviderError('เครดิต OpenAI หมดหรือเรียกถี่เกินไป', 429);
  }
  if (status >= 500) {
    return new AIProviderError('OpenAI ขัดข้องชั่วคราว ลองใหม่', 503);
  }

  // Other 4xx: show OpenAI's human-readable message (if any), not the JSON.
  let detail = '';
  try {
    const parsed = JSON.parse(errText);
    if (typeof parsed?.error?.message === 'string') detail = parsed.error.message;
  } catch {
    // not JSON
  }
  return new AIProviderError(
    detail ? `${context} ปฏิเสธคำขอ (${status}): ${detail.slice(0, 200)}` : `${context} ปฏิเสธคำขอ (${status})`,
    502
  );
}

// Settings → AI → "Model" used to be saved to the `settings` table but never
// read by any AI call (every route fell through to AI_MODEL / gpt-4o-mini),
// i.e. a dead field. User asked 2026-09-24 "ตั้งค่า Model ได้ไหม" — wired here
// so every text/vision call picks it up. Precedence:
//   explicit opts.model > Settings "Model" > env AI_MODEL > 'gpt-4o-mini'
// Any failure reading settings (no session, RLS, network) silently falls back
// to env/default — a settings read must never break an AI call.
async function resolveChatModel(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    const supabase = createClient();
    const { data } = await supabase.from('settings').select('value').eq('key', 'ai').maybeSingle();
    const fromSettings = typeof (data?.value as any)?.model === 'string' ? String((data?.value as any).model).trim() : '';
    if (fromSettings) return fromSettings;
  } catch {
    // fall through to env/default
  }
  return process.env.AI_MODEL || 'gpt-4o-mini';
}

// Some newer OpenAI models (reasoning models such as o-series / gpt-5 family)
// reject a custom `temperature` with a 400. Every route here passes one, so if
// the user picks such a model in Settings, retry once without temperature
// instead of failing the whole feature.
async function postChatCompletion(apiKey: string, body: Record<string, unknown>, timeoutMs: number): Promise<Response> {
  const send = (payload: Record<string, unknown>) =>
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

  const res = await send(body);
  if (res.status === 400 && 'temperature' in body) {
    const errText = await res.clone().text();
    if (/temperature/i.test(errText)) {
      const withoutTemperature: Record<string, unknown> = { ...body };
      delete withoutTemperature.temperature;
      return send(withoutTemperature);
    }
  }
  return res;
}

export async function callOpenAIJSON(opts: {
  system: string;
  user: string;
  timeoutMs?: number;
  temperature?: number;
  model?: string;
}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = await resolveChatModel(opts.model);

  let res: Response;
  try {
    res = await postChatCompletion(
      apiKey,
      {
        model,
        temperature: opts.temperature ?? 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user }
        ]
      },
      opts.timeoutMs ?? 45000
    );
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`AI provider timed out after ${(opts.timeoutMs ?? 45000) / 1000}s`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling AI provider', 502);
  }

  if (!res.ok) {
    throw await toProviderError(res, 'OpenAI');
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new AIProviderError('AI provider returned no content', 502);
  }

  return { text, model };
}

// Vision-capable JSON-mode call for Video Analyzer — sends the transcript plus
// N sampled frames (as base64 data URLs) in one request. MASTER_PROMPT_V2
// "Cost Control": batch vision where possible, transcript once.
export async function callOpenAIVisionJSON(opts: {
  system: string;
  user: string;
  images: string[]; // data URLs, e.g. `data:image/jpeg;base64,...`
  timeoutMs?: number;
  temperature?: number;
  model?: string;
}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = await resolveChatModel(opts.model);

  const content: any[] = [{ type: 'text', text: opts.user }];
  for (const image of opts.images) {
    content.push({ type: 'image_url', image_url: { url: image } });
  }

  let res: Response;
  try {
    res = await postChatCompletion(
      apiKey,
      {
        model,
        temperature: opts.temperature ?? 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content }
        ]
      },
      opts.timeoutMs ?? 180000
    );
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`AI provider timed out after ${(opts.timeoutMs ?? 180000) / 1000}s`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling AI provider', 502);
  }

  if (!res.ok) {
    throw await toProviderError(res, 'OpenAI');
  }

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new AIProviderError('AI provider returned no content', 502);
  }

  return { text, model };
}

// Audio transcription via OpenAI's /v1/audio/transcriptions endpoint.
// Default model per current OpenAI lineup: gpt-4o-mini-transcribe (whisper-1
// as a stable fallback if the account/model isn't available).
export async function transcribeAudio(opts: { fileBuffer: Buffer; filename: string; model?: string; timeoutMs?: number }): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || process.env.TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

  const form = new FormData();
  // Uint8Array (not Node's Buffer subtype) is what TS's BlobPart type expects
  // in strict mode — Buffer<ArrayBufferLike> doesn't structurally match.
  form.append('file', new Blob([new Uint8Array(opts.fileBuffer)]), opts.filename);
  form.append('model', model);

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`Transcription timed out after ${(opts.timeoutMs ?? 120000) / 1000}s`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling transcription provider', 502);
  }

  if (!res.ok) {
    throw await toProviderError(res, 'OpenAI Transcription');
  }

  const json = await res.json();
  const text = json.text;
  if (typeof text !== 'string') {
    throw new AIProviderError('Transcription provider returned no text', 502);
  }

  return { text, model };
}

// Text-to-speech via /v1/audio/speech — added for the standalone Voiceover
// tool, explicit user request ("พากย์เสียงอัตโนมัติ ... เลือกเสียงได้
// ผู้ชาย ผู้หญิง กำหนดโทนเสียงได้"). Uses gpt-4o-mini-tts, OpenAI's newest
// TTS model — the only one that honors the `instructions` field for
// natural-language tone/style/accent/speed steering (tts-1/tts-1-hd ignore
// it entirely), which is what gives us "กำหนดโทนเสียงได้" without needing a
// second provider. Reuses the same OPENAI_API_KEY already configured for
// every other AI call in this app — zero new setup.
export const TTS_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable',
  'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

export async function generateSpeech(opts: {
  text: string;
  voice: TtsVoice;
  instructions?: string;
  model?: string;
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
  timeoutMs?: number;
}): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || 'gpt-4o-mini-tts';
  const format = opts.format || 'mp3';

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        voice: opts.voice,
        input: opts.text,
        instructions: opts.instructions || undefined,
        response_format: format
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`สร้างเสียงพากย์ใช้เวลานานเกินไป (timeout)`, 504);
    }
    throw new AIProviderError(err?.message || 'เชื่อมต่อ OpenAI TTS ไม่สำเร็จ', 502);
  }

  if (!res.ok) {
    throw await toProviderError(res, 'OpenAI TTS');
  }

  const contentTypeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    opus: 'audio/opus',
    aac: 'audio/aac',
    flac: 'audio/flac',
    wav: 'audio/wav'
  };

  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: contentTypeMap[format] };
}

export interface TranscribedWord {
  word: string;
  start: number;
  end: number;
}

// Word-level timestamps for punchy-subtitle generation (Editor tool). Uses
// whisper-1 specifically — as of writing, that's the only transcription
// model on the /v1/audio/transcriptions endpoint that honors
// timestamp_granularities=word; gpt-4o(-mini)-transcribe only return text.
// Real per-word start/end (not averaged over character count) is what lets
// the punchy-subtitle prompt group words into cues without ever having to
// fake timing.
export async function transcribeAudioWithTimestamps(opts: {
  fileBuffer: Buffer;
  filename: string;
  model?: string;
  timeoutMs?: number;
}): Promise<{ text: string; words: TranscribedWord[]; durationSec: number; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || 'whisper-1';

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(opts.fileBuffer)]), opts.filename);
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`Transcription timed out after ${(opts.timeoutMs ?? 180000) / 1000}s`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling transcription provider', 502);
  }

  if (!res.ok) {
    throw await toProviderError(res, 'OpenAI Transcription');
  }

  const json = await res.json();
  const text = json.text;
  const words = Array.isArray(json.words)
    ? json.words.map((w: any) => ({ word: String(w.word ?? ''), start: Number(w.start ?? 0), end: Number(w.end ?? 0) }))
    : [];
  if (typeof text !== 'string' || words.length === 0) {
    throw new AIProviderError('Transcription provider returned no word-level timestamps — model may not support timestamp_granularities', 502);
  }

  return { text, words, durationSec: Number(json.duration ?? 0), model };
}

// Web search via the OpenAI Responses API (built-in `web_search` tool). Used
// by Content Studio's Trend Scout step: current nail trends and upcoming
// dates must come from real, linkable sources, never from the model's memory.
// Returns the model's text plus every URL it cited. Model: AI_SEARCH_MODEL,
// else the Settings/env chat model. Older accounts/models only know the
// `web_search_preview` tool, so a 400 retries once with that.
export async function callOpenAIWebSearch(opts: {
  instructions: string;
  input: string;
  timeoutMs?: number;
  model?: string;
}): Promise<{ text: string; sources: { title: string; url: string }[]; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured in .env.local', 500);
  }
  const model = opts.model || process.env.AI_SEARCH_MODEL || (await resolveChatModel());
  const timeoutMs = opts.timeoutMs ?? 60000;
  const send = (tool: string) =>
    fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, instructions: opts.instructions, input: opts.input, tools: [{ type: tool }] }),
      signal: AbortSignal.timeout(timeoutMs)
    });

  let res: Response;
  try {
    res = await send('web_search');
    if (res.status === 400) res = await send('web_search_preview');
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`ค้นเทรนด์นานเกิน ${timeoutMs / 1000} วินาที`, 504);
    }
    throw new AIProviderError(err?.message || 'Unknown error calling AI provider', 502);
  }
  if (!res.ok) {
    throw await toProviderError(res, 'OpenAI');
  }

  const json = await res.json();
  let text = '';
  const seen = new Map<string, string>();
  for (const item of json.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c?.type !== 'output_text') continue;
      text += (text ? '\n' : '') + (c.text ?? '');
      for (const a of c.annotations ?? []) {
        if (a?.type === 'url_citation' && typeof a.url === 'string' && !seen.has(a.url)) seen.set(a.url, a.title || a.url);
      }
    }
  }
  if (!text.trim()) {
    throw new AIProviderError('ค้นเทรนด์ไม่ได้ผลลัพธ์', 502);
  }
  return { text: text.trim(), sources: [...seen].map(([url, title]) => ({ url, title })), model };
}
