// REMOVED per explicit user request ("เอา ElevenLabs/MiniMax ออกเพราะเสี่ยงเรื่อง API
// ที่จะโดยแฮ็กเจาะเข้ามา") — ZANA no longer calls ElevenLabs. Nothing in the app
// imports generateSpeechElevenLabs anymore (see app/api/tools/voiceover/generate/route.ts,
// which now only calls OpenAI TTS). This file is kept as an inert stub —
// rather than a live fetch() to a third-party API with a stored API key —
// so a stray import anywhere would fail loudly instead of silently working.
// Safe to delete this file entirely; it was left in place because this
// session's file tools can't delete files in the connected project folder.

export function generateSpeechElevenLabs(): never {
  throw new Error(
    'ElevenLabs voice cloning ถูกถอดออกจาก ZANA แล้ว (เหตุผลด้านความเสี่ยงของ API key) — ใช้ OpenAI TTS แทน'
  );
}
