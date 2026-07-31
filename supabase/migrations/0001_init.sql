-- ZANA Marketing OS — initial schema + RLS (V1, already applied to the shared Supabase project)
-- Kept here for repo completeness / disaster recovery. Do not re-run against
-- a project where it already succeeded unless starting a brand-new project.

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'viewer'
    check (role in ('admin','owner','content_lead','creator','editor','media_buyer','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  brand text not null,
  sku text unique,
  product_name text not null,
  category text,
  status text not null default 'active',
  selling_price numeric(12,2),
  promotion_price numeric(12,2),
  cogs numeric(12,2),
  commission_rate numeric(8,4),
  shipping_subsidy numeric(12,2),
  usp text,
  ingredients text,
  benefits text,
  usage text,
  customer_objections text,
  allowed_claims text,
  banned_claims text,
  compliance_notes text,
  stock integer,
  is_hero boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists personas (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  age_range text,
  life_stage text,
  pains jsonb default '[]'::jsonb,
  desires jsonb default '[]'::jsonb,
  objections jsonb default '[]'::jsonb,
  triggers jsonb default '[]'::jsonb,
  preferred_language text,
  content_formats jsonb default '[]'::jsonb,
  funnel_notes text,
  created_at timestamptz not null default now()
);

create table if not exists offers (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  price numeric(12,2),
  bundle jsonb,
  voucher text,
  free_gift text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text default 'active',
  created_at timestamptz not null default now()
);

create table if not exists knowledge_items (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  type text not null check (type in (
    'PRODUCT','PERSONA','BRAND','OFFER','CREATIVE_PATTERN','WINNER_LEARNING',
    'LOSER_LEARNING','COMPLIANCE','FAQ','CAMPAIGN','MARKET_INSIGHT'
  )),
  content text not null,
  tags jsonb default '[]'::jsonb,
  product_ids jsonb default '[]'::jsonb,
  persona_ids jsonb default '[]'::jsonb,
  source text,
  confidence numeric(5,2),
  effective_from timestamptz,
  effective_to timestamptz,
  status text default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ideas (
  id uuid primary key default uuid_generate_v4(),
  creative_id text unique,
  title text not null,
  product_id uuid references products(id),
  persona_id uuid references personas(id),
  funnel_stage text,
  creative_format text,
  pain_point text,
  emotional_trigger text,
  hook text,
  visual_concept text,
  product_placement text,
  mood_tone text,
  cta text,
  organic_or_ads text,
  potential_score numeric(5,2),
  stop_scroll_reason text,
  risks text,
  status text default 'IDEA',
  owner_id uuid references profiles(id),
  parent_winner_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists scripts (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid references ideas(id) on delete cascade,
  full_script text,
  shot_list jsonb,
  voice_over text,
  on_screen_text text,
  cta text,
  estimated_duration_sec numeric(8,2),
  production_notes text,
  score numeric(5,2),
  status text default 'DRAFT',
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default uuid_generate_v4(),
  creative_id text unique,
  script_id uuid references scripts(id),
  product_id uuid references products(id),
  storage_path text,
  source_url text,
  mime_type text,
  duration_sec numeric(10,2),
  status text default 'UPLOADED'
    check (status in ('UPLOADED','PROCESSING','TRANSCRIBING','ANALYZING','SCORING','DONE','FAILED')),
  creator_id uuid references profiles(id),
  editor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists video_analysis (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references videos(id) on delete cascade,
  transcript text,
  metadata jsonb,
  frames jsonb,
  timeline_findings jsonb,
  product_appearance jsonb,
  offer_detection jsonb,
  cta_detection jsonb,
  risk_flags jsonb,
  raw_ai_response jsonb,
  provider text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);

create table if not exists creative_scores (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references videos(id) on delete cascade,
  overall_score numeric(5,2),
  verdict text,
  dimension_scores jsonb,
  strengths jsonb,
  weaknesses jsonb,
  recommendations jsonb,
  predicted_funnel jsonb,
  risk_flags jsonb,
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  platform text default 'TikTok',
  campaign_type text,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ad_creatives (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id),
  video_id uuid references videos(id),
  external_ad_id text,
  status text default 'TESTING',
  created_at timestamptz not null default now()
);

create table if not exists performance_daily (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  ad_creative_id uuid references ad_creatives(id),
  spend numeric(12,2) default 0,
  impressions bigint default 0,
  video_views bigint default 0,
  views_2s bigint default 0,
  views_3s bigint default 0,
  views_6s bigint default 0,
  views_25pct bigint default 0,
  views_50pct bigint default 0,
  views_100pct bigint default 0,
  clicks bigint default 0,
  product_clicks bigint default 0,
  orders bigint default 0,
  gmv numeric(12,2) default 0,
  commission numeric(12,2) default 0,
  voucher numeric(12,2) default 0,
  shipping numeric(12,2) default 0,
  cogs numeric(12,2) default 0,
  refunds numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists winner_dna (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references videos(id) on delete cascade,
  status text default 'Emerging'
    check (status in ('Emerging','Confirmed','Scaling','Fatigued','Retired')),
  dna jsonb not null,
  why_it_won text,
  replicable_elements jsonb,
  avoid_literal_copy jsonb,
  created_at timestamptz not null default now()
);

create table if not exists creative_learnings (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references videos(id),
  classification text
    check (classification in ('TRUE_POSITIVE','FALSE_POSITIVE','TRUE_NEGATIVE','FALSE_NEGATIVE')),
  ai_score numeric(5,2),
  actual_performance jsonb,
  learning text,
  suggested_adjustment jsonb,
  approved boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  entity_type text,
  entity_id uuid,
  assignee_id uuid references profiles(id),
  status text default 'OPEN' check (status in ('OPEN','IN_PROGRESS','DONE','BLOCKED')),
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ideas_product on ideas(product_id);
create index if not exists idx_ideas_status on ideas(status);
create index if not exists idx_videos_product on videos(product_id);
create index if not exists idx_video_scores_video on creative_scores(video_id);
create index if not exists idx_performance_date on performance_daily(date);
create index if not exists idx_knowledge_type_status on knowledge_items(type, status);
create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_activity_logs_entity on activity_logs(entity_type, entity_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table profiles enable row level security;
alter table products enable row level security;
alter table personas enable row level security;
alter table offers enable row level security;
alter table knowledge_items enable row level security;
alter table ideas enable row level security;
alter table scripts enable row level security;
alter table videos enable row level security;
alter table video_analysis enable row level security;
alter table creative_scores enable row level security;
alter table campaigns enable row level security;
alter table ad_creatives enable row level security;
alter table performance_daily enable row level security;
alter table winner_dna enable row level security;
alter table creative_learnings enable row level security;
alter table tasks enable row level security;
alter table settings enable row level security;
alter table activity_logs enable row level security;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "profiles_select_authenticated" on profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_self_or_admin" on profiles
  for update using (
    id = auth.uid() or public.current_role() in ('admin','owner')
  );

create policy "products_select" on products for select using (auth.role() = 'authenticated');
create policy "products_write" on products for insert with check (public.current_role() <> 'viewer');
create policy "products_update" on products for update using (public.current_role() <> 'viewer');
create policy "products_delete" on products for delete using (public.current_role() in ('admin','owner'));

create policy "personas_select" on personas for select using (auth.role() = 'authenticated');
create policy "personas_write" on personas for insert with check (public.current_role() <> 'viewer');
create policy "personas_update" on personas for update using (public.current_role() <> 'viewer');
create policy "personas_delete" on personas for delete using (public.current_role() in ('admin','owner'));

create policy "offers_select" on offers for select using (auth.role() = 'authenticated');
create policy "offers_write" on offers for insert with check (public.current_role() <> 'viewer');
create policy "offers_update" on offers for update using (public.current_role() <> 'viewer');
create policy "offers_delete" on offers for delete using (public.current_role() in ('admin','owner'));

create policy "knowledge_select" on knowledge_items for select using (auth.role() = 'authenticated');
create policy "knowledge_write" on knowledge_items for insert with check (public.current_role() <> 'viewer');
create policy "knowledge_update" on knowledge_items for update using (public.current_role() <> 'viewer');
create policy "knowledge_delete" on knowledge_items for delete using (public.current_role() in ('admin','owner'));

create policy "ideas_select" on ideas for select using (auth.role() = 'authenticated');
create policy "ideas_write" on ideas for insert with check (public.current_role() <> 'viewer');
create policy "ideas_update" on ideas for update using (public.current_role() <> 'viewer');
create policy "ideas_delete" on ideas for delete using (public.current_role() in ('admin','owner'));

create policy "scripts_select" on scripts for select using (auth.role() = 'authenticated');
create policy "scripts_write" on scripts for insert with check (public.current_role() <> 'viewer');
create policy "scripts_update" on scripts for update using (public.current_role() <> 'viewer');
create policy "scripts_delete" on scripts for delete using (public.current_role() in ('admin','owner'));

create policy "videos_select" on videos for select using (auth.role() = 'authenticated');
create policy "videos_write" on videos for insert with check (public.current_role() <> 'viewer');
create policy "videos_update" on videos for update using (public.current_role() <> 'viewer');
create policy "videos_delete" on videos for delete using (public.current_role() in ('admin','owner'));

create policy "video_analysis_select" on video_analysis for select using (auth.role() = 'authenticated');
create policy "video_analysis_write" on video_analysis for insert with check (public.current_role() <> 'viewer');

create policy "creative_scores_select" on creative_scores for select using (auth.role() = 'authenticated');
create policy "creative_scores_write" on creative_scores for insert with check (public.current_role() <> 'viewer');

create policy "campaigns_select" on campaigns for select using (auth.role() = 'authenticated');
create policy "campaigns_write" on campaigns for insert with check (public.current_role() in ('admin','owner','media_buyer'));
create policy "campaigns_update" on campaigns for update using (public.current_role() in ('admin','owner','media_buyer'));

create policy "ad_creatives_select" on ad_creatives for select using (auth.role() = 'authenticated');
create policy "ad_creatives_write" on ad_creatives for insert with check (public.current_role() in ('admin','owner','media_buyer'));
create policy "ad_creatives_update" on ad_creatives for update using (public.current_role() in ('admin','owner','media_buyer'));

create policy "performance_select" on performance_daily for select using (auth.role() = 'authenticated');
create policy "performance_write" on performance_daily for insert with check (public.current_role() in ('admin','owner','media_buyer'));

create policy "winner_dna_select" on winner_dna for select using (auth.role() = 'authenticated');
create policy "winner_dna_write" on winner_dna for insert with check (public.current_role() <> 'viewer');

create policy "creative_learnings_select" on creative_learnings for select using (auth.role() = 'authenticated');
create policy "creative_learnings_write" on creative_learnings for insert with check (public.current_role() <> 'viewer');
create policy "creative_learnings_update" on creative_learnings for update using (public.current_role() in ('admin','owner'));

create policy "tasks_select" on tasks for select using (auth.role() = 'authenticated');
create policy "tasks_write" on tasks for insert with check (public.current_role() <> 'viewer');
create policy "tasks_update" on tasks for update using (
  assignee_id = auth.uid() or public.current_role() in ('admin','owner','content_lead')
);

create policy "settings_select" on settings for select using (auth.role() = 'authenticated');
create policy "settings_write" on settings for insert with check (public.current_role() in ('admin','owner'));
create policy "settings_update" on settings for update using (public.current_role() in ('admin','owner'));

create policy "activity_logs_select" on activity_logs for select using (auth.role() = 'authenticated');
create policy "activity_logs_write" on activity_logs for insert with check (auth.role() = 'authenticated');
