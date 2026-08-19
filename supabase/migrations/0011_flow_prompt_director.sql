-- Additive only: extends the existing flow_prompts table (from the earlier
-- "Gen Prompt" v1 feature) to back the new "Flow Prompt Director" feature.
-- NOTHING is dropped, renamed, or made non-nullable. Old columns
-- (video_concept / video_flow / scenes / inputs) are left exactly as-is for
-- backward compatibility with any v1 rows already saved.
--
-- New columns added (all nullable or defaulted so existing rows stay valid):
--   project_name    text            - user-given name when saving a project
--   persona_id      uuid FK         - optional persona link (mirrors product_id)
--   source_type     text            - MANUAL | IDEA | SCRIPT | STORYBOARD | KNOWLEDGE | PRODUCT | PERSONA
--   source_id       uuid            - id of the source row when not MANUAL
--   content_input   text            - raw brief / rewritten content the user typed or that was pulled from source
--   platform        text            - TikTok / Facebook Reels / Instagram Reels / Marketplace / YouTube Shorts
--   aspect_ratio    text            - 9:16 / 1:1 / 16:9
--   duration_sec    integer         - total video duration (must be a multiple of 10 per the "10s = 1 prompt" rule)
--   prompt_count    integer         - duration_sec / 10, cached for display
--   objective       text            - funnel objective (Awareness/Consideration/Conversion/Retention)
--   primary_goal    text            - concrete conversion goal (Purchase/Booking Form/DM/Line Add/etc.)
--   style           jsonb           - array of selected video style tags, or ["AUTO"]
--   script_mode     text            - AUTO_SCRIPT | IMPROVE_SCRIPT | EXACT_SCRIPT
--   analysis        jsonb           - Content Analysis card data (editable by user before generation)
--   story_flow      jsonb           - ordered story-flow steps
--   continuity_bible jsonb          - product/character/visual continuity data, repeated into every PART
--   locks           jsonb           - which fields/parts are locked against regeneration
--   parts           jsonb           - array of 10-sec PART master-prompt objects (replaces the old flat "scenes")
--   version         integer         - increments on every full regenerate, for basic history awareness
--   status          text            - DRAFT | GENERATED | SAVED
--   updated_at      timestamptz     - bumped on every save/regenerate

alter table flow_prompts add column if not exists project_name text;
alter table flow_prompts add column if not exists persona_id uuid references personas(id);
alter table flow_prompts add column if not exists source_type text;
alter table flow_prompts add column if not exists source_id uuid;
alter table flow_prompts add column if not exists content_input text;
alter table flow_prompts add column if not exists platform text default 'TikTok';
alter table flow_prompts add column if not exists aspect_ratio text default '9:16';
alter table flow_prompts add column if not exists duration_sec integer default 30;
alter table flow_prompts add column if not exists prompt_count integer default 3;
alter table flow_prompts add column if not exists objective text;
alter table flow_prompts add column if not exists primary_goal text;
alter table flow_prompts add column if not exists style jsonb default '[]'::jsonb;
alter table flow_prompts add column if not exists script_mode text default 'AUTO_SCRIPT';
alter table flow_prompts add column if not exists analysis jsonb;
alter table flow_prompts add column if not exists story_flow jsonb;
alter table flow_prompts add column if not exists continuity_bible jsonb;
alter table flow_prompts add column if not exists locks jsonb default '{}'::jsonb;
alter table flow_prompts add column if not exists parts jsonb;
alter table flow_prompts add column if not exists version integer not null default 1;
alter table flow_prompts add column if not exists status text default 'DRAFT';
alter table flow_prompts add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_flow_prompts_persona on flow_prompts(persona_id);
create index if not exists idx_flow_prompts_source on flow_prompts(source_type, source_id);

-- RLS policies already cover select/insert/delete on the table (from 0009).
-- Add an explicit update policy (0009 never defined one, so updates were
-- implicitly blocked) so users can save edits / regenerate parts on their
-- own project rows.
drop policy if exists "flow_prompts_update" on flow_prompts;
create policy "flow_prompts_update" on flow_prompts for update
  using (public.current_role() <> 'viewer')
  with check (public.current_role() <> 'viewer');
