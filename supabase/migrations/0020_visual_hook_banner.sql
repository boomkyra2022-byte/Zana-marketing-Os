-- Visual Hook Banner mode — Phase 1 of the new Creative Brief -> AI Visual
-- Ideas -> Prompt Studio -> Generation Destination workflow (explicit user
-- spec). Scoped down per the user's own choice when asked: build ONE mode
-- fully first (Visual Hook Banner), Model Identity is a free-text field for
-- now (no Model Library yet — that's Phase 2, along with Packshot storage
-- for Professional Composite Mode). Purely additive — no existing table
-- touched.

-- AI-generated visual concepts from the Creative Brief step. Persisted (not
-- just returned to the client) so "บันทึก" in the spec is real, and so a
-- history/reuse panel is possible later the same way ideas/scripts already
-- have one.
create table if not exists visual_ideas (
  id uuid primary key default uuid_generate_v4(),
  mode text not null default 'visual_hook_banner',
  product_id uuid references products(id),
  brief jsonb not null default '{}'::jsonb, -- full Creative Brief snapshot (model identity, funnel, platform, objective, audience, pain, benefit, proof, promotion, content style, hook strength, ratio)
  title text not null,
  funnel_stage text,
  creative_angle text,
  visual_hook text,
  scene text,
  situation text,
  pain_point text,
  emotion text,
  solution text,
  benefit text,
  proof text,
  text_hook text,
  supporting_text text,
  offer text,
  cta text,
  layout text,
  expected_strength text, -- 'Safe' | 'Strong' | 'Unexpected'
  status text not null default 'IDEA',
  owner_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_visual_ideas_product on visual_ideas(product_id);
create index if not exists idx_visual_ideas_mode on visual_ideas(mode);

-- Prompt Studio block configurations, saved by name for reuse across
-- products/sessions ("บันทึกเป็น Preset" per Block in the spec).
create table if not exists prompt_studio_presets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  mode text not null default 'visual_hook_banner',
  blocks jsonb not null default '{}'::jsonb, -- { blockKey: { enabled: bool, text: string } }
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Real usage/cost audit trail for every "Generate Inside ZANA OS" call,
-- across whichever mode/provider — matches the GenerationLog shape in the
-- spec. estimated_cost is computed from published per-image pricing at
-- request time; actual_cost is left null until/unless a provider gives back
-- real billing data (OpenAI's Images API does not return per-call cost).
create table if not exists generation_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  project_id uuid, -- reserved for future project/campaign grouping, unused for now
  mode text not null,
  provider text not null,
  model text not null,
  prompt_version text,
  prompt_text text,
  image_count integer not null default 0,
  estimated_cost numeric(10,4),
  actual_cost numeric(10,4),
  status text not null default 'success' check (status in ('success','partial','failed')),
  error text,
  result_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_generation_logs_user on generation_logs(user_id);
create index if not exists idx_generation_logs_mode on generation_logs(mode);

alter table visual_ideas enable row level security;
alter table prompt_studio_presets enable row level security;
alter table generation_logs enable row level security;

drop policy if exists "visual_ideas_select" on visual_ideas;
drop policy if exists "visual_ideas_write" on visual_ideas;
create policy "visual_ideas_select" on visual_ideas for select using (auth.role() = 'authenticated');
create policy "visual_ideas_write" on visual_ideas for insert with check (public.current_role() <> 'viewer');

drop policy if exists "prompt_studio_presets_select" on prompt_studio_presets;
drop policy if exists "prompt_studio_presets_write" on prompt_studio_presets;
create policy "prompt_studio_presets_select" on prompt_studio_presets for select using (auth.role() = 'authenticated');
create policy "prompt_studio_presets_write" on prompt_studio_presets for insert with check (public.current_role() <> 'viewer');

drop policy if exists "generation_logs_select" on generation_logs;
drop policy if exists "generation_logs_write" on generation_logs;
create policy "generation_logs_select" on generation_logs for select using (auth.role() = 'authenticated');
create policy "generation_logs_write" on generation_logs for insert with check (auth.role() = 'authenticated');
