// ElevenLabs Text-to-Speech — second Voiceover engine, added alongside
// OpenAI TTS specifically so the user's own ElevenLabs voice CLONE(S) can be
// used, not for its preset voice library. User already created the clone(s)
// on elevenlabs.io themselves; this only calls the existing voice by ID —
// it never creates/trains a voice.
//
// API contract verified directly against ElevenLabs' own docs
// (elevenlabs.io/docs/api-reference/text-to-speech/convert) before writing
// this, not guessed:
//   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
//   headers: xi-api-key, Content-Type: application/json
//   body: { text, model_id }
//   response: raw audio bytes (mp3), NOT JSON, on success.
//
// Needs ELEVENLABS_API_KEY set in Vercel Environment Variables — the key
// itself is never handled by this app's UI/chat, only entered directly in
// Vercel's dashboard by the user.

import { AIProviderError } from './openai';

export async function generateSpeechElevenLabs(opts: { text: string; voiceId: string; modelId?: string; timeoutMs?: number }): Promise<{ buffer: Buffer; contentType: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('ยังไม่ได้ตั้งค่า ELEVENLABS_API_KEY — เพิ่มใน Vercel Project Settings → Environment Variables ก่อนใช้เสียงโคลนจาก ElevenLabs', 500);
  }
  const voiceId = opts.voiceId.trim();
  if (!voiceId) {
    throw new AIProviderError('ต้องระบุ Voice ID ของเสียงโคลนใน ElevenLabs', 400);
  }
  // eleven_multilingual_v2 covers Thai among its ~29 languages; overridable
  // via env var in case a newer/better model turns out to fit Thai clones
  // better once the user tests real output.
  const modelId = opts.modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: modelId
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError(`สร้างเสียงพากย์ (ElevenLabs) ใช้เวลานานเกินไป (timeout)`, 504);
    }
    throw new AIProviderError(err?.message || 'เชื่อมต่อ ElevenLabs ไม่สำเร็จ', 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    // Common real cases worth surfacing clearly instead of a raw JSON dump:
    // 401 = bad/missing API key, 404 = voice_id doesn't exist or wrong
    // account, 422 = text/params rejected.
    throw new AIProviderError(`สร้างเสียงพากย์ (ElevenLabs) ไม่สำเร็จ (${res.status}): ${errText.slice(0, 400)}`, res.status === 401 || res.status === 404 ? res.status : 502);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: 'audio/mpeg' };
}
