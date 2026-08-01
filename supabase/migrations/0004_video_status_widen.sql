-- ZANA Marketing OS V2 — widen videos.status check constraint to match
-- MASTER_PROMPT_V2's Video Analyzer progress states (DOWNLOADING / EXTRACTING).
-- Additive only: existing allowed values are kept, two new ones are added.
-- No data is touched.

alter table videos drop constraint if exists videos_status_check;
alter table videos add constraint videos_status_check check (status in (
  'UPLOADED','DOWNLOADING','PROCESSING','EXTRACTING','TRANSCRIBING','ANALYZING','SCORING','DONE','FAILED'
));
