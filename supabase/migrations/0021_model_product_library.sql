-- Model Library + Product Library upgrade — explicit spec: "โปรดอัปเกรด
-- Creative Generator... เลือกนางแบบ → เลือกสินค้า...". Scoped this batch per
-- the user's own AskUserQuestion choice: build Model+Product Library infra
-- and wire it into the ONE mode that already runs the full new engine
-- (Visual Hook Banner) — not all 9 modes yet. Purely additive: new table +
-- new nullable columns on `products` + new nullable columns on the existing
-- `generation_logs` table (from 0020) + one new storage bucket. Nothing
-- existing is altered or dropped.

-- ── Model Library ──────────────────────────────────────────────────────
-- Model and Product are independent entities (explicit spec requirement:
-- "ห้ามผูก Model หนึ่งคนกับสินค้าหนึ่งชิ้นแบบตายตัว") — this table has no FK to
-- products at all, it's picked independently in the Creative Brief.
create table if not exists model_presets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'custom', -- 'founder' | 'ai_model' | 'custom'
  master_reference text, -- storage path (library-uploads bucket) to the primary reference photo
  reference_images text[] not null default '{}', -- storage paths, 1-5 photos
  locked_features text[] not null default '{}', -- e.g. ['ใบหน้า','รูปหน้า','ดวงตา','จมูก','ริมฝีปาก','สีผิว','อายุที่ปรากฏ','เอกลักษณ์เฉพาะบุคคล']
  editable_features text[] not null default '{}', -- e.g. ['เสื้อผ้า','ทรงผม','ท่าทาง','อารมณ์','ฉาก','แสง','มุมกล้อง','สินค้าที่ถือ']
  identity_lock boolean not null default true,
  identity_prompt text,
  negative_prompt text,
  thumbnail text, -- storage path
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_model_presets_active on model_presets(active);

alter table model_presets enable row level security;
drop policy if exists "model_presets_select" on model_presets;
drop policy if exists "model_presets_write" on model_presets;
drop policy if exists "model_presets_update" on model_presets;
create policy "model_presets_select" on model_presets for select using (auth.role() = 'authenticated');
create policy "model_presets_write" on model_presets for insert with check (public.current_role() <> 'viewer');
create policy "model_presets_update" on model_presets for update using (public.current_role() <> 'viewer');

-- Seed the two spec-required starting presets. reference_images intentionally
-- empty — no real photo exists in this system yet; the user uploads it via
-- the new Model Library UI after deploy (never fake/placeholder a real
-- person's face). ZANA Premium AI Model has no real-identity constraint so
-- identity_lock defaults off for it (it's a synthetic look, not a real face
-- to preserve).
insert into model_presets (name, type, locked_features, editable_features, identity_lock, identity_prompt, negative_prompt, active)
select
  'คุณชิดชนก — ZANA Founder',
  'founder',
  array['ใบหน้า','รูปหน้า','ดวงตา','จมูก','ริมฝีปาก','สีผิว','อายุที่ปรากฏ','เอกลักษณ์เฉพาะบุคคล'],
  array['เสื้อผ้า','ทรงผม','ท่าทาง','อารมณ์','ฉาก','แสง','มุมกล้อง','สินค้าที่ถือ'],
  true,
  'Use the attached photograph of the real ZANA female founder as the absolute identity reference. Preserve her real facial identity, face shape, eyes, nose, lips, skin tone, age appearance and distinctive features. Do not replace her with a generic AI model. Do not beautify her until she becomes a different person.',
  'no extra limbs, no distorted hands, no watermark, generic AI influencer face, plastic skin, porcelain skin, excessive whitening, frozen expression',
  true
where not exists (select 1 from model_presets where name = 'คุณชิดชนก — ZANA Founder');

insert into model_presets (name, type, locked_features, editable_features, identity_lock, identity_prompt, negative_prompt, active)
select
  'ZANA Premium AI Model',
  'ai_model',
  array[]::text[],
  array['เสื้อผ้า','ทรงผม','ท่าทาง','อารมณ์','ฉาก','แสง','มุมกล้อง','สินค้าที่ถือ','อายุ','เชื้อชาติ'],
  false,
  'Premium commercial AI-generated Thai female model, consistent premium-beauty look across generations, no real-person likeness implied.',
  'no extra limbs, no distorted hands, no watermark, uncanny valley artifacts',
  true
where not exists (select 1 from model_presets where name = 'ZANA Premium AI Model');

-- ── Product Library upgrade ────────────────────────────────────────────
-- Additive only — every column nullable/defaulted, existing rows unaffected.
-- Reuses existing allowed_claims/banned_claims/usp/benefits rather than
-- duplicating them (spec's "prohibitedClaims" = existing banned_claims,
-- spec's "benefits"/"productReasons" overlap with existing usp/benefits —
-- productReasons kept separate below since it's a distinct field the spec
-- explicitly lists alongside benefits, not a synonym).
alter table products add column if not exists packshots text[] not null default '{}'; -- storage paths, real packshot PNGs — "Source of Truth", never AI-redrawn
alter table products add column if not exists reference_images text[] not null default '{}'; -- additional non-packshot reference photos
alter table products add column if not exists brand_colors text;
alter table products add column if not exists target_audience text;
alter table products add column if not exists pain_points text;
alter table products add column if not exists product_reasons text;
alter table products add column if not exists proofs text;
alter table products add column if not exists promotion text;
alter table products add column if not exists cta text;
alter table products add column if not exists registration_number text; -- อย./FDA-style registration number, for QR Verification mode later
alter table products add column if not exists packaging_lock_prompt text; -- auto-derived guardrail text, editable
alter table products add column if not exists preserve_packaging boolean not null default true;

-- ── Generation Log upgrade ─────────────────────────────────────────────
-- Additive columns on the generation_logs table created in 0020, so a
-- generation triggered from the new Model+Product-aware brief can be traced
-- back to exactly which Model Preset / Product / Idea produced it.
alter table generation_logs add column if not exists model_preset_id uuid references model_presets(id);
alter table generation_logs add column if not exists product_preset_id uuid references products(id);
alter table generation_logs add column if not exists creative_idea_id uuid references visual_ideas(id);

create index if not exists idx_generation_logs_model_preset on generation_logs(model_preset_id);
create index if not exists idx_generation_logs_product_preset on generation_logs(product_preset_id);

-- ── Storage: library-uploads bucket ────────────────────────────────────
-- Direct-from-device upload for reference/packshot photos, same pattern as
-- 0008_source_uploads_bucket.sql — browser uploads straight to Storage
-- (RLS-scoped to the user's own uid folder) so a large photo never has to
-- pass through a Vercel Function's 4.5MB request-body cap. The server only
-- ever reads these paths back out via a signed URL, same as every other
-- bucket in this app.
insert into storage.buckets (id, name, public)
values ('library-uploads', 'library-uploads', false)
on conflict (id) do nothing;

drop policy if exists "library_uploads_insert_own" on storage.objects;
drop policy if exists "library_uploads_select_own" on storage.objects;
drop policy if exists "library_uploads_delete_own" on storage.objects;

create policy "library_uploads_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'library-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "library_uploads_select_own" on storage.objects
  for select
  using (
    bucket_id = 'library-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "library_uploads_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'library-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
