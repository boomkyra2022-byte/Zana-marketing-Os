// MiniMax Text-to-Audio (T2A v2) — third Voiceover engine, added alongside
// OpenAI TTS and ElevenLabs specifically so the user's own MiniMax voice
// CLONE(S) can be used. User already created the clone(s) on MiniMax's own
// platform themselves; this only calls the existing voice by ID.
//
// API contract verified directly against MiniMax's own OpenAPI spec
// (platform.minimax.io/docs/api-reference/speech-t2a-http) before writing
// this, not guessed:
//   POST https://api.minimax.io/v1/t2a_v2
//   headers: Authorization: Bearer <api_key>  (no separate GroupId needed
//   for this endpoint — some of MiniMax's OTHER endpoints, e.g. voice
//   upload/cloning itself, do need one, but T2A v2 synthesis does not)
//   body: { model, text, voice_setting: { voice_id, speed, vol, pitch },
//           output_format: 'hex', audio_setting: {...} }
//   response: JSON — { data: { audio: <hex-encoded audio> }, base_resp: {...} }
//   (audio comes back hex-encoded, not raw bytes or base64 — must decode
//   with Buffer.from(hex, 'hex'))
//
// Needs MINIMAX_API_KEY set in Vercel Environment Variables — the key
// itself is never handled by this app's UI/chat, only entered directly in
// Vercel's dashboard by the user.

import { AIProviderError } from './openai';

export async function generateSpeechMinimax(opts: { text: string; voiceId: string; model?: string; timeoutMs?: number }): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('ยังไม่ได้ตั้งค่า MINIMAX_API_KEY — เพิ่มใน Vercel Project Settings → Environment Variables ก่อนใช้เสียงโคลนจาก MiniMax', 500);
  }
  const voiceId = opts.voiceId.trim();
  if (!voiceId) {
    throw new AIProviderError('ต้องระบุ Voice ID ของเสียงโคลนใน MiniMax', 400);
  }
  // speech-2.8-hd's language_boost list explicitly includes Thai.
  const model = opts.model || process.env.MINIMAX_MODEL || 'speech-2.8-hd';

  let res: Response;
  try {
    res = await fetch('https://api.minimax.io/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        text: opts.text,
        stream: false,
        language_boost: 'auto',
        output_format: 'hex',
        voice_setting: {
          voice_id: voiceId,
          speed: 1,
          vol: 1,
          pitch: 0
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: 'mp3',
          channel: 1
        }
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`สร้างเสียงพากย์ (MiniMax) ใช้เวลานานเกินไป (timeout)`, 504);
    }
    throw new AIProviderError(err?.message || 'เชื่อมต่อ MiniMax ไม่สำเร็จ', 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new AIProviderError(`สร้างเสียงพากย์ (MiniMax) ไม่สำเร็จ (${res.status}): ${errText.slice(0, 400)}`, 502);
  }

  const json: any = await res.json();
  // MiniMax returns HTTP 200 even for many application-level errors — the
  // real status lives in base_resp.status_code (0 = success). Must check
  // this explicitly or a failed call would silently produce an empty/broken
  // audio file instead of a readable error.
  if (json?.base_resp?.status_code && json.base_resp.status_code !== 0) {
    throw new AIProviderError(`สร้างเสียงพากย์ (MiniMax) ไม่สำเร็จ: ${json.base_resp.status_msg || `status_code ${json.base_resp.status_code}`}`, 502);
  }
  const hex = json?.data?.audio;
  if (typeof hex !== 'string' || hex.length === 0) {
    throw new AIProviderError('MiniMax ไม่ได้คืนค่าเสียงกลับมา', 502);
  }

  return { buffer: Buffer.from(hex, 'hex'), contentType: 'audio/mpeg' };
}
