-- Additive migration for the Editor tool's "Auto Shorts" mode — explicit
-- user request, approved after reviewing github.com/backblaze-b2-samples/
-- ai-shorts-generator as reference for the "long video -> AI picks best
-- moments -> N vertical clips" workflow. No existing column/table touched or
-- narrowed; only new nullable columns + a widened check constraint.
--
-- One AUTO_SHORTS run produces N clips. Rather than a new table, each clip
-- gets its own editor_jobs row (same result_path/result_kind/status shape
-- every other operation already uses) sharing a batch_id — keeps the
-- existing job model, RLS policies, and UI (job history table) working
-- unchanged for every other operation.

alter table editor_jobs add column if not exists batch_id uuid;
alter table editor_jobs add column if not exists clip_index int;
alter table editor_jobs add column if not exists clip_start_sec numeric(10,2);
alter table editor_jobs add column if not exists clip_end_sec numeric(10,2);
alter table editor_jobs add column if not exists clip_title text;
alter table editor_jobs add column if not exists clip_reason text;
alter table editor_jobs add column if not exists clip_hook_score int;

create index if not exists idx_editor_jobs_batch on editor_jobs(batch_id);

-- Widen the operation check constraint (last widened in
-- 0010_dewatermark_local_operation.sql) to add AUTO_SHORTS. Postgres has no
-- "alter check constraint" — drop + recreate with the same name, still an
-- inclusive superset so nothing already written becomes invalid.
alter table editor_jobs drop constraint if exists editor_jobs_operation_check;
alter table editor_jobs add constraint editor_jobs_operation_check
  check (operation in ('SILENCE_CUT','RENDER','SUBTITLE_SRT','DEWATERMARK','PUNCHY_SRT','DEWATERMARK_LOCAL','AUTO_SHORTS'));
