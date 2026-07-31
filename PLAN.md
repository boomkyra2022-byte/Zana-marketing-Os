# ZANA Marketing OS V2 — Build Plan

Source of truth: `MASTER_PROMPT_V2.md`. This file tracks architecture decisions so future sessions don't re-derive them.

## Audit (2026-07-30, before writing any V2 code)

- Connected folder before this session was `E:\WEB\ZANA_Marketing_OS_Claude_Cowork_Starter`, containing a working V1 build: Next.js scaffold, Supabase auth, Products/Personas/Knowledge Base CRUD, and a first-pass "Creative Generator" (Ideas → Scripts → Storyboards, text-only). That project was pushed to GitHub (`boomkyra2022-byte/Zana-marketing-Os`) and deployed live on Vercel.
- This session's connected folder changed to `E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork`, which **only contains planning docs** (`MASTER_PROMPT_V2.md`, `README_V2.md`, `COWORK_COMMANDS_V2.md`, a `.zip`) — no application code. The old folder is no longer reachable from this session (renamed/moved outside this session's scope), so its files could not be copied over directly (no git/shell access in this environment).
- Decision (confirmed with user): rebuild Phase 1+2 fresh in this V2 folder, following MASTER_PROMPT_V2 exactly, since its schema (richer storyboard scenes, platform/funnel fields, script title+risk fields) differs enough from V1 that a large rewrite was needed regardless.
- **Supabase project is reused** (same project as V1: `zana-marketing-os`, ref `czpjkszttfibbwcmxwpb`). Migration 0003 is **additive only** — no drops, no destructive renames — per "ห้าม overwrite ระบบเดิมแบบสุ่ม". V1-only tables that MASTER_PROMPT_V2 explicitly excludes from scope (`campaigns`, `ad_creatives`, `performance_daily`, `tasks`, `offers`, `winner_dna`, `creative_learnings`, `creative_scores`) are left in place, untouched, unused by V2 app code — not dropped.
- `products`, `personas`, `knowledge_items`, `profiles`, `settings`, `ideas` tables from V1 already match MASTER_PROMPT_V2's field lists closely enough to reuse as-is (no migration needed for those).
- `scripts`, `storyboards`, `videos`, `video_analysis` get additive columns in migration 0003. New `winners` table is added (replaces the unused V1 `winner_dna`/`creative_learnings` concept with the simpler shape MASTER_PROMPT_V2 §"Winners / Learnings" describes).

## Stack (same as V1, proven working)
- Next.js 14 (App Router, TypeScript, Server Actions)
- Tailwind CSS, light SaaS theme per MASTER_PROMPT_V2 UI Style (white/light gray + dark navy header + blue/green accents — replaces V1's dark charcoal theme)
- Supabase Postgres + Auth + Storage (same project as V1)
- AI: OpenAI JSON-mode, Zod-validated, provider/model configurable via env
- Deploy target: Vercel (new project, or reuse `zana-marketing-os` Vercel project pointed at a new/renamed GitHub repo — user's call at deploy time)

## Environment note
This session's sandbox shell is unavailable (same infra issue as V1 session). Code is written directly to disk, not run/compiled in this session. User runs `npm install` / `npm run dev` / migration / git push per V1's proven workflow.

## Navigation (V2 — top-nav, no big sidebar per spec)
1. Dashboard
2. Creative Generator
3. Video Analyzer
4. Knowledge Base
5. Products
6. Personas
7. Winners / Learnings
8. Settings

Explicitly out of scope for V1 of V2 (per MASTER_PROMPT_V2 "Explicitly Out of Scope"): Kanban, task assignment, production tracking, Campaign Manager, Ads APIs, CSV performance import, CRM/ERP, team KPI. None of these get nav entries or routes in this build.

## Phase Status
| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, Auth, DB (additive), top-nav, Products/Personas/Knowledge/Settings CRUD | In progress |
| 2 | Creative Generator: Ideas → Scripts → Storyboards (rich V2 fields), Copy/Export | Not started |
| 3 | Video Analyzer: Drive import, ffmpeg, transcript, frames, Creative Score (7 dims), timeline fixes | Not started |
| 4 | V2 Loop: storyboard-vs-final comparison, Revised Script V2, Generate V2 Storyboard, Winners | Not started |
| 5 | QA/Deploy: security, RLS, errors, loading, cost control, responsive, docs | Not started |

## Definition of Done
See TODO.md — mapped 1:1 to MASTER_PROMPT_V2 "Definition of Done" (25 items).
