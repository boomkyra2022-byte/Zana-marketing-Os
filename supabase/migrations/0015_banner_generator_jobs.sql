-- Additive: Banner/Ads Image Generator tool, explicit user request ("เพิ่ม
-- Mode Gennerator ภาพ Banner Ai หรือภาพ Ads สำเร็จ... เป็นงานที่ให้ค่าย
-- OpenAi ทำ"). Uses OpenAI's Images API (gpt-image-1, see
-- lib/ai/image-gen.ts) — same provider/API key as every other AI call in
-- this app. Prompts ported from the team's own "ZANA Creative Team Prompt
-- Library" doc (prompts/banner-generator.ts).
--
-- Result images are stored the same way every other tool's output is
-- (Supabase Storage "edited-clips" bucket via uploadEditedClip) — this table
-- only needs to remember which paths belong to one generation job, since a
-- single job can produce up to 10 images (OpenAI's own per-call limit).

create table if not exists banner_generator_jobs (
  id uuid primary key default uuid_generate_v4(),
  product_name text not null,
  template text not null, -- 'product_ad' | 'awareness' | 'conversion' | 'ecommerce' | 'social_proof' | 'theme'
  price_or_promo text,
  theme text,
  extra_notes text,
  image_count integer not null default 1,
  result_paths text[] not null default '{}', -- paths inside "edited-clips", one per generated image
  model text not null default 'gpt-image-1',
  creator_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_banner_generator_jobs_creator on banner_generator_jobs(creator_id);

alter table banner_generator_jobs enable row level security;

drop policy if exists "banner_generator_jobs_select" on banner_generator_jobs;
drop policy if exists "banner_generator_jobs_insert" on banner_generator_jobs;
drop policy if exists "banner_generator_jobs_delete" on banner_generator_jobs;

create policy "banner_generator_jobs_select" on banner_generator_jobs for select using (auth.role() = 'authenticated');
create policy "banner_generator_jobs_insert" on banner_generator_jobs for insert with check (public.current_role() <> 'viewer');
create policy "banner_generator_jobs_delete" on banner_generator_jobs for delete using (public.current_role() in ('admin','owner'));
