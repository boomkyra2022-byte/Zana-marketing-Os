-- Additive: widen editor_jobs.operation to allow 'PUNCHY_SRT' — a subtitle
-- pipeline that bypasses Tamsub entirely (own Whisper word-timestamps + GPT
-- cue-grouping) so we control the exact Thai segmentation/spacing rules the
-- user specified (no average-time word splitting, connector words merged
-- into neighboring cues, no HTML in the .srt, full timing coverage).

alter table editor_jobs drop constraint if exists editor_jobs_operation_check;
alter table editor_jobs add constraint editor_jobs_operation_check
  check (operation in ('SILENCE_CUT','RENDER','SUBTITLE_SRT','DEWATERMARK','PUNCHY_SRT'));
