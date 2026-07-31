# TODO — ZANA Marketing OS V2

Legend: [x] done+verified · [~] coded, not yet run/verified · [ ] not started

## Phase 1 — Foundation
- [~] package.json, tsconfig, tailwind (light SaaS theme), next config, eslint
- [~] Supabase browser+server client helpers + middleware (reused pattern from V1)
- [~] Login page + auth callback + logout
- [~] supabase/migrations/0003_v2_schema.sql (additive: scripts.title/risks, storyboards.scene_count/style, video_analysis scoring/comparison/revision columns, new winners table)
- [~] Top-nav layout, 8 sections
- [~] Products CRUD
- [~] Personas CRUD
- [~] Knowledge Base CRUD (6 types: PRODUCT/PERSONA/BRAND/CONTENT_RULES/WINNING_CREATIVE/LEARNINGS)
- [~] Settings page (AI provider/model/temperature/max ideas-scripts-storyboards-scenes-frames-duration, scoring weights/thresholds, Drive mode)
- [~] Dashboard (ideas/scripts/storyboards/videos counts, avg score, ready-to-test, recent creative, action queue)
- [x] **Run `npm install`, fix build errors** — done (execution policy fixed, dep install ok)
- [x] **Run migration 0003 on the existing Supabase project** — applied
- [x] **Smoke test**: login, product exists, dashboard reachable — confirmed via live browser test
- [ ] Commit checkpoint (new git repo or reuse existing — user's call)

## Phase 2 — Creative Generator
- [x] STEP 1 Generate Ideas — tested live: 5 ideas generated, Thai hooks, varied angles, score 1-10 ✅
- [x] STEP 2 Generate Scripts — tested live: 5 scripts generated from 5 ideas ✅ (fixed bug: removed stray `creative_id` insert — column doesn't exist on `scripts` table)
- [x] STEP 3 Generate Storyboards — tested live: 3 storyboards, 6 scenes each, full 9-column table rendered ✅
- [x] Storyboard display table: Scene|Time|Visual|Source|Camera|VO|Text|Sound|Edit
- [~] Actions: Copy All / Export TXT / Export Markdown wired up — not yet click-tested by user; PDF/Google Flow/AI video prompt exports still deferred to later increment; per-idea/per-script Regenerate/Duplicate/Save/Delete not yet built (selection checkboxes exist instead)
- [x] Context retrieval function `getRelevantCreativeContext()` — Product+Persona+Knowledge+Winners/Learnings, filtered not dumped (`lib/ai/context.ts`)
- [x] /prompts directory: idea-generator.ts, script-generator.ts, storyboard-generator.ts (prompts extracted from components, not inline)
- [x] Run + fix (creative_id bug) — commit still pending

## Phase 3 — Video Analyzer
- [ ] Google Drive public-link import: extract file id, server-side download, validate type/size, temp file, cleanup
- [ ] Readable Thai errors: permission denied / invalid link / too large / unsupported format / download failed
- [ ] ffprobe metadata, ffmpeg audio extraction, frame sampling (dense 0-5s, then 1 frame/2-3s, scene-change if feasible, configurable max)
- [ ] Transcription call
- [ ] AI analysis: hook, pacing, message, proof, offer/CTA, product appearance, storyboard comparison if linked
- [ ] Creative Score: 7 dimensions (Hook 20/Retention-Pacing 15/Message Clarity 15/Product-Benefit 15/Proof-Trust 10/Offer-CTA 15/Native-Execution 10), verdict thresholds
- [ ] Timestamp Fix Recommendations: {start_time,end_time,status:KEEP|FIX|IMPROVE,finding,recommendation}
- [ ] Progress states: DOWNLOADING/EXTRACTING/TRANSCRIBING/ANALYZING/SCORING/DONE/FAILED shown in UI
- [ ] Test with 1 real video end-to-end
- [ ] Run + fix + commit

## Phase 4 — V2 Loop
- [ ] Storyboard vs Final comparison (scene order/hook/product reveal/proof/CTA/pacing/missing scenes/text/sound) → Followed/Changed/Missing/Recommendation
- [ ] Revised V2 Recommendation: Priority Fixes 1-5, Revised Script V2 (same framework), Revised Edit Plan
- [ ] "Generate V2 Storyboard" button
- [ ] Winners: mark video as winner, store hook/format/persona/funnel/score/why/replicable pattern/notes
- [ ] Actions: Use as Reference / Generate New Ideas From Winner
- [ ] Run + fix + commit

## Phase 5 — QA / Deploy
- [ ] Security: server-side keys only, RLS review, signed/private storage, Drive URL validation, filename sanitization, file size limits, timeouts, AI rate limits
- [ ] Hide/archive any leftover V1-only routes instead of deleting (non-destructive)
- [ ] lint/typecheck/tests pass
- [ ] Mobile/responsive pass (desktop-first per spec, but must not break on mobile)
- [ ] Deploy + README

## Definition of Done (MASTER_PROMPT_V2, 25 items) — mapped
1. Login — Phase 1
2. Product CRUD — Phase 1
3. Persona CRUD — Phase 1
4. Knowledge CRUD — Phase 1
5. Generator draws Product+Persona+Knowledge — Phase 2
6. Generate Ideas by quantity — Phase 2
7. Idea→Scripts by quantity — Phase 2
8. Script uses 7-step framework — Phase 2
9. Script→Storyboard — Phase 2
10. Scene-by-scene production-ready — Phase 2
11. Configurable storyboard/scene quantity — Phase 2
12. Copy/Export — Phase 2
13. Drive public link import — Phase 3
14. Transcript — Phase 3
15. Analyze frames/timeline — Phase 3
16. Creative Score 7 dimensions — Phase 3
17. Timestamp Fixes — Phase 3
18. Compare Storyboard vs Final — Phase 4
19. Revised Script V2 — Phase 4
20. Generate V2 Storyboard — Phase 4
21. Mark Winner — Phase 4
22. Winner/Learning reused next round — Phase 4
23. lint/typecheck/test pass — Phase 5
24. Deployable — Phase 5
25. README complete — Phase 5
