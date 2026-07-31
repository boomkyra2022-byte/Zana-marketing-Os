-- ZANA Marketing OS V2 — additive migration on top of the existing V1 project
-- (0001_init.sql + 0002_creative_generator.sql already applied to this same
-- Supabase project). This migration is ADDITIVE ONLY — no drops, no renames,
-- no destructive changes — per MASTER_PROMPT_V2 "ห้าม overwrite ระบบเดิมแบบสุ่ม".
--
-- V1-only tables (campaigns, ad_creatives, performance_daily, tasks, offers,
-- winner_dna, creative_learnings, creative_scores) are intentionally left
-- untouched. MASTER_PROMPT_V2 excludes their concepts from V1 scope, but
-- dropping them is a destructive action the user did not ask for.

-- ============================================================
-- knowledge_items: widen allowed types to include V2's 6-category set
-- while keeping V1's values valid (existing rows are unaffected).
-- ============================================================
alter table knowledge_items drop constraint if exists knowledge_items_type_check;
alter table knowledge_items add constraint knowledge_items_type_check check (type in (
  'PRODUCT','PERSONA','BRAND','OFFER','CREATIVE_PATTERN','WINNER_LEARNING',
  'LOSER_LEARNING','COMPLIANCE','FAQ','CAMPAIGN','MARKET_INSIGHT',
  'CONTENT_RULES','WINNING_CREATIVE','LEARNINGS'
));

-- ============================================================
-- scripts: add V2 fields (title, compliance/risk note)
-- ============================================================
alter table scripts add column if not exists title text;
alter table scripts add column if not exists risks text;

-- ============================================================
-- storyboards: add V2 fields (scene_count, style)
-- ============================================================
alter table storyboards add column if not exists scene_count integer;
alter table storyboards add column if not exists style text;

-- ============================================================
-- videos: link to storyboard (V2 flow: storyboard -> external production -> Drive link -> video record)
-- ============================================================
alter table videos add column if not exists storyboard_id uuid references storyboards(id);

-- ============================================================
-- video_analysis: add V2 scoring/comparison/revision fields
-- ============================================================
alter table video_analysis add column if not exists score_total numeric(5,2);
alter table video_analysis add column if not exists score_breakdown jsonb;
alter table video_analysis add column if not exists verdict text;
alter table video_analysis add column if not exists storyboard_comparison jsonb;
alter table video_analysis add column if not exists priority_fixes jsonb;
alter table video_analysis add column if not exists revised_script jsonb;
alter table video_analysis add column if not exists revised_edit_plan jsonb;

-- ============================================================
-- winners: new, simpler table per MASTER_PROMPT_V2 "Winners / Learnings"
-- (replaces the V1 winner_dna/creative_learnings concept for V2 purposes;
-- those V1 tables are left in place, just unused by V2 app code)
-- ============================================================
create table if not exists winners (
  id uuid primary key default uuid_generate_v4(),
  video_id uuid references videos(id) on delete cascade,
  product_id uuid references products(id),
  persona_id uuid references personas(id),
  hook text,
  creative_format text,
  funnel_stage text,
  score numeric(5,2),
  why_it_won text,
  replicable_pattern text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_winners_product on winners(product_id);

alter table winners enable row level security;

create policy "winners_select" on winners for select using (auth.role() = 'authenticated');
create policy "winners_write" on winners for insert with check (public.current_role() <> 'viewer');
create policy "winners_update" on winners for update using (public.current_role() <> 'viewer');
create policy "winners_delete" on winners for delete using (public.current_role() in ('admin','owner'));
