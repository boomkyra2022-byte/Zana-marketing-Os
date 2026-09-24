-- ZANA AI Video Prompt Studio — P0 (Prompt Compiler + Product Lock).
-- New, standalone module — deliberately NOT an upgrade of Flow Prompt
-- Director (0009/0011), per explicit user decision when the two options
-- were presented. Purely additive: two new tables, no existing table
-- touched. Spec doc: "ZANA AI Video Prompt Studio — Spec & Build Plan"
-- (Claude Docs, 2026-09-24).

-- Layer 2 "Custom Variables" (Character/Funnel/Visual/Text/Voice/Scene
-- Engine option groups) are stored as one `variables` jsonb blob rather
-- than ~20 individual columns — the option list is still being tuned
-- (Skincare Engine, Auto Best Mode, Custom Director are P1-P3), so a new
-- dropdown later is a client + prompt-builder change only, not a
-- migration. creative_mode/funnel_stage/duration_sec/scene_count are kept
-- as real columns because Mode-specific Creative Score (P4) and future
-- reporting need to filter/group on them directly.
create table if not exists video_prompt_projects (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  model_preset_id uuid references model_presets(id),
  creative_mode text not null,
  funnel_stage text,
  character_mode text,
  character_persona text,
  duration_sec integer,
  scene_count integer,
  pacing text,
  visual_quality text,
  variables jsonb not null default '{}'::jsonb, -- character age/persona detail, text system, voice system, scene engine (auto/custom + per-scene overrides), skincare engine fields
  compiled_prompt text, -- the assembled Master Prompt — copy-paste output, no video-gen API call in P0
  status text not null default 'draft' check (status in ('draft', 'generated')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_prompt_projects_product on video_prompt_projects(product_id);
create index if not exists idx_video_prompt_projects_creative_mode on video_prompt_projects(creative_mode);

-- One-click presets (spec section 13) — seeded as data below, not hardcoded
-- client branches, so adding a 6th preset later needs no redeploy. Same
-- shape/pattern as prompt_studio_presets (0020_visual_hook_banner.sql) but
-- a separate table: that one saves Visual Hook Banner's 16 image-prompt
-- blocks, this one saves this module's `variables` jsonb — different
-- shapes, kept apart rather than overloaded behind a shared `mode` column.
create table if not exists video_prompt_presets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  variables jsonb not null default '{}'::jsonb,
  is_system_default boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_video_prompt_presets_default on video_prompt_presets(is_system_default);

alter table video_prompt_projects enable row level security;
alter table video_prompt_presets enable row level security;

drop policy if exists "video_prompt_projects_select" on video_prompt_projects;
drop policy if exists "video_prompt_projects_write" on video_prompt_projects;
create policy "video_prompt_projects_select" on video_prompt_projects for select using (auth.role() = 'authenticated');
create policy "video_prompt_projects_write" on video_prompt_projects for insert with check (public.current_role() <> 'viewer');

drop policy if exists "video_prompt_presets_select" on video_prompt_presets;
drop policy if exists "video_prompt_presets_write" on video_prompt_presets;
create policy "video_prompt_presets_select" on video_prompt_presets for select using (auth.role() = 'authenticated');
create policy "video_prompt_presets_write" on video_prompt_presets for insert with check (public.current_role() <> 'viewer');

-- ── 5 seeded presets (spec section 13) ─────────────────────────────────
-- Preset 02 is the user's own "Hero Preset" ("เหมาะกับงาน ZANA มากที่สุด") —
-- marked is_system_default so the picker (P1) surfaces it first.
insert into video_prompt_presets (name, variables, is_system_default)
select 'UGC No Face Sales', '{
  "character_mode": "No Face / Hands Only",
  "voice_gender": "Thai Male",
  "duration_sec": 10,
  "scene_count": 6,
  "script_length_words": 30,
  "pacing": "High Retention",
  "text_mode": "Native UGC",
  "transition_speed": "Fast",
  "environment": "Lifestyle location",
  "funnel_stage": "Conversion"
}'::jsonb, false
where not exists (select 1 from video_prompt_presets where name = 'UGC No Face Sales');

insert into video_prompt_presets (name, variables, is_system_default)
select 'Skincare Social x TV', '{
  "character_mode": "Hands / Body Crop",
  "voice_gender": "Thai Male/Female",
  "duration_sec": 10,
  "scene_count": 6,
  "creative_mode": "Social x TV Hybrid",
  "pacing": "Balanced Fast",
  "lighting": "Beauty lighting",
  "texture_mode": "Macro texture",
  "skin_finish": "Skin glow",
  "ingredient_visualization": "Ingredient visualization",
  "text_mode": "Premium text",
  "ending_type": "Packshot ending"
}'::jsonb, true
where not exists (select 1 from video_prompt_presets where name = 'Skincare Social x TV');

insert into video_prompt_presets (name, variables, is_system_default)
select 'Skincare Premium TVC', '{
  "creative_mode": "Premium TV Commercial",
  "duration_sec": 15,
  "scene_count": 6,
  "pacing": "Premium",
  "voice_style": "Soft Luxury",
  "text_mode": "Minimal TVC",
  "texture_mode": "Macro liquid",
  "scene_focus": "Skin application",
  "ingredient_visualization": "Ingredient metaphor",
  "ending_type": "Hero packshot"
}'::jsonb, false
where not exists (select 1 from video_prompt_presets where name = 'Skincare Premium TVC');

insert into video_prompt_presets (name, variables, is_system_default)
select 'Product Demo', '{
  "character_mode": "Hands only",
  "duration_sec": 10,
  "scene_count": 6,
  "creative_mode": "Product Demonstration",
  "camera_style": "Close-up",
  "content_focus": "Instructions",
  "text_frequency": "Every Scene",
  "voice_style": "Educational"
}'::jsonb, false
where not exists (select 1 from video_prompt_presets where name = 'Product Demo');

insert into video_prompt_presets (name, variables, is_system_default)
select 'Hard Conversion', '{
  "duration_sec": 10,
  "scene_count": 6,
  "creative_mode": "Direct Response Conversion",
  "funnel_stage": "Conversion",
  "hook_style": "Hook under 1 sec",
  "funnel_structure": "Pain -> Reason -> Product -> Proof -> CTA",
  "pacing": "Fast Viral",
  "text_mode": "TikTok Hook",
  "voice_style": "Creator",
  "ending_type": "Direct-response ending"
}'::jsonb, false
where not exists (select 1 from video_prompt_presets where name = 'Hard Conversion');
