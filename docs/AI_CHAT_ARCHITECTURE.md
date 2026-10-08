# AI Sales Chat — architecture audit and MVP plan

Audit date: 2026-10-07. Scope: existing ZANA Marketing OS, Facebook Messenger MVP.

## 1. Current architecture
- Next.js 14.2.15 App Router, React 18, TypeScript strict; Tailwind with shared warm cream/terracotta CSS, Kanit/Sarabun, SideNav/NavGroups.
- Route Handlers + Server Actions; Supabase Postgres/Auth/Storage. User-scoped server client and service-role client already exist in lib/supabase/server.ts.
- profiles: owner/admin/content_lead/creator/editor/media_buyer/viewer with approval status added in migration 0022. Middleware uses Supabase cookies and approval gate.
- Existing products, offers (separate promotions with effective dates), knowledge_items, settings, campaigns/ad_creatives/performance_daily and ad_* automation tables. No customer/conversation/order tables found in repository migrations 0001–0028.
- Creative/Marketing Brain use lib/ai/context.ts and lib/ai/openai.ts. Existing OpenAI caller provides JSON mode but does not return usage or strict chat safety output. Preserve its consumers; new chat adapter uses the same server-side OPENAI_API_KEY, with explicit model configuration.
- Existing APIs: /api/creative/*, /api/tools/*, /api/models/*, /api/prompt-library/*, /api/video-prompt-studio/*, /api/automation/knowledge-ingest. Ads jobs already use Supabase pg_cron + pg_net + Vault.
- Hosting: repository handoff identifies Vercel and https://mktos.zanadynasty.com. Live provider configuration was not verified. No deployment is performed by this change.
- Environment names inspected without printing values: Supabase URL/anon/service role, OPENAI_API_KEY, AI_MODEL, TRANSCRIPTION_MODEL, APP_URL, TAMSUB_API_TOKEN, META_API_VERSION, META_SYSTEM_USER_TOKEN, ADS_AUTOMATION_DRY_RUN. Messenger secrets absent locally.
- Baseline TypeScript check passed. Existing uncommitted Flow Prompt work, TODO, handoff and migration 0028 are preserved.
- Initial sandboxed database access failed; a later read-only network check succeeded. Required columns in products/offers/knowledge_items/profiles/settings returned HTTP 200 with limit=0; customers/conversations/messages/chat_customers returned 404. This confirms the required existing schema is exposed, not that every historical migration has run.

## 2. Reuse
Reuse dashboard shell/styles, Supabase Auth + approved profiles, existing server clients, products/knowledge editors, separate offers, settings storage and the existing scheduled-job pattern. Do not duplicate CRM/product catalog, replace auth, or change the existing AI settings row.

## 3. Additions / data flow
Meta -> signed raw-body webhook -> atomic Postgres ingestion (customer + conversation + message + durable job) -> authenticated worker -> bounded recent history + evidence-backed memory + relevant product/knowledge + currently valid offers -> OpenAI strict JSON -> policy/handoff + score -> persisted outbound -> Meta Send API.

The webhook acknowledges only after persistence; it never awaits OpenAI. Unique page/message keys prevent duplicate ingestion. A per-conversation lease serializes worker jobs. Stale generation can be retried; ambiguous outbound delivery is marked uncertain and sent to an admin, never blindly resent. Take Over/Close/AI OFF invalidate pending AI replies; a network send already dispatched cannot be recalled.

MVP supports one configured Facebook Page. Channel and external identifiers are stored separately for future adapters; Instagram/LINE/TikTok are not implemented. Default automatic replies are OFF until secrets, worker, knowledge and models are verified.

## 4. Safe additive migration
0029_ai_sales_chat.sql adds chat_customers, chat_conversations, chat_messages, chat_customer_memory, chat_jobs, chat_product_knowledge and chat_rate_limits, plus service-only transactional RPCs and aggregate analytics. FKs point to existing profiles/products; no destructive SQL or modification of existing rows. A restrictive RLS policy protects only the new settings key ai_chat without changing older settings keys. New personal-data tables have RLS for approved owner/admin/content_lead only. Browser writes are not granted: mutations pass authenticated server APIs. Offers remain in the existing table.

Customer identity is unique by channel + Page + PSID, not PSID globally. Messages include attachments/postback/referral and provider IDs. Referral ad IDs are retained for future attribution; purchase intent is not a verified sale. No invented orders or revenue metrics.

## 5. APIs / UI
- GET/POST /api/integrations/meta/webhook: verification, SHA256 HMAC, Page allowlist, text/attachments/postbacks/referrals, echo/delivery/read exclusion.
- POST /api/ai-chat/worker: secret-authenticated scheduler, up to three sequential jobs per invocation within a bounded time budget.
- GET/POST /api/ai-chat: approved operator API for inbox, history, customer notes/tags, assignment, take over, return to AI, close, queued admin replies, analytics. Owner/admin configure models/rules/product facts/promotions.
- /ai-chat: Inbox, Conversations, Customers, Knowledge Base, AI Rules, Analytics tabs. Desktop three columns, stacked mobile panels, loading/error/empty states. /settings links to chat model/rule settings.

## 6. Security and constraints
HMAC over raw bytes, constant-time comparison, payload size limits, Zod validation, shared database rate limits, session/approved-role checks, same-origin mutation checks, service-only queue RPCs, secrets in environment only, generic error codes (no provider payload/credentials logged).

AI never reads other customers, ERP data, costs/margins or credentials. Context is allowlisted. Memory is limited to exact quotations from customer messages; no guessed child age, preferences, phone, purchase or prior products. Complaint/refund/payment/order/sensitive/angry/human-request/low-confidence/missing evidence triggers handoff. Pricing and promotions come from database each response, not the system prompt. Messenger replies enforce the standard 24-hour window; no message tags or unsolicited sends.

Existing broad RLS on older unrelated tables is outside this module's scope. New RLS explicitly checks approval. Current Meta platform setup/permissions/review requirements must be verified in the owner's Developer console before launch; official Meta docs were not accessible in this environment.

## 7. Deployment plan / required owner inputs
1. Review and apply 0029 against staging after confirming existing table/column prerequisites; run the included database tests there. No production migration is auto-applied.
2. Configure META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_APP_SECRET, META_VERIFY_TOKEN, META_MESSENGER_API_VERSION and AI_CHAT_WORKER_SECRET on the existing host; reuse Supabase and OPENAI_API_KEY. Optional CHAT_FAST_MODEL/CHAT_SALES_MODEL/CHAT_ADVANCED_MODEL are fallbacks; UI overrides them.
3. Deploy existing Next app. Register exact public webhook URL, subscribe the Page to messages/messaging_postbacks/messaging_referrals as appropriate, ensure required Messenger permissions/app mode/review.
4. Configure optional scheduler SQL using Vault, following existing pg_cron/pg_net pattern. Every minute invokes POST /api/ai-chat/worker; each invocation handles up to three jobs within its time budget; generation and outbound are separate jobs, so capacity must be measured with real traffic. Scale worker scheduling only after volume measurements.
5. Enter approved sales knowledge and dated offers. Verify models support Responses API Structured Outputs. Keep enabled=false while testing controlled Page conversations.
6. Verify all 15 requested scenarios, role restrictions/RLS, mobile/tablet/desktop, timeout/dedup/takeover and window expiry. Enable AI via owner/admin settings only after live end-to-end validation.
7. Rollback: disable ai_chat.enabled and unschedule worker; retain stored conversations and leave additive schema intact.

## References
OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs (fetched 2026-10-07). Use strict schema plus independent runtime validation, handle refusal/incomplete responses and store=false.
Meta setup references to verify before go-live: https://developers.facebook.com/docs/messenger-platform/webhooks/ and https://developers.facebook.com/docs/messenger-platform/send-messages/ (fetch unavailable during audit).


## Verification update
Local build/type/lint and 29 automated core/database tests passed; UI verified with isolated fixtures at three viewport sizes; ten production-build HTTP checks passed. One real OpenAI Hello probe returned HTTP 401 using the local credential, so model/runtime support remains unverified. No Messenger sends, production migration or deployment occurred. See AI_CHAT_DELIVERY.md for evidence boundaries and remaining setup.

