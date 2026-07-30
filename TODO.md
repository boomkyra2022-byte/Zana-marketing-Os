# TODO — ZANA Marketing OS

Legend: [x] done+verified · [~] coded, not yet run/verified · [ ] not started

## Phase 1 — Scaffold / Auth / DB / Navigation / Core CRUD
- [~] package.json, tsconfig, tailwind, next config, eslint
- [~] Supabase browser+server client helpers
- [~] middleware.ts (session refresh + protected routes)
- [~] Login page + auth callback route + logout
- [~] supabase/migrations/0001_init.sql (schema + RLS policies + profiles trigger)
- [~] Dashboard shell layout with 12-section nav
- [~] Command Center page (real KPI queries, zero-state safe)
- [~] Products CRUD (list/create/edit/delete)
- [~] Personas CRUD (list/create/edit/delete)
- [~] Knowledge Base CRUD (list/create/edit/delete)
- [ ] **Run `npm install` and fix any dependency/build errors** ← requires a working shell
- [ ] **Apply migration to a real Supabase project** (`supabase db push` or paste SQL in SQL editor)
- [ ] **Smoke test**: sign up, confirm `profiles` row created, log in, create 1 product/persona/knowledge item each, confirm they persist and RLS doesn't block the owner
- [ ] Fix any runtime/type errors found above
- [ ] Commit checkpoint

## Phase 2 — Creative Factory
- [ ] Ideas table CRUD + "Generate 100 Ideas" AI endpoint (`POST /api/ideas/generate`)
- [ ] Ranking/Top-40 selection
- [ ] Script Factory (`POST /api/scripts/generate`) with HOOK→BELIEF→STORY→PROOF→TURNING POINT→OFFER→CTA structure + script score
- [ ] Kanban board (IDEA→SCRIPT→PRODUCTION→VIDEO_REVIEW→READY_FOR_ADS→ADS_TEST→WINNER→LOSER→SCALE→ARCHIVED)
- [ ] Lineage: idea → script → video → ad → winner traceable by creative_id
- [ ] Run + fix + commit

## Phase 3 — Video Analyzer
- [ ] Upload MP4/MOV/WEBM to Supabase Storage (`videos` bucket), signed URLs
- [ ] Google Drive public-link import (server-side download, MIME/size validation, actionable errors)
- [ ] ffmpeg: audio extraction, frame sampling (dense 0–5s, normal after, configurable max)
- [ ] Transcription provider call
- [ ] AI structured Creative Score JSON (schema from MASTER_PROMPT §9), gate thresholds
- [ ] Status machine: UPLOADED→PROCESSING→TRANSCRIBING→ANALYZING→SCORING→DONE→FAILED, shown in UI
- [ ] Test with 1 real video end-to-end, no mocks
- [ ] Run + fix + commit

## Phase 4 — Performance
- [ ] TikTok CSV import: column mapping UI + preview + validation
- [ ] Net Contribution / Net ROI calc, safe for ad_spend = 0
- [ ] Dashboard real KPIs wired to performance_daily
- [ ] Winner Engine (Net ROI, CPO, CTR, CVR, hook rate, retention, spend confidence, fatigue) with thresholds in Settings
- [ ] Run + fix + commit

## Phase 5 — Closed Loop
- [ ] Winner DNA generation + storage
- [ ] Generate Variations → child ideas linked to parent winner
- [ ] Learning classification (TP/FP/TN/FN) vs actual performance
- [ ] Suggested Scoring Adjustment requires Admin approval (no auto-change)
- [ ] Learnings written back to Knowledge Base
- [ ] Run + fix + commit

## Phase 6 — Production Readiness
- [ ] Security pass: keys server-side only, file validation, signed URLs, rate limits on AI endpoints, sanitize filenames
- [ ] RLS policy review per role (Admin/Owner/Content Lead/Creator/Editor/Media Buyer/Viewer)
- [ ] Error handling: timeouts/retries/readable errors/logs on every integration
- [ ] Mobile responsive pass
- [ ] Deployment docs (Vercel + Supabase) verified end-to-end
- [ ] Final README pass

## Definition of Done checklist (MASTER_PROMPT §30) — mapped
1. Login — Phase 1 (coded, needs verify)
2. Product/Persona/Knowledge CRUD — Phase 1 (coded, needs verify)
3. Generate 100 Ideas — Phase 2
4. Idea → Script — Phase 2
5. Upload Video — Phase 3
6. Drive import — Phase 3
7. Transcript + frames — Phase 3
8. AI Creative Score JSON — Phase 3
9. Dashboard shows Score — Phase 3/4
10. Approve → Ads Test — Phase 2/4
11. TikTok CSV import — Phase 4
12. Net ROI calc — Phase 4
13. Winner selection — Phase 4
14. Winner DNA — Phase 5
15. Generate Variations — Phase 5
16. Learning written to Knowledge Base — Phase 5
17. Deployable — Phase 6
18. README complete — Phase 6
