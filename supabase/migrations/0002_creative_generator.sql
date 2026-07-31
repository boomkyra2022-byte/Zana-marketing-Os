-- ZANA Marketing OS — Creative Generator v1 fields (already applied to the
-- shared Supabase project). Kept here for repo completeness.

alter table scripts add column if not exists hook text;
alter table scripts add column if not exists belief text;
alter table scripts add column if not exists story text;
alter table scripts add column if not exists proof text;
alter table scripts add column if not exists turning_point text;
alter table scripts add column if not exists offer text;
alter table scripts add column if not exists timed_script jsonb;
alter table scripts add column if not exists caption text;
alter table scripts add column if not exists hashtags jsonb default '[]'::jsonb;
alter table scripts add column if not exists thumbnail_text text;

alter table ideas add column if not exists source_type text default 'AI';
alter table ideas add column if not exists generated_at timestamptz default now();
alter table ideas add column if not exists angle text;

create table if not exists storyboards (
  id uuid primary key default uuid_generate_v4(),
  script_id uuid references scripts(id) on delete cascade,
  creative_id text unique,
  title text,
  total_duration_sec numeric(8,2),
  tone_mood text,
  key_message text,
  scenes jsonb not null,
  music_plan jsonb,
  status text default 'DRAFT',
  created_at timestamptz not null default now()
);

create index if not exists idx_storyboards_script on storyboards(script_id);

alter table storyboards enable row level security;

create policy "storyboards_select" on storyboards for select using (auth.role() = 'authenticated');
create policy "storyboards_write" on storyboards for insert with check (public.current_role() <> 'viewer');
create policy "storyboards_update" on storyboards for update using (public.current_role() <> 'viewer');
create policy "storyboards_delete" on storyboards for delete using (public.current_role() in ('admin','owner'));
