-- Additive: "Gen Prompt" tool (Google Flow / AI-video production-prompt
-- generator), added beyond MASTER_PROMPT_V2 scope, explicit user request.
-- Separate top-level tab from Creative Generator per user's request. Stores
-- generated sets so users can revisit past generations without re-calling
-- the AI (cost control), same pattern as ideas/scripts/storyboards.

create table if not exists flow_prompts (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  inputs jsonb not null,
  video_concept text,
  video_flow jsonb,
  scenes jsonb,
  provider text,
  model text,
  prompt_version text,
  creator_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_flow_prompts_creator on flow_prompts(creator_id);
create index if not exists idx_flow_prompts_product on flow_prompts(product_id);

alter table flow_prompts enable row level security;

drop policy if exists "flow_prompts_select" on flow_prompts;
drop policy if exists "flow_prompts_insert" on flow_prompts;
drop policy if exists "flow_prompts_delete" on flow_prompts;

create policy "flow_prompts_select" on flow_prompts for select using (auth.role() = 'authenticated');
create policy "flow_prompts_insert" on flow_prompts for insert with check (public.current_role() <> 'viewer');
create policy "flow_prompts_delete" on flow_prompts for delete using (public.current_role() in ('admin','owner'));
