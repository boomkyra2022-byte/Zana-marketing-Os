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
| 1 | Scaffold, Auth, DB (additive), top-nav, Products/Personas/Knowledge/Settings CRUD | Done, verified live in production |
| 2 | Creative Generator: Ideas → Scripts → Storyboards (rich V2 fields), Copy/Export | Done, verified live in production |
| 3 | Video Analyzer: Drive import, ffmpeg, transcript, frames, Creative Score (7 dims), timeline fixes | Code complete, pending run+test — needs migrations 0004 + 0005 |
| 4 | V2 Loop: storyboard-vs-final comparison, Revised Script V2, Generate V2 Storyboard, Winners | Not started (comparison + revised script folded into Phase 3 build, see below) |
| 5 | QA/Deploy: security, RLS, errors, loading, cost control, responsive, docs | Not started |

## Phase 3 — Architecture decisions (Video Analyzer)

**Runtime**: single synchronous Node.js route handler (`runtime='nodejs'`, `maxDuration=300`) does the whole pipeline per request — download → ffprobe → extract audio → transcribe → extract frames → AI vision analysis → persist. No job queue in V1 (matches "reserve service-role key for future background jobs" note from Phase 1). The route writes `videos.status` at each stage so the UI can poll `GET /api/creative/videos/:id` every ~2s and show live progress text (DOWNLOADING/EXTRACTING/TRANSCRIBING/ANALYZING/SCORING/DONE/FAILED) while the POST request is still in flight.

**Why this needs Vercel Pro**: Hobby plan caps function duration around 60s; a real ffmpeg+transcribe+vision pipeline for a 30–60s ad can take longer. Account is already on Pro (trial). Flagged to user: continued use of this feature after the trial requires staying on a paid Pro plan.

**ffmpeg/ffprobe**: `ffmpeg-static` + `ffprobe-static` npm packages (bundle a platform binary, resolved per-OS — Windows binary locally for `npm run dev`, Linux binary on Vercel's Linux build machine). Binary invoked via `child_process.execFile`, not `fluent-ffmpeg`, to keep the surface small and predictable. `fs.chmodSync(path, 0o755)` defensively before first use (Vercel packaging sometimes strips the executable bit).

**Google Drive download**: no Drive API/OAuth in V1 (per spec, "OAuth reserved future") — extract file id from the shared URL, GET `drive.google.com/uc?export=download&id=...`, follow Google's large-file "virus scan warning" confirm-token redirect if present, check `content-length` header before consuming the body (abort with a Thai error if it exceeds the configurable max size), stream to `/tmp/<video_id>.<ext>`.

**No persistent video storage in V1**: the downloaded file is a temp copy for analysis only, deleted in a `finally` block whether the pipeline succeeds or fails (matches "temp file → analyze → cleanup temp"). The canonical source stays the Google Drive link; the UI embeds `drive.google.com/file/d/<id>/preview` for playback instead of re-hosting the video. `videos.storage_path` stays null in V1.

**Frame sampling / cost control**: dense sampling every 1s for 0–5s, then every ~2.5s after that, capped at a configurable max (default 20 frames), each resized to 480px wide via ffmpeg's scale filter before base64-encoding — keeps the vision request payload small and matches "resize frames" / "max frames configurable" cost-control requirements. All frames + the transcript go into **one** combined OpenAI vision call (`callOpenAIVisionJSON`) that returns score + timeline + storyboard comparison together — matches "batch vision where possible" / "transcript once".

**Revised V2 Recommendation is on-demand, not automatic**: the first Analyze call only returns score/breakdown/timeline/storyboard-comparison/risk flags. Priority Fixes + Revised Script V2 + Revised Edit Plan are generated by a second, separate action (`POST /api/creative/videos/:id/revise`) that the user triggers only when they want it — avoids burning tokens rewriting videos that already scored READY TO TEST / PRIORITY TEST. The revised script is inserted as a real new row in `scripts` (linked back to the original idea), so the existing "Generate V2 Storyboard" button can just call the **already-built** `/api/creative/storyboards/generate` route with that new script id — no new storyboard-generation code needed, straight reuse of Phase 2 infra.

**Prompt files** (per MASTER_PROMPT_V2 "Prompt Architecture"): `prompts/creative-score.ts` (shared rubric constants: 7 dimensions + weights + verdict thresholds), `prompts/video-analyzer.ts` (main analysis prompt, consumes the rubric constants), `prompts/v2-rewrite.ts` (Priority Fixes + Revised Script V2 + Revised Edit Plan prompt).

**Progress streaming**: `POST /api/creative/videos/import` returns a newline-delimited-JSON streaming response (not a single JSON body) so the UI can show live DOWNLOADING/EXTRACTING/TRANSCRIBING/ANALYZING/SCORING status while the one long request is still in flight, without needing a separate job queue. `videos.status` is also written to the DB at each stage as a durability fallback. `GET /api/creative/videos/:id` exists separately for polling/refresh recovery.

**Two schema gaps found while building Phase 3 (fixed additively, not yet run by user):**
- `videos.status` check constraint (from 0001) only allowed `UPLOADED/PROCESSING/TRANSCRIBING/ANALYZING/SCORING/DONE/FAILED` — missing `DOWNLOADING`/`EXTRACTING` that MASTER_PROMPT_V2's progress states require. Fixed in `0004_video_status_widen.sql` (widens the check constraint, no data touched).
- `video_analysis` (from 0001) only ever got `select`/`insert` RLS policies, no `update` policy — but the "Generate V2 Recommendation" action needs to UPDATE a `video_analysis` row (add `priority_fixes`/`revised_script`/`revised_edit_plan`) after the fact. Without this the update would silently fail under RLS. Fixed in `0005_video_analysis_rls.sql`.

## Added beyond MASTER_PROMPT_V2 scope (explicit user request, not in the original 25-item DoD)

**Team management (`/settings/team`, admin/owner only)**: the user needed a real way to onboard employees once the app was live on Vercel, instead of hand-running SQL (`update profiles set role=...`) every time. Built as a Settings sub-page, not a new top-nav item (keeps the 8-item nav spec intact):
- `createTeamMember`: uses `createServiceRoleClient()` (the service-role key that was deliberately left unused since Phase 1) to call Supabase Auth's admin API directly — `auth.admin.createUser({email, password, email_confirm:true})`. Chose this over `inviteUserByEmail` (magic-link email) because the invite-email flow depends on Supabase's email delivery + redirect/callback handling being correctly configured, which couldn't be verified in this session; direct password creation has no such dependency. A random 14-char temp password is generated server-side and shown once in the UI for the admin to copy and send manually (Slack/LINE/etc.) — never emailed, never logged.
- The existing `on_auth_user_created` trigger (0001) always creates the `profiles` row with `role='viewer'`; `createTeamMember` immediately bumps it to the chosen role.
- `updateMemberRole` / `removeMember` reuse the normal RLS-bound client where possible (`profiles_update_self_or_admin` policy already allows admin/owner to update any profile) — service-role client is only used for the two things RLS genuinely can't do: creating/deleting an `auth.users` row.
- Deleting a user cascades to `profiles` automatically (`profiles.id references auth.users(id) on delete cascade`), so `removeMember` is a single `auth.admin.deleteUser` call.

## Definition of Done
See TODO.md — mapped 1:1 to MASTER_PROMPT_V2 "Definition of Done" (25 items).
