# ZANA Marketing OS V2 — Claude Cowork Master Prompt

คุณคือ Principal Product Engineer + AI Product Architect + Full-stack Engineer
สร้างระบบ Production-ready ชื่อ “ZANA Marketing OS” โดยยึดหลักว่า “กระชับ ใช้งานจริงทุกวัน และไม่กลายเป็น Kanban / Project Management System”

## Product Vision
Core flow เดียว:
Knowledge Base + Product + Persona
→ Creative Generator
→ Generate Ideas (กำหนดจำนวนได้)
→ เลือก Idea
→ Generate Scripts (กำหนดจำนวนได้)
→ เลือก Script
→ Generate Video Storyboards (กำหนดจำนวนและจำนวน Scene ได้)
→ นำ Storyboard ไปถ่าย/Gen AI/ตัดต่อ “นอกระบบ”
→ Final Video ขึ้น Google Drive
→ นำ Google Drive Link กลับเข้าระบบ
→ AI Video Analyzer
→ Creative Score + Timestamp Fix Recommendation + Revised V2 Recommendation

ห้ามขยาย scope ไปเป็น Production Management เต็มรูปแบบ
ห้ามทำ Kanban หลายสถานะ
ห้ามทำ Campaign Manager / CRM / ERP / Ads Manager ใน V1

## UX Direction
อ้างอิงความเรียบง่ายจากระบบ AI Content Factory เดิม:
- Dashboard เรียบ
- ฟอร์มชัด
- เมนูน้อย
- Generate AI เร็ว
- หน้าเดียวใช้งานต่อเนื่อง
- ไม่ใช้ drag-and-drop Kanban
- Thai-first UI

## Stack
Frontend: Next.js + TypeScript + Tailwind + shadcn/ui
Backend: Supabase Postgres + Auth + Storage
AI: provider configurable ผ่าน env, Structured JSON + Zod
Video: ffmpeg + ffprobe
Google Drive: V1 รองรับ public/shared link
Deploy: Vercel + Supabase

## Main Navigation
1. Dashboard
2. Creative Generator
3. Video Analyzer
4. Knowledge Base
5. Products
6. Personas
7. Winners / Learnings
8. Settings

## Dashboard
แสดง:
- Ideas Generated
- Scripts Generated
- Storyboards Generated
- Videos Analyzed
- Average Creative Score
- Ready to Test
- Recent Creative: Product / Hook / Score / Verdict / Date
- Action Queue 3–5 ข้อ

ไม่ต้องมี GMV / Ad Spend / ROAS ใน V1

## Creative Generator
หน้าเดียวแบบ 3 Step Progressive Flow

### STEP 1 — Generate Ideas
Input:
- Product
- Persona
- Funnel: Awareness / Consideration / Conversion / Retention
- Objective
- Platform: TikTok / Facebook Reels / Instagram Reels / Marketplace
- Content Style / Creative Format
- Promotion / Offer
- Optional Brief
- จำนวน Idea: 5 / 10 / 20 / Custom

AI ต้องดึง context อัตโนมัติ:
Product + Persona + Brand Rules + Content Rules + Winning Creative + Learnings

แต่ละ Idea:
- Title
- Funnel
- Creative Format
- Pain Point
- Emotional Trigger
- Hook
- Visual Concept
- Product Role
- Mood & Tone
- CTA
- Organic / Ads
- Potential Score 1–10
- Stop-scroll Reason
- Risk

Actions:
Generate Script / Regenerate / Duplicate / Save / Delete

กระจาย angle และหลีกเลี่ยงซ้ำ:
Social Anxiety, Visual Metaphor, Relatable Pain, Emotional Story, Product Demo, UGC, POV, Review, Comparison, Experiment, Founder, Meme, News Style, Wanted Poster, Case File, Receipt, Billboard, Identity, Routine, Myth/Belief Shift

### STEP 2 — Generate Scripts
ผู้ใช้เลือก Idea แล้วกำหนดจำนวน Script: 1 / 3 / 5 / Custom

Framework บังคับ:
HOOK
→ BELIEF
→ STORY
→ PROOF
→ TURNING POINT
→ OFFER
→ CTA

แต่ละ Script ต้องมี:
- Script Title
- Hook
- Belief
- Story
- Proof
- Turning Point
- Offer
- CTA
- Full Script
- Voice Over
- On-screen Text
- Estimated Duration
- Shot List
- Caption
- Hashtags
- Compliance/Risk Note

Actions:
Generate Storyboard / Regenerate / Duplicate / Copy / Save

### STEP 3 — Generate Storyboards
ผู้ใช้กำหนด:
- จำนวน Storyboard
- จำนวน Scene
- Duration target
- Video Style
- AI / Real Footage mix

แต่ละ Scene ต้องมี:
1. Scene Number
2. Time Range
3. Scene Objective
4. Visual Description
5. Source Type: AI Generated / Real Footage / Product Footage / B-roll
6. Subject Action
7. Camera Shot
8. Camera Movement
9. Voice Over
10. Dialogue
11. On-screen Text
12. Sound Cue
13. Music Cue
14. Transition
15. Product Placement
16. Editing Note
17. AI Video Prompt (ถ้า Source = AI)

Camera Shot: Extreme Close-up / Close-up / Medium / Wide / Top-down / Macro / POV
Movement: Static / Pan / Tilt / Push-in / Pull-out / Tracking / Handheld / Follow

Storyboard Display:
ตาราง Scene | Time | Visual | Source | Camera | VO | Text | Sound | Edit

Actions:
Copy All / Copy Scene / Export TXT / Export Markdown / Export PDF / Export Google Flow Prompt / Export AI Video Prompt / Regenerate Scene / Regenerate Full Storyboard

V1 ไม่ต้องมี internal video editor

## Production Outside System
Storyboard → AI Video/Real Shoot/Product Footage → CapCut/Premiere → Final MP4 → Google Drive

## Video Analyzer
Input:
- Google Drive Link
- Product
- Persona
- Objective
- Platform
- Original Idea optional
- Original Script optional
- Original Storyboard optional

Button: Analyze Video

V1:
- public/shared Drive link
- MP4/MOV/WEBM
- ถ้าดาวน์โหลดไม่ได้ ให้แจ้ง permission “Anyone with the link”
- error ต้องอ่านรู้เรื่อง

## Video Analysis Pipeline
Google Drive Link
→ Download
→ ffprobe metadata
→ Extract audio
→ Speech-to-text
→ Sample frames
→ Dense sample 0–5 sec
→ Scene analysis
→ Product appearance
→ Hook analysis
→ Pacing
→ Message
→ Proof
→ Offer/CTA
→ Storyboard comparison (ถ้ามี)
→ Creative Score
→ Fix Recommendations

Progress:
DOWNLOADING / EXTRACTING / TRANSCRIBING / ANALYZING / SCORING / DONE / FAILED

## Creative Score
7 dimensions:
- Hook 20
- Retention/Pacing 15
- Message Clarity 15
- Product/Benefit Integration 15
- Proof/Trust 10
- Offer/CTA 15
- Native/Execution 10
Total 100

Compliance แยกเป็น Risk Check ไม่รวม Performance Score

Verdict:
<60 REJECT
60–74 REVISE
75–84 READY TO TEST
85+ PRIORITY TEST

Creative Score เป็น pre-flight filter ไม่ใช่ performance guarantee

## Score Output
- Overall Score
- Verdict
- 7 Dimension Breakdown
แต่ละ dimension: Score / What Works / What Hurts / Recommendation

## Timestamp Fix Recommendation
AI ต้องคืน timeline เช่น:
00:00–00:02 KEEP — Hook ดี
00:05–00:08 FIX — Pacing ตก แนะนำตัด 1.5 sec
00:08 FIX — Product reveal ช้า แนะนำขยับไป 00:04
00:13–00:16 IMPROVE — เพิ่ม Proof

Schema:
{
  "start_time":"",
  "end_time":"",
  "status":"KEEP|FIX|IMPROVE",
  "finding":"",
  "recommendation":""
}

## Storyboard vs Final Comparison
ถ้ามี Storyboard:
Compare scene order / hook / product reveal / proof / CTA / pacing / missing scenes / text / sound cues
แสดง Followed / Changed / Missing / Recommendation

ตัวอย่าง:
Storyboard product reveal 4.0s
Final 8.7s
Result: Final เข้า Product ช้ากว่าแผน 4.7s

## Revised V2 Recommendation
AI ต้องสร้าง:
1. Priority Fixes 1–5
2. Revised Script V2 ใช้ Framework เดิม
3. Revised Edit Plan
4. ปุ่ม Generate V2 Storyboard

## Knowledge Base
มี 6 หมวด:
PRODUCT
PERSONA
BRAND
CONTENT_RULES
WINNING_CREATIVE
LEARNINGS

Fields:
Title / Type / Content / Tags / Related Product / Related Persona / Status / Effective Date / Source / Last Updated

AI generation ทุกครั้งต้อง retrieve relevant knowledge ก่อน
Priority:
1 Product truth
2 Latest brand rules
3 Persona insight
4 Content rules
5 Winner patterns
6 Learnings
Deprecated ห้ามใช้

## Products CRUD
Brand / Product Name / SKU / Category / Selling Price / Promotion / COGS / USP / Ingredients or Material / Benefits / Usage / Customer Objections / Allowed Claims / Banned Claims / Compliance Notes / Hero Product / Status

## Personas CRUD
Name / Age / Life Stage / Pain Points / Desires / Objections / Buying Triggers / Language Style / Content Preferences / Funnel Notes / Related Products

## Winners / Learnings
V1 ไม่ต่อ Ads API
ผู้ใช้ mark video เป็น Winner เอง
เก็บ:
Video / Product / Hook / Format / Persona / Funnel / Score / Why It Won / Replicable Pattern / Notes
Actions:
Use as Reference / Generate New Ideas From Winner

## Database Tables
profiles
products
personas
knowledge_items
ideas
scripts
storyboards
videos
video_analysis
winners
settings

ห้ามสร้าง campaign / ad_group / task / kanban tables ใน V1

## Suggested Tables
ideas: id, product_id, persona_id, title, funnel, format, pain, trigger, hook, visual, product_role, mood, cta, organic_or_ads, potential_score, stop_scroll_reason, risks, created_at

scripts: id, idea_id, title, hook, belief, story, proof, turning_point, offer, cta, full_script, voice_over, on_screen_text, shot_list, caption, hashtags, duration, risks, created_at

storyboards: id, script_id, title, duration, scene_count, style, scenes jsonb, created_at

videos: id, product_id, storyboard_id nullable, google_drive_url, local_storage_path nullable, duration, status, created_at

video_analysis: id, video_id, transcript, metadata jsonb, sampled_frames jsonb, score_total, score_breakdown jsonb, verdict, timeline_findings jsonb, storyboard_comparison jsonb, priority_fixes jsonb, revised_script jsonb, revised_edit_plan jsonb, risk_flags jsonb, model, prompt_version, created_at

## Prompt Architecture
/prompts
- idea-generator.ts
- script-generator.ts
- storyboard-generator.ts
- video-analyzer.ts
- creative-score.ts
- v2-rewrite.ts

ห้ามฝัง prompt ใหญ่ใน component
ทุก AI response structured JSON + Zod

## Context Retrieval
ก่อน Generate:
1 fetch Product
2 fetch Persona
3 fetch relevant Knowledge
4 fetch Winners/Learnings
5 compile compact context
6 call AI

สร้าง function getRelevantCreativeContext()
ห้ามส่ง Knowledge ทั้งฐานแบบไม่กรอง

## Google Drive Import
- รับ public/shared Drive link
- extract file id
- download server-side
- validate type + size
- temp file
- analyze
- cleanup temp

Errors:
Permission denied / Invalid link / File too large / Unsupported format / Download failed
แสดงภาษาไทยที่อ่านรู้เรื่อง

## Cost Control
- Dense frames 0–5 sec
- หลังจากนั้น 1 frame / 2–3 sec
- scene-change frames ถ้าทำได้
- max frames configurable
- resize frames
- transcript once
- batch vision where possible
Settings: max minutes / max frames / model / transcription model

## UI Style
Modern clean SaaS
White/light gray + dark navy header + blue/green accents
คล้าย AI Content Factory เดิม แต่ professional ขึ้น
compact form / rounded cards / readable tables / Thai-first / desktop-first responsive
ห้าม sidebar ใหญ่ถ้า top nav พอ

## Creative Generator UX
หน้าเดียว 3 Step:
1 Ideas
2 Scripts
3 Storyboards
ใช้ tabs หรือ progressive sections
Product → 10 Ideas → Script → Storyboard ต้องจบใน flow เดียว

## Video Analyzer UX
ด้านบน:
Drive Link + Product + Storyboard(optional) + Analyze
ด้านล่าง:
Video Preview / Creative Score / Breakdown / Timeline Fixes / Storyboard Comparison / Priority Fixes / Revised Script V2 / Generate V2 Storyboard

## Settings
AI: Provider / Model / Temperature / Max ideas / Max scripts / Max storyboards / Max scenes / Max frames / Max duration / Prompt version
Scoring: weights / thresholds
Drive: public link mode, OAuth reserved future

## Security
API keys server-side only
Supabase RLS
signed/private storage
validate Drive URL
sanitize filenames
file size limit
timeouts
AI rate limit
never execute uploaded files
no secrets in frontend

## ENV
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=openai
OPENAI_API_KEY=
AI_MODEL=
TRANSCRIPTION_MODEL=
APP_URL=http://localhost:3000

## Required API / Actions
POST /api/creative/ideas/generate
POST /api/creative/scripts/generate
POST /api/creative/storyboards/generate
POST /api/video/import-drive
POST /api/video/:id/analyze
POST /api/video/:id/generate-v2
GET /api/dashboard
GET /api/products
GET /api/personas
GET /api/knowledge
GET /api/winners

## Explicitly Out of Scope V1
Kanban
Task assignment
Deadline workflow
Production tracking
Campaign Manager
TikTok Ads API
Meta Ads API
Ad Spend/ROAS dashboard
CSV Performance Import
CRM
ERP
Stock management
Live Commerce
Media Buyer workflow
Team KPI
Approval hierarchy หลายชั้น

ถ้ามี code เดิม ให้ isolate/hide จาก primary navigation แทนการลบแบบเสี่ยงพัง

## Definition of Done
1 Login
2 Product CRUD
3 Persona CRUD
4 Knowledge CRUD
5 Generator ดึง Product+Persona+Knowledge
6 Generate Ideas ตามจำนวน
7 Idea→Scripts ตามจำนวน
8 Script ใช้ 7-step framework
9 Script→Storyboard
10 scene-by-scene production-ready
11 กำหนดจำนวน Storyboard/Scene
12 Copy/Export
13 Drive public link import
14 Transcript
15 Analyze frames/timeline
16 Creative Score 7 dimensions
17 Timestamp Fixes
18 Compare Storyboard vs Final
19 Revised Script V2
20 Generate V2 Storyboard
21 Mark Winner
22 Winner/Learning ถูกใช้รอบถัดไป
23 lint/typecheck/test ผ่าน
24 deploy ได้
25 README ครบ

## Build Order
Phase 1 Foundation: audit / PLAN / TODO / Supabase / Auth / Products / Personas / Knowledge / Settings
Phase 2 Creative Generator: Ideas / Scripts / Storyboards / Save / Copy / Export
Phase 3 Video Analyzer: Drive / ffmpeg / transcript / frames / AI analysis / Score / timeline
Phase 4 V2 Loop: compare / revised script / V2 storyboard / winners
Phase 5 QA Deploy: security / RLS / errors / loading / cost / responsive / docs / deploy

หลังทุก Phase:
run app → lint → typecheck → tests → fix → checkpoint

## Existing AI Content Factory Migration Rule
ถ้ามีระบบเดิม:
- audit ก่อน
- reuse auth/UI/integration ที่ดี
- preserve working parts
- อย่า rewrite ทุกอย่างโดยไม่จำเป็น
แต่ primary flow ต้องกลายเป็น:
Creative Generator → Idea → Script → Storyboard → Final Video Link → Analyzer → Creative Score

เมนูเดิม เช่น ติดตามงานผลิต / กรอกผลลัพธ์ ให้ hide/archive/de-prioritize ใน V1

## Start Now
1 ตรวจ directory
2 Audit ระบบเดิม
3 สรุปสิ่งที่ reuse
4 สร้าง PLAN.md
5 สร้าง TODO.md
6 ปรับ Navigation ตาม V2
7 Implement Phase 1
8 Run + Test
9 ผ่านแล้วทำ Phase 2 ต่อ
10 อย่าหยุดที่ architecture

เป้าหมายคือระบบที่ “กดใช้งานได้จริง” ไม่ใช่ mockup / Figma / เอกสารอย่างเดียว
