-- Additive: standalone Voiceover (text-to-speech) tool, added beyond
-- MASTER_PROMPT_V2 scope, explicit user request ("เพิ่มโปรแกรมพากย์เสียง
-- อัตโนมัติ... เลือกเสียงได้ ผู้ชาย ผู้หญิง กำหนดโทนเสียงได้ มีตัวอย่างให้
-- ฟัง คล้ายๆ Text to speech Google AI studio"). Uses OpenAI's
-- gpt-4o-mini-tts (see lib/ai/openai.ts: generateSpeech) — same engine as
-- every other AI call in this app, no new provider/API key. Standalone tool
-- for round 1 (not yet wired into Editor as an auto-dub replacing a video's
-- own audio track — that's a separate, larger follow-up).
--
-- Reuses the existing private "edited-clips" storage bucket (already
-- generic on content type via lib/supabase/storage.ts: uploadEditedClip) —
-- no new bucket needed. Same history/persistence pattern as every other
-- generation tool in this app (ideas/scripts/storyboards/flow_prompts/
-- editor_jobs): save a row so past generations can be revisited/re-listened
-- without re-calling the AI.

create table if not exists voiceover_jobs (
  id uuid primary key default uuid_generate_v4(),
  input_text text not null,
  voice text not null,
  instructions text,
  model text not null default 'gpt-4o-mini-tts',
  format text not null default 'mp3',
  result_path text,           -- path inside the "edited-clips" storage bucket
  char_count integer not null default 0,
  creator_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_voiceover_jobs_creator on voiceover_jobs(creator_id);

alter table voiceover_jobs enable row level security;

drop policy if exists "voiceover_jobs_select" on voiceover_jobs;
drop policy if exists "voiceover_jobs_insert" on voiceover_jobs;
drop policy if exists "voiceover_jobs_delete" on voiceover_jobs;

create policy "voiceover_jobs_select" on voiceover_jobs for select using (auth.role() = 'authenticated');
create policy "voiceover_jobs_insert" on voiceover_jobs for insert with check (public.current_role() <> 'viewer');
create policy "voiceover_jobs_delete" on voiceover_jobs for delete using (public.current_role() in ('admin','owner'));
