
# ZANA Marketing OS — Claude Cowork Master Build Prompt

คุณคือ Principal Product Engineer + AI Architect + Growth Data Engineer
หน้าที่ของคุณคือสร้างระบบ Production-ready ชื่อ “ZANA Marketing OS”
สำหรับทีมแบรนด์ออนไลน์ที่ต้องผลิต Creative ทุกวัน คัดคลิปก่อนยิง Ads และเรียนรู้จากผลจริงเพื่อสร้าง Winner ซ้ำได้

## 0) หลักการสำคัญ
- อย่าสร้างแค่ Mockup
- ต้องเป็น Web App ที่ Run ได้จริง
- ต้องมี Database จริง
- ต้องรองรับ Upload Video และ Google Drive Link
- ต้องมี AI Analysis Pipeline จริง
- ต้องมี Creative Factory Workflow จริง
- ต้องมี Knowledge Base
- ต้องมี Performance Feedback Loop
- ทุกหน้าใช้ข้อมูลจริงจาก Database
- ห้าม hardcode demo data ใน production path
- ถ้าจำเป็นต้อง mock ให้แยก seed/demo mode ชัดเจน
- ทำงานเป็น phase และทดสอบทุก phase ก่อนขยับต่อ
- อย่ารื้อระบบส่วนที่ทำงานได้แล้วโดยไม่จำเป็น

---

# 1) Recommended Stack

Frontend:
- Next.js + TypeScript
- Tailwind CSS
- shadcn/ui
- Recharts

Backend / Database:
- Supabase Postgres
- Supabase Auth
- Supabase Storage

AI / Media:
- ffmpeg สำหรับ frame/audio extraction
- OpenAI API หรือ AI provider ที่ตั้งผ่าน environment variables
- Speech-to-text provider configurable
- Vision analysis จาก sampled frames
- Structured JSON output เท่านั้นใน scoring pipeline

Integration:
- Google Drive public/shared link MVP
- เตรียม abstraction สำหรับ Google OAuth ภายหลัง
- TikTok performance import เริ่มจาก CSV ก่อน
- เตรียม connector layer สำหรับ TikTok API ใน phase ถัดไป

Deployment:
- Vercel frontend/server routes
- Supabase backend

---

# 2) Core Operating Model

Creative Factory:

100 Ideas
↓
40 Scripts
↓
20 Videos
↓
10 Ads
↓
3 Winners
↓
Scale
↓
Winner DNA
↓
Knowledge Base
↓
สร้าง Ideas รุ่นถัดไป

ทุก asset ต้องมี ID และ lineage ย้อนกลับได้

ตัวอย่าง:
ZK-PERF-20260730-001

Idea → Script → Video → Ad Test → Winner/Loser → Learning

---

# 3) Main Navigation

1. Command Center
2. Creative Factory
3. Video Analyzer
4. Creative Library
5. Ads Performance
6. Winners
7. Knowledge Base
8. Products
9. Personas
10. Offers
11. Team
12. Settings

---

# 4) Command Center

แสดง KPI จริง:

- Ideas This Week
- Scripts Approved
- Videos Produced
- Ads Testing
- Winners
- Creative Score Average
- Winner Rate
- Ad Spend
- GMV
- ROAS
- Net ROI
- CPO

แสดง Funnel:

100 Ideas
→ 40 Scripts
→ 20 Videos
→ 10 Ads
→ 3 Winners

แสดง:
- Today's Top Creative
- Creative Bottleneck
- Products needing fresh creatives
- Fatigue alerts
- Action Queue

---

# 5) Creative Factory

ใช้ Kanban + Funnel View

Stages:
IDEA
SCRIPT
PRODUCTION
VIDEO_REVIEW
READY_FOR_ADS
ADS_TEST
WINNER
LOSER
SCALE
ARCHIVED

แต่ละ card:
- ID
- Product
- Persona
- Funnel
- Angle
- Hook
- Creative Format
- Owner
- Status
- Score
- Deadline
- Linked parent asset
- Notes

Actions:
- Generate ideas
- Generate script
- Approve
- Reject
- Assign
- Upload video
- Analyze video
- Send to Ads Test
- Mark Winner
- Generate Variations

---

# 6) 100 Ideas Generator

Input:
- Product
- Persona
- Funnel
- Objective
- Quantity
- Constraints
- Promotion
- Reference winner (optional)

AI ต้องสร้าง idea records โดยไม่ซ้ำมุม

Idea fields:
- title
- product_id
- persona_id
- funnel_stage
- creative_format
- pain_point
- emotional_trigger
- hook
- visual_concept
- product_placement
- mood_tone
- CTA
- organic_or_ads
- potential_score
- stop_scroll_reason
- risks
- source_type = AI
- generated_at

AI ต้องกระจาย angles เช่น:
- Social Anxiety
- Visual Metaphor
- Relatable Daily Pain
- Body Confidence
- Native Feed
- Product Demo
- UGC
- POV
- Review
- Comparison
- Experiment
- Founder
- Meme
- News
- Wanted Poster
- Case File
- Receipt
- Billboard
- Story
- Problem/Solution

จาก 100 ideas ให้ระบบ Rank และเลือก Top 40 ได้

---

# 7) Script Factory

ใช้โครง:

HOOK
→ BELIEF
→ STORY
→ PROOF
→ TURNING POINT
→ OFFER
→ CTA

ต้องเก็บ:
- full script
- shot list
- voice over
- on-screen text
- CTA
- estimated duration
- production notes
- script score

Script Score 100:
- Hook 20
- Clarity 15
- Emotional Trigger 15
- Product Fit 15
- Proof 10
- Offer 10
- CTA 10
- Compliance 5

Top scripts ถูกส่งต่อ Production

---

# 8) Video Analyzer

รองรับ:
A) Upload MP4/MOV/WEBM
B) Google Drive URL

Google Drive:
- ถ้าเป็น public/shareable link ให้ดาวน์โหลด server-side
- validate MIME / size
- ถ้าดาวน์โหลดไม่ได้ แสดง actionable error
- architecture ต้องพร้อมต่อ Google OAuth ภายหลัง

Pipeline:

Video
→ metadata
→ extract audio
→ transcript
→ sample frames
→ frame analysis
→ opening 0-3 sec analysis
→ pacing analysis
→ product appearance timestamps
→ CTA detection
→ offer detection
→ brand/compliance check
→ Creative Score
→ recommendations
→ store result

ห้ามส่ง video raw เข้าโมเดลถ้า provider ไม่รองรับ
ให้ใช้ ffmpeg frame sampling + transcript

Sample frame strategy:
- dense sampling 0–5s
- normal sampling หลัง 5s
- scene-change frames ถ้าทำได้
- configurable max frames

---

# 9) Creative Score AI

Creative Score = 100

Weights:
- Hook Power 20
- Attention / Pattern Interrupt 10
- Pain / Desire Match 10
- Message Clarity 10
- Product Integration 10
- Proof / Credibility 10
- Offer Strength 10
- CTA Strength 5
- TikTok Native Feel 5
- Editing / Pacing 5
- Brand Fit 3
- Compliance Risk 2

Output schema:

{
  "overall_score": 0,
  "verdict": "REJECT|REVISE|ORGANIC_TEST|ADS_TEST|PRIORITY_TEST",
  "dimension_scores": {},
  "strengths": [],
  "weaknesses": [],
  "timeline_findings": [],
  "recommendations": [],
  "predicted_funnel": {
    "awareness": 0,
    "consideration": 0,
    "conversion": 0
  },
  "risk_flags": [],
  "confidence": 0
}

Gate:
<60 = REJECT
60–74 = REVISE / ORGANIC TEST
75–84 = ADS TEST
85+ = PRIORITY TEST

สำคัญ:
Creative Score เป็น pre-flight filter เท่านั้น
ห้ามตีความเป็นการรับประกัน Performance

---

# 10) Performance Import

MVP:
- CSV import
- mapping columns
- preview ก่อน import

Fields:
- date
- creative_id
- campaign
- ad_group
- spend
- impressions
- video_views
- 2s_views
- 3s_views
- 6s_views
- 25pct_views
- 50pct_views
- 100pct_views
- clicks
- product_clicks
- orders
- GMV
- CPO
- CTR
- CVR
- ROAS
- commission
- voucher
- shipping
- COGS
- refunds

Calculated:

Net Contribution =
GMV
- COGS
- Commission
- Voucher
- Shipping
- Refunds
- Ad Spend

Net ROI =
Net Contribution / Ad Spend

ต้องรองรับ ad_spend = 0 อย่างปลอดภัย

---

# 11) Winner Engine

Winner ไม่ดู ROAS อย่างเดียว

ระบบต้องวิเคราะห์:
- Net ROI
- CPO
- CTR
- CVR
- Hook Rate
- Retention
- Spend confidence
- Number of orders
- Creative age
- Fatigue trend

Winner status:
- Emerging
- Confirmed
- Scaling
- Fatigued
- Retired

ต้องตั้ง thresholds ผ่าน Settings ได้

---

# 12) Winner DNA

เมื่อ Creative เป็น Winner ให้ AI สรุป DNA:

- Product
- Persona
- Pain
- Desire
- Funnel
- Creative Format
- Emotional Trigger
- Hook Family
- Exact Hook
- Opening Visual
- Product Appearance Time
- Proof Type
- Offer
- CTA
- Duration
- Creator
- Editor
- Why It Won
- Replicable Elements
- Elements To Avoid Copying Literally

Action:
“Generate Variations”

Variations:
- Hook x5
- Opening Visual x3
- Pain x3
- Offer x2
- CTA x3
- Creator angle x3

ต้องสร้าง child ideas ที่ linked กลับ Winner ต้นทาง

---

# 13) Learning / Feedback Loop

หลัง performance เข้ามา เปรียบเทียบ:

AI Creative Score
vs
Actual Performance

จัดประเภท:
- True Positive Winner
- False Positive
- True Negative
- False Negative Winner

โดยเฉพาะ False Negative Winner:
AI ให้ score ต่ำ แต่ตลาดชอบ

ระบบต้องบันทึก Learning:
- สิ่งที่ AI ประเมินผิด
- Metric จริง
- Pattern ใหม่
- Recommendation ให้ scoring rubric

ห้าม auto-modify scoring weights โดยไม่มี approval
ทำเป็น “Suggested Scoring Adjustment” ให้ Admin กดยืนยัน

---

# 14) Knowledge Base

Knowledge types:

PRODUCT
PERSONA
BRAND
OFFER
CREATIVE_PATTERN
WINNER_LEARNING
LOSER_LEARNING
COMPLIANCE
FAQ
CAMPAIGN
MARKET_INSIGHT

แต่ละ item:
- title
- type
- content
- tags
- product_ids
- persona_ids
- source
- confidence
- effective_from
- effective_to
- status
- created_by
- updated_at

AI generation ทุกครั้งต้อง query Knowledge Base ที่เกี่ยวข้องก่อน

Priority:
1. Active business truth
2. Latest approved facts
3. Product-specific rules
4. Historical learnings

ห้ามเอาข้อมูล deprecated ไปใช้

---

# 15) Product Database

Fields:
- brand
- SKU
- product_name
- category
- status
- selling_price
- promotion_price
- COGS
- commission_rate
- shipping_subsidy
- USP
- ingredients/material
- benefits
- usage
- customer objections
- allowed claims
- banned claims
- compliance notes
- stock
- hero status

---

# 16) Persona Database

Fields:
- name
- age range
- life stage
- pains
- desires
- objections
- triggers
- preferred language
- content formats
- funnel notes
- products

---

# 17) Team / Accountability

Roles:
- Admin
- Owner
- Content Lead
- Creator
- Editor
- Media Buyer
- Viewer

Track:
- idea creator
- script owner
- creator
- editor
- approver
- media buyer

Team analytics:
- videos produced
- avg Creative Score
- Winner Rate
- avg CTR
- avg CPO
- avg Net ROI

ห้ามใช้ ranking แบบลงโทษ
ใช้เพื่อหา skill fit และ coaching opportunity

---

# 18) Database Tables

สร้าง migration จริงอย่างน้อย:

profiles
products
personas
offers
knowledge_items
ideas
scripts
videos
video_analysis
creative_scores
campaigns
ad_creatives
performance_daily
winner_dna
creative_learnings
tasks
activity_logs
settings

ใช้ foreign keys
indexes
timestamps
soft-delete/status เมื่อเหมาะสม

เปิด RLS ใน Supabase
กำหนด policies ตาม role

---

# 19) Storage

Buckets:
- videos
- thumbnails
- attachments
- exports

Video paths:
{workspace}/{product}/{year}/{month}/{creative_id}/original.ext

Generate thumbnail อัตโนมัติ

---

# 20) Search

Global Search:
- Creative ID
- Product
- Hook
- Persona
- Creator
- Winner
- Knowledge

Filter:
- Product
- Funnel
- Score range
- Status
- Date
- Owner
- Winner/Loser
- Format

---

# 21) UI Direction

Style:
- Clean enterprise dashboard
- Black / white / charcoal
- Accent red + cyan/teal
- Data dense แต่ไม่รก
- Mobile responsive
- Desktop-first

Creative Score:
- score gauge
- dimension bars
- transcript panel
- timeline findings
- frame strip
- AI recommendation
- approve/reject buttons

ใช้ภาษาไทยเป็น Default
รองรับ English labels บางส่วน

---

# 22) Seed Business Knowledge

เตรียม seed แต่แยกจาก production data

Brands:
- ZANA
- ZANA Kid
- Kyra

ตัวอย่างสินค้าจากธุรกิจ:
- Kid Perfume
- Maternity Pants
- HYA Vitamin C
- Alpha Arbutin
- Alpha Purple
- Kid Eyebrow

ให้สร้าง UI สำหรับแก้ไขข้อมูลทั้งหมดภายหลัง
อย่าฝังข้อมูลสินค้าลง code

---

# 23) Settings

AI:
- provider
- model name
- temperature
- max frames
- transcription provider
- scoring prompt version

Performance:
- winner thresholds
- minimum spend
- minimum orders
- fatigue threshold
- Net ROI targets

Workflow:
- idea approval
- script approval
- video score gate

Integration:
- Google Drive
- TikTok import
- future TikTok API

---

# 24) Auditability

ทุก AI result ต้องเก็บ:
- provider
- model
- prompt_version
- input references
- response JSON
- tokens/cost ถ้ามี
- created_at

ทุก manual override:
- user
- old value
- new value
- reason
- timestamp

---

# 25) Security

- API keys อยู่ server-side env เท่านั้น
- ห้าม expose key ฝั่ง browser
- validate file types
- file size limits
- signed URLs
- auth required
- RLS
- rate limit AI endpoints
- sanitize filenames
- never execute uploaded content

---

# 26) Environment Variables

สร้าง .env.example:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

AI_PROVIDER=
OPENAI_API_KEY=
AI_MODEL=
TRANSCRIPTION_MODEL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

APP_URL=

ห้ามใส่ real secret

---

# 27) API / Server Actions

ต้องมี:

POST /api/ideas/generate
POST /api/scripts/generate
POST /api/videos/upload
POST /api/videos/import-drive
POST /api/videos/:id/analyze
POST /api/performance/import
POST /api/winners/:id/generate-variations
POST /api/knowledge/query

GET /api/dashboard
GET /api/creative/:id
GET /api/winners
GET /api/performance

---

# 28) Error Handling

ทุก integration ต้องมี:
- timeout
- retry
- readable error
- status
- logs

Video analysis status:
UPLOADED
PROCESSING
TRANSCRIBING
ANALYZING
SCORING
DONE
FAILED

Frontend แสดง progress

---

# 29) Build Order

Phase 1:
- Scaffold
- Auth
- DB
- Navigation
- Products / Personas / Knowledge Base CRUD

Phase 2:
- Creative Factory
- Ideas
- Scripts
- Workflow

Phase 3:
- Video Upload
- Drive Import
- ffmpeg
- Transcript
- Frame Extraction
- Creative Score

Phase 4:
- Performance CSV
- Dashboard
- Net ROI
- Winners

Phase 5:
- Winner DNA
- Variations
- Feedback Loop
- Learning

Phase 6:
- QA
- RLS
- error handling
- deployment docs

หลังจบแต่ละ Phase:
1. run lint
2. typecheck
3. tests
4. run app
5. fix errors
6. commit checkpoint

---

# 30) Definition of Done

ถือว่างานเสร็จเมื่อ:

1. Login ได้
2. เพิ่ม Product / Persona / Knowledge ได้
3. Generate 100 Ideas ได้จริง
4. เลือก Idea → Generate Script ได้
5. Upload Video ได้
6. Google Drive public link import ได้
7. Video ถูก extract transcript + frames
8. AI คืน Creative Score structured JSON
9. Dashboard แสดง Score
10. สามารถ Approve → Ads Test
11. Import TikTok performance CSV ได้
12. ระบบคำนวณ Net ROI
13. ระบบเลือก Winner
14. Winner สร้าง DNA
15. Generate Variations ได้
16. Learning ถูกบันทึกกลับ Knowledge Base
17. ระบบ deploy ได้
18. README อธิบาย setup ครบ

---

# 31) เริ่มทำงานตอนนี้

เริ่มจาก:
1. ตรวจสอบ directory ปัจจุบัน
2. ถ้ามี project อยู่แล้ว ให้ audit ก่อน ห้าม overwrite
3. ถ้ายังไม่มี ให้ scaffold project ใหม่
4. สร้าง PLAN.md
5. สร้าง TODO.md
6. Implement Phase 1
7. Run app + tests
8. รายงานสิ่งที่เสร็จ สิ่งที่ยังขาด และคำสั่ง run

อย่าหยุดแค่เสนอ architecture
ลงมือแก้ไฟล์และสร้างระบบจริง
