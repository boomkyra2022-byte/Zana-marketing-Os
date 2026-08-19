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
- [x] Commit checkpoint — pushed to existing repo (boomkyra2022-byte/Zana-marketing-Os), V1 preserved on `v1-legacy` branch, deployed live on Vercel

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
- [~] Google Drive public-link import: extract file id, server-side download (confirm-token handling for large files), validate type/size via content-length + content-type, temp file in os.tmpdir(), cleanup in `finally` (`lib/media/drive.ts`)
- [~] Readable Thai errors: permission denied / invalid link / too large / unsupported format / download failed
- [~] ffprobe metadata, ffmpeg audio extraction, frame sampling (dense 0-5s every 1s, then every ~2.5s, capped at configurable max frames, resized to 480px) (`lib/media/ffmpeg.ts`) — scene-change detection not implemented, timestamp-based sampling only
- [~] Transcription call — `transcribeAudio()` in `lib/ai/openai.ts`, default model `gpt-4o-mini-transcribe`
- [~] AI analysis: hook, pacing, message, proof, offer/CTA, storyboard comparison if linked — one combined vision call (`callOpenAIVisionJSON`) per "batch vision where possible" (`prompts/video-analyzer.ts`)
- [~] Creative Score: 7 dimensions + verdict thresholds (`prompts/creative-score.ts`)
- [~] Timestamp Fix Recommendations: {start_time,end_time,status:KEEP|FIX|IMPROVE,finding,recommendation}
- [~] Progress states: DOWNLOADING/EXTRACTING/TRANSCRIBING/ANALYZING/SCORING/DONE/FAILED — streamed live via NDJSON response + persisted to `videos.status` for refresh recovery
- [x] **Test with 1 real video end-to-end** — confirmed working live in production. Root cause of the earlier `spawn .../ffprobe ENOENT` failures: Vercel's file tracer doesn't auto-include native binaries accessed via runtime fs path (not `require()`'d). Two `outputFileTracingIncludes` key-format guesses didn't work; fixed by adding `experimental.serverComponentsExternalPackages: ['ffmpeg-static', 'ffprobe-static']` in `next.config.mjs` (the standard fix for native-binary npm packages on Vercel — same approach Vercel's own `vercel-labs/ffmpeg-on-vercel` reference repo uses). Full pipeline verified live: Drive download → ffprobe → audio extract → transcribe → frame sample → AI vision scoring → 7-dimension breakdown rendered correctly (72/100, REVISE, all dimensions with what-works/what-hurts/recommendation).
- [ ] Run + fix + commit

## Phase 4 — V2 Loop
- [~] Storyboard vs Final comparison (aspect/planned/actual/Followed|Changed|Missing/result/recommendation) — folded into the same Analyze call, not a separate step
- [~] Revised V2 Recommendation: Priority Fixes 1-5, Revised Script V2 (same 7-part framework, inserted as a real `scripts` row), Revised Edit Plan — on-demand via `POST /api/creative/videos/:id/revise` (`prompts/v2-rewrite.ts`), not automatic (cost control)
- [~] "Generate V2 Storyboard" button — reuses the existing Phase 2 `/api/creative/storyboards/generate` route with the new revised-script id, no new storyboard-gen code
- [ ] Winners: mark video as winner, store hook/format/persona/funnel/score/why/replicable pattern/notes — not started
- [ ] Actions: Use as Reference / Generate New Ideas From Winner — not started
- [ ] Run + fix + commit

## Editor tool (added beyond MASTER_PROMPT_V2 scope, explicit user request)
- [~] `supabase/migrations/0006_editor_jobs.sql` — `editor_jobs` table + RLS + private `edited-clips` storage bucket
- [~] `lib/media/source.ts` — generalized downloader (Drive link OR direct HTTPS URL), enables result-chaining
- [~] `lib/tamsub/client.ts` — wraps all 4 Tamsub endpoints (silence-cut, renders, subtitles, dewatermark), Thai error mapping for documented HTTP codes (401/403/413/429/400/500)
- [~] `lib/supabase/storage.ts` — `uploadEditedClip()` / `resignEditedClip()` via service-role client + signed URL (bypasses Vercel's 4.5MB response-body limit)
- [~] `POST /api/tools/editor/run` — NDJSON streaming orchestrator (DOWNLOADING/PROCESSING/UPLOADING/DONE/FAILED)
- [~] `GET /api/tools/editor/jobs/:id/download` — re-sign an expired result URL on demand
- [~] `/editor` page + `editor-client.tsx` — operation selector, source input, per-op tuning fields, billing notice, result preview (video or SRT text), "use result as next source" chaining button, job history table
- [~] Nav item added (`components/nav-items.ts`, 8→9 items — Editor is a daily-use tool, unlike admin-only Team which stayed a Settings sub-page)
- [~] `.env.example` — added `TAMSUB_API_TOKEN`
- [x] Run migration 0006 on Supabase, set `TAMSUB_API_TOKEN`, smoke test all 4 operations end-to-end, commit + push + deploy — confirmed live in production (Editor nav item visible, deploy `615fa41` Ready)

## Punchy SRT (added beyond MASTER_PROMPT_V2 scope, follow-up to Editor tool)
User's actual goal for the CapCut request: a downloadable .srt with strict Thai captioning rules (no average-time word split, short connector words merged into neighboring cue, no space between every Thai word, proper-noun/English correction, full timing coverage, plain text no HTML) to import into CapCut manually. Direct CapCut draft-JSON generation was explicitly descoped as high-risk (undocumented format, resource_id/effect_id tied to CapCut's own asset catalog) — user agreed to start with the achievable part only.
- [~] `supabase/migrations/0007_punchy_srt_operation.sql` — widen `editor_jobs.operation` check constraint to add `PUNCHY_SRT`
- [~] `lib/ai/openai.ts` — `transcribeAudioWithTimestamps()` (whisper-1, verbose_json, word-level timestamps — real per-word times, never averaged)
- [~] `prompts/punchy-subtitle.ts` — cue-grouping prompt; AI only picks word-index boundaries, never invents timestamps
- [~] `lib/media/srt.ts` — resolves word indices → real timestamps, repairs any gap/overlap the model leaves (guarantees full coverage), formats plain-text `.srt`
- [~] `app/api/tools/editor/run/route.ts` — new `PUNCHY_SRT` branch (`runPunchySubtitle` helper): extract audio → Whisper word timestamps → GPT cue grouping → validated SRT. Bypasses Tamsub entirely for this operation.
- [~] `components/editor-client.tsx` / `editor/page.tsx` — added as 5th operation option, billing note clarifies no Tamsub credit used
- [ ] Run migration 0007, smoke test with a real Thai video, commit + push + deploy
- [x] Fixed `lib/media/drive.ts` while testing: large-file Google Drive downloads were looping back to the "can't scan for viruses" HTML interstitial even with correct "Anyone with the link" sharing, because (a) Google's current large-file bypass needs the interstitial's `uuid` replayed against `drive.usercontent.google.com`, not just the older `confirm=TOKEN` param, and (b) the interstitial sets a cookie that must be forwarded on the follow-up request or Drive re-serves the warning page. Added uuid-based bypass + cookie forwarding + a `confirm=t` last-resort fallback (2 attempts before failing with a clear Thai message). This also fixes the same underlying flow used by Video Analyzer's Drive import.
- [x] **Fixed real upload bug found in testing**: Supabase Storage rejected the object key on a Thai-named file (`Invalid key: .../..._ฉาก_—_เปิด_P.mp4`) — Storage keys must be ASCII-safe, but the upload path was built directly from `file.name` (Thai text, em-dash, spaces all pass browser `File.name` validation fine, just not Supabase's key rules). Fixed in `editor-client.tsx: safeUploadPath()` — the storage key is now built only from timestamp + random id + extension-from-MIME-type, never the original filename; the real filename is kept separately just for UI display.
- [~] **Direct-from-device upload added** — `0008_source_uploads_bucket.sql` (private bucket + per-user RLS), `lib/supabase/storage.ts: signSourceUpload()`, `POST /api/tools/editor/uploads/sign`, `editor-client.tsx` link/upload toggle. Browser uploads straight to Supabase Storage (never through Vercel), so the 4.5MB limit doesn't apply — reverses the earlier "not viable" call, which only ruled out routing bytes through our own API route. Not yet run/tested — need migration 0008 applied + a real upload tried before marking done.
- [x] **Real CapCut import test found garbled Thai + timing complaints** — root cause: prompt v1 let GPT retype each cue's display text freely, decoupling it from the actual Whisper words (the model would paraphrase/hallucinate). Fixed in v2 (`punchy-subtitle-v2`): GPT now only returns word-index cue boundaries + an optional narrow `corrections` list (product/brand/English terms only); the actual `.srt` text is always assembled in code (`lib/media/srt.ts: resolveCueTimestamps` + `joinWordsThai`) directly from the real transcribed words, so displayed text can never drift from what was actually said. Thai-vs-Latin spacing is now a deterministic code rule (no space between two Thai characters, space at any Thai/Latin boundary) instead of left to the model. Not yet re-tested with a real CapCut import after this fix — do that before considering this done.

## Editor: local dewatermark fallback (added — Tamsub account doesn't have this feature on its current plan, confirmed via a real 403)
- [~] `0010_dewatermark_local_operation.sql` — widen `editor_jobs.operation` check constraint to add `DEWATERMARK_LOCAL`
- [~] `lib/media/ffmpeg.ts: applyDelogo()` + `computeDelogoRegion()` — ffmpeg `delogo` filter on a corner region sized/positioned from user's corner+size choice. Honest limitation documented in code + UI: this blurs/interpolates the region, it does NOT do AI content-aware reconstruction like Tamsub's dewatermark — fine for a small static logo-style watermark (e.g. Veo/Gemini) on simple backgrounds, not a general replacement.
- [~] `app/api/tools/editor/run/route.ts` — new branch (`runLocalDewatermark`), bypasses Tamsub entirely for this operation
- [~] `editor-client.tsx` — new operation option + corner/size selectors + limitation notice in the UI itself (not just docs)
- [ ] Run migration 0010, smoke test with a real watermarked clip, commit + push + deploy

## Gen Prompt tab (added beyond MASTER_PROMPT_V2 scope, explicit user request)
Separate top-level tab, not folded into Creative Generator, per user's request. Turns a short brief into scene-by-scene Google Flow production prompts using the user's own Creative Director / Motion Designer prompt framework (character consistency, visual style, kinetic typography, on-screen text, motion graphics, B-roll, UI/infographic, sound design, pacing, retention design, continuity, guardrails against fake claims/results/covering the speaker's face) — kept close to verbatim in `prompts/flow-prompt-generator.ts`, only the output format changed from plain-text-with-dividers (meant for pasting into a chat model) to strict JSON so the UI can render each scene as its own card with a working "Copy Prompt" button.
- [~] `supabase/migrations/0009_flow_prompts.sql` — `flow_prompts` table (persists generated sets for history/cost-control, same pattern as ideas/scripts/storyboards)
- [~] `prompts/flow-prompt-generator.ts` — system+user prompt builder
- [~] `POST /api/tools/flow-prompt/generate` + `GET /api/tools/flow-prompt/:id`
- [~] `/flow-prompt` page + `flow-prompt-client.tsx` — brief form (optional product-select to prefill), Video Concept + Video Flow summary, per-scene cards with Copy Prompt, history list
- [~] Nav item added (`components/nav-items.ts`)
- [ ] Run migration 0009, smoke test a real generation, commit + push + deploy

## Flow Prompt Director (added beyond MASTER_PROMPT_V2 scope, supersedes "Gen Prompt" tab, large explicit spec)
"10 seconds of video = exactly 1 Google Flow Master Prompt (PART)" — replaces v1's free scene-count model. Integrated into Creative Generator (Idea/Script/Storyboard → "🎬 Flow Prompt" button) and usable standalone. Reuses/extends the existing `flow_prompts` table — old v1 rows and the old `flow-prompt-generator.ts`/v1 columns are untouched.
- [~] `0011_flow_prompt_director.sql` — additive `ALTER TABLE flow_prompts ADD COLUMN IF NOT EXISTS` (project_name, persona_id, source_type/source_id, content_input, platform, aspect_ratio, duration_sec, prompt_count, objective, primary_goal, style, script_mode, analysis, story_flow, continuity_bible, locks, parts, version, status, updated_at) + new `flow_prompts_update` RLS policy (0009 never defined one)
- [~] `lib/ai/context.ts` — added `getOptionalCreativeContext()` (new function; existing `getRelevantCreativeContext` untouched) for standalone use with no product linked
- [~] `prompts/flow-prompt-director.ts` — 3 prompt builders: Content Analysis (Hook Engine + flexible Story Flow + draft Continuity/Character Bible), Master Prompt Set (all PARTs in one call, respects locked PARTs as read-only context), Regenerate Single Part (Director Command surgical edits)
- [~] `POST /api/tools/flow-prompt/analyze` — step 1, not persisted (draft only)
- [~] `POST /api/tools/flow-prompt/generate` — step 2, rewrote from v1; splices locked PARTs back in code (not AI-trusted); EXACT_SCRIPT word-diff fidelity warning (non-blocking)
- [~] `POST /api/tools/flow-prompt/regenerate-part` — step 3, regenerates exactly one PART
- [~] `POST /api/tools/flow-prompt/save` — no-AI-call save (project name, manual PART text edits, lock state)
- [~] `components/flow-prompt-director-client.tsx` + `app/(dashboard)/flow-prompt/page.tsx` — 3-column layout: Source/Settings (left), Analysis cards + Story Flow + PART cards with Lock/Copy/Regenerate + Director Command (center), Project/Continuity Bible/History (right); Copy All + Export TXT/Markdown
- [~] `components/creative-generator-client.tsx` — "🎬 Flow Prompt" integration button added to Idea, Script, and Storyboard cards, deep-links with source_type + source_id, pre-fills content on the Director page
- [~] Nav label updated `Gen Prompt` → `Flow Prompt Director` (same route, no breaking change)
- [x] Migration 0011 run on Supabase (confirmed "Success. No rows returned")
- [ ] Smoke test the RICHTER CITY acceptance-test case (30s / Booking Form / Fast Sell-Live Commerce style / AUTO script → 3 PARTs, each individually copyable), commit + push + deploy

**Explicitly deferred to Phase 2 (per user's own priority split — do not build unless asked)**: Gold Prompt Library, full Prompt Version History/rollback UI (only a `version` counter exists now), advanced Director Command types beyond free-text, export formats beyond TXT/Markdown, Creative Score integration.

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
