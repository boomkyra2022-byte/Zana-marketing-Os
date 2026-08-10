-- Additive migration for the "Editor" tool (silence-cut / subtitle burn-in /
-- SRT export / dewatermark) added beyond MASTER_PROMPT_V2's original 25-item
-- scope, per explicit user request. No existing table/column touched.

create table if not exists editor_jobs (
  id uuid primary key default uuid_generate_v4(),
  operation text not null check (operation in ('SILENCE_CUT','RENDER','SUBTITLE_SRT','DEWATERMARK')),
  source_url text not null,
  template_id text,
  options jsonb default '{}'::jsonb,
  product_id uuid references products(id),
  result_path text,        -- path inside the private "edited-clips" storage bucket
  result_kind text check (result_kind in ('VIDEO','SRT')),
  srt_text text,           -- populated directly for SUBTITLE_SRT (small, no need to round-trip storage)
  removed_seconds numeric(10,2),
  status text not null default 'PENDING'
    check (status in ('PENDING','DOWNLOADING','PROCESSING','UPLOADING','DONE','FAILED')),
  error text,
  tamsub_meta jsonb,
  creator_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_editor_jobs_creator on editor_jobs(creator_id);
create index if not exists idx_editor_jobs_status on editor_jobs(status);

alter table editor_jobs enable row level security;

drop policy if exists "editor_jobs_select" on editor_jobs;
drop policy if exists "editor_jobs_insert" on editor_jobs;
drop policy if exists "editor_jobs_update" on editor_jobs;
drop policy if exists "editor_jobs_delete" on editor_jobs;

create policy "editor_jobs_select" on editor_jobs for select using (auth.role() = 'authenticated');
create policy "editor_jobs_insert" on editor_jobs for insert with check (public.current_role() <> 'viewer');
create policy "editor_jobs_update" on editor_jobs for update using (public.current_role() <> 'viewer');
create policy "editor_jobs_delete" on editor_jobs for delete using (public.current_role() in ('admin','owner'));

-- Private storage bucket for Tamsub result files. All reads/writes go through
-- the service-role client (server-only) + short-lived signed URLs handed to
-- the browser — no public access, no client-side storage policy needed.
insert into storage.buckets (id, name, public)
values ('edited-clips', 'edited-clips', false)
on conflict (id) do nothing;
