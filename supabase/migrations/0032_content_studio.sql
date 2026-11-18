-- Content Studio — per-client content library for JANGZANA (จ้างซาน่า).
-- Explicit user request 2026-11-17/18: "ทุกครั้งได้งานลูกค้าใหม่ก็ต้องมาคีย์คำสั่ง
-- อยากทำเป็นเว็บ" — one Brand Card per client (filled once), AI writes content
-- in that client's voice, and every piece is kept in a per-client library with
-- a status (draft / approved / used). Approved pieces are fed back as style
-- examples. 2026-11-18 upgrade: content positioning on the Brand Card, a
-- funnel stage per piece, and a retention checklist score per piece.
--
-- Purely additive: two new tables, nothing existing is touched.

create table if not exists studio_clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business text,
  audience text,
  pains text,
  usp text,
  positioning text,      -- content positioning: where this brand stands vs others in its market
  offer text,            -- current promo/price — the ONLY place AI may take a price from
  voice text,
  pillars text,
  cta text,
  banned text,
  examples text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studio_posts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references studio_clients(id) on delete cascade,
  format text not null,
  funnel text,           -- tofu / mofu / bofu
  title text not null,
  body text not null,
  topic text,
  retention jsonb,       -- {score: 0-10, checks: [{name, pass, fix}]}
  status text not null default 'draft' check (status in ('draft', 'approved', 'used')),
  used_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_posts_client on studio_posts(client_id, created_at desc);
create index if not exists idx_studio_clients_name on studio_clients(name);

alter table studio_clients enable row level security;
alter table studio_posts enable row level security;

drop policy if exists "studio_clients_select" on studio_clients;
drop policy if exists "studio_clients_insert" on studio_clients;
drop policy if exists "studio_clients_update" on studio_clients;
drop policy if exists "studio_clients_delete" on studio_clients;
create policy "studio_clients_select" on studio_clients for select using (auth.role() = 'authenticated');
create policy "studio_clients_insert" on studio_clients for insert with check (public.current_role() <> 'viewer');
create policy "studio_clients_update" on studio_clients for update using (public.current_role() <> 'viewer');
create policy "studio_clients_delete" on studio_clients for delete using (public.current_role() <> 'viewer');

drop policy if exists "studio_posts_select" on studio_posts;
drop policy if exists "studio_posts_insert" on studio_posts;
drop policy if exists "studio_posts_update" on studio_posts;
drop policy if exists "studio_posts_delete" on studio_posts;
create policy "studio_posts_select" on studio_posts for select using (auth.role() = 'authenticated');
create policy "studio_posts_insert" on studio_posts for insert with check (public.current_role() <> 'viewer');
create policy "studio_posts_update" on studio_posts for update using (public.current_role() <> 'viewer');
create policy "studio_posts_delete" on studio_posts for delete using (public.current_role() <> 'viewer');
