-- Additive: multi-provider Voiceover support (ElevenLabs / MiniMax voice
-- cloning), explicit user request — "ฉันสร้างเสียงโคลนตัวเองไว้ใน Elevenlab
-- และ Minimax ต้องการเชื่อมต่อเข้าโปรแกรม". OpenAI TTS (the original engine,
-- 0012_voiceover_jobs.sql) stays the default; this just lets a job record
-- which engine actually generated it, and adds a human-readable label for
-- custom voice_id-based clones (OpenAI's preset voice names are already
-- readable as-is, e.g. "coral" — a raw ElevenLabs/MiniMax voice_id is not).
alter table voiceover_jobs add column if not exists provider text not null default 'openai';
alter table voiceover_jobs add column if not exists voice_label text;
