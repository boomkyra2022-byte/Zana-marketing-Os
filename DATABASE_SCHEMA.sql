
-- ZANA Marketing OS — Supabase/Postgres starter schema
create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key,
  full_name text,
  role text not null default 'viewer',
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
  type text not null,
  content text not null,
  tags jsonb default '[]'::jsonb,
  product_ids jsonb default '[]'::jsonb,
  persona_ids jsonb default '[]'::jsonb,
  source text,
  confidence numeric(5,2),
  effective_from timestamptz,
  effective_to timestamptz,
  status text default 'active',
  created_by uuid,
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
  owner_id uuid,
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
  status text default 'UPLOADED',
  creator_id uuid,
  editor_id uuid,
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
  status text default 'Emerging',
  dna jsonb not null,
  why_it_won text,
  replicable_elements jsonb,
  avoid_literal_copy jsonb,
  created_at timestamptz not null default now()
);

create table if not exists creative_learnings (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references videos(id),
  classification text,
  ai_score numeric(5,2),
  actual_performance jsonb,
  learning text,
  suggested_adjustment jsonb,
  approved boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
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
