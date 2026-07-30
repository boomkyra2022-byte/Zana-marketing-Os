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
| 1 | Scaffold, Auth, DB schema+RLS, Navigation, Products/Personas/Knowledge CRUD | Code written, needs `npm install` + migration run + manual smoke test |
| 2 | Creative Factory: Ideas, Scripts, Kanban workflow | Not started |
| 3 | Video Upload, Drive import, ffmpeg, transcript, frames, Creative Score | Not started |
| 4 | Performance CSV import, Net ROI, Dashboard KPIs, Winner Engine | Not started |
| 5 | Winner DNA, Variations, Learning/Feedback loop | Not started |
| 6 | QA, RLS audit, error handling, deployment docs | Not started |

## Architecture decisions

- **Auth**: Supabase Auth (email/password to start). `profiles` row auto-created via DB trigger on `auth.users` insert, default role `viewer`. Route protection via `middleware.ts` using `@supabase/ssr`.
- **Data access**: Server Components + Server Actions call Supabase with the user's session (RLS-enforced). No service-role key used from request-handling code paths in Phase 1 — service role is reserved for background jobs (video processing, CSV import) added in later phases.
- **IDs**: `creative_id` human-readable lineage IDs (e.g. `ZK-PERF-20260730-001`) generated server-side; DB `id` stays uuid PK.
- **Navigation**: all 12 sections from MASTER_PROMPT §3 exist as real routes. Unbuilt ones render an honest "Phase N — not built yet" panel — never fake data.
- **No hardcoded demo data** in any production code path. Seed data (MASTER_PROMPT §22 brands/products) will ship as a separate `supabase/seed.sql`, run only if the operator opts in.
- **Settings** table (`settings` key/value jsonb) holds AI provider/model, winner thresholds, workflow gates — read at runtime, not hardcoded, from Phase 4 onward.

## Definition of Done tracking
See TODO.md — each MASTER_PROMPT §30 item is mapped to a phase and checked off only after it's been run and observed working, not just coded.
