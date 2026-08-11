-- Additive: local (Tamsub-free) dewatermark fallback, added because the
-- team's current Tamsub plan doesn't include the dewatermark feature
-- (confirmed via a real 403 "account not eligible" response). Uses
-- ffmpeg's delogo filter locally (blur/interpolate a fixed corner region)
-- instead — an honest, non-AI fallback, not a Tamsub-quality replacement.

alter table editor_jobs drop constraint if exists editor_jobs_operation_check;
alter table editor_jobs add constraint editor_jobs_operation_check
  check (operation in ('SILENCE_CUT','RENDER','SUBTITLE_SRT','DEWATERMARK','PUNCHY_SRT','DEWATERMARK_LOCAL'));
