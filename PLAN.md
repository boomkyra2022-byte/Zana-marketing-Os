# ZANA Marketing OS — Build Plan

Source of truth: `MASTER_PROMPT.md`. This file tracks architecture decisions and phase scope so future sessions don't re-derive them.

## Stack (locked)
- Next.js 14 (App Router, TypeScript, Server Actions)
- Tailwind CSS (+ minimal shadcn-style primitives, no external UI kit dependency yet — kept lean so it runs with just `npm install`)
- Supabase: Postgres + Auth + Storage
- AI provider abstracted behind `lib/ai/provider.ts` (OpenAI first, swappable via `AI_PROVIDER` env)
- ffmpeg via `fluent-ffmpeg` + `ffmpeg-static` (Phase 3)
- Deployment target: Vercel (app) + Supabase (data/storage)

## Environment note (important)
This build session's sandbox shell is unavailable (Anthropic infra disk-space issue, unrelated to the user's machine), so code was written directly to disk without running `npm install` / `next dev` / `supabase db push` in this session. Everything below is real, runnable code — not a mockup — but **has not yet been executed/verified by an agent in this session**. The user (or a future session with a working shell) must run the commands in README.md to install deps, apply the migration, and smoke-test. TODO.md tracks this explicitly as an open item per phase.

## Phase Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, Auth, DB schema+RLS, Navigation, Products/Personas/Knowledge CRUD | **Done, deployed to Vercel, verified working in production** |
| 1.5 | Product image-to-form AI import (OpenAI vision) | Done |
| 2 (revised) | Creative Generator: Idea → Script → Storyboard, streamlined (no Kanban) | Code written (0002 migration + 3 API routes + UI), needs migration run + smoke test |
| 3 (revised) | Google Drive public-link video intake + AI video review/scoring | Not started — next up |
| 4 | Performance CSV import, Net ROI, Dashboard KPIs, Winner Engine | Not started |
| 5 | Winner DNA, Variations, Learning/Feedback loop | Not started |
| 6 | QA, RLS audit, error handling, deployment docs | Not started |

### 2026-07-30 scope revision
Per user request, the full Kanban Creative Factory (IDEA→SCRIPT→PRODUCTION→...→ARCHIVED board with per-card workflow actions) was replaced with a leaner **Creative Generator**: pick Product+Persona → generate N ideas (AI, grounded in Knowledge Base) → select/auto-pick top ideas → generate N scripts (Hook/Belief/Story/Proof/Turning Point/Offer/CTA + timed segments 0-3s/3-10s/10-20s/20-30s/30-45s + shot list + caption + hashtags + thumbnail text) → select/auto-pick top scripts → generate N storyboards (scene-by-scene, AI vs FOOTAGE marked, camera movement, voice over, sound cue — **text only, no AI image generation** per user decision).

Storyboards are exported as a real DB table (`storyboards`), not files — user takes the storyboard data and edits the actual video externally, then brings the finished clip back via Google Drive public link (Phase 3, next).

New tables/columns: `scripts` extended with hook/belief/story/proof/turning_point/offer/timed_script/caption/hashtags/thumbnail_text; new `storyboards` table; `ideas` extended with `angle`.
New routes: `POST /api/ideas/generate`, `POST /api/scripts/generate`, `POST /api/storyboards/generate` — all OpenAI JSON-mode, Knowledge-Base-grounded, audit-logged to `activity_logs` per MASTER_PROMPT §24.

## Architecture decisions

- **Auth**: Supabase Auth (email/password to start). `profiles` row auto-created via DB trigger on `auth.users` insert, default role `viewer`. Route protection via `middleware.ts` using `@supabase/ssr`.
- **Data access**: Server Components + Server Actions call Supabase with the user's session (RLS-enforced). No service-role key used from request-handling code paths in Phase 1 — service role is reserved for background jobs (video processing, CSV import) added in later phases.
- **IDs**: `creative_id` human-readable lineage IDs (e.g. `ZK-PERF-20260730-001`) generated server-side; DB `id` stays uuid PK.
- **Navigation**: all 12 sections from MASTER_PROMPT §3 exist as real routes. Unbuilt ones render an honest "Phase N — not built yet" panel — never fake data.
- **No hardcoded demo data** in any production code path. Seed data (MASTER_PROMPT §22 brands/products) will ship as a separate `supabase/seed.sql`, run only if the operator opts in.
- **Settings** table (`settings` key/value jsonb) holds AI provider/model, winner thresholds, workflow gates — read at runtime, not hardcoded, from Phase 4 onward.

## Definition of Done tracking
See TODO.md — each MASTER_PROMPT §30 item is mapped to a phase and checked off only after it's been run and observed working, not just coded.
