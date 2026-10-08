# AI Sales Chat — ส่งมอบ MVP และขั้นตอนเปิดใช้งาน

วันที่ตรวจ: 7 ตุลาคม 2026 · โปรเจกต์เดิม `E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork`

## สถานะที่ยืนยันได้

เพิ่มโค้ด MVP ในระบบเดิมและผ่านการทดสอบในเครื่องแล้ว **ยังไม่ได้เปิดใช้งานบน Production**

**อัปเดต 8 ตุลาคม 2026:** รัน `0029_ai_sales_chat.sql` บน Supabase production (`zana-marketing-os`) แล้ว สำเร็จใน transaction เดียว ตรวจหลังรันแล้ว: ทั้ง 7 ตารางเปิด RLS, ฟังก์ชันที่แก้ข้อมูลเรียกได้เฉพาะ service role, policy เดิมของ `settings` ครบและแถว key `ai` เดิมไม่ถูกแตะ, analytics รันได้บนข้อมูลว่าง ยังไม่มี key `ai_chat` ใน settings จึงใช้ค่าเริ่มต้น = **ปิดตอบอัตโนมัติ** โค้ดที่ใช้ตารางเหล่านี้ยังไม่ถูก deploy จนกว่าจะ merge PR

| ส่วนงาน | ผล |
|---|---|
| Audit / Architecture | เสร็จ: `docs/AI_CHAT_ARCHITECTURE.md` |
| Messenger Webhook | ยืนยัน challenge, HMAC, Page allowlist, ข้อความ/ไฟล์แนบ/postback/referral และบันทึกแบบ transaction |
| AI Chat Inbox | 6 แท็บ: Inbox, Conversations, Customers, Knowledge Base, AI Rules, Analytics |
| ลูกค้าและบทสนทนา | จัดเก็บจริงใน Supabase หลังรัน Migration; ไม่ใส่ข้อมูลตัวอย่างใน Production |
| AI/Human | Take Over, AI OFF, Return to AI, Close, Assign Admin; ส่งข้อความแอดมินผ่านคิว |
| Customer Memory | เก็บข้อความอ้างอิงพร้อม message ID; ไม่เดาข้อมูลส่วนบุคคล; สรุปแบบคัดข้อความจริง |
| ความรู้ | Reuse สินค้า / Knowledge Base / offers เดิม, เพิ่มหน้าตรวจอนุมัติข้อมูลขายรายสินค้า |
| ราคา/โปรโมชั่น | อ่านข้อมูลที่มีผลในปัจจุบัน และตรวจอีกครั้งก่อนส่งคำตอบที่อยู่ในคิว |
| AI Router | Fast/Sales/Advanced ตั้งค่าได้; fallback ไปค่าระบบเดิม; ไม่เปลี่ยน Creative AI settings |
| Intent / Score | 12 intents, sentiment, purchase intent, score 0–100, weights ตั้งค่าได้; ร้องเรียนไม่เพิ่มคะแนน |
| ส่งต่อทีม | แสดงคิวรอแอดมิน พร้อมเหตุผล สรุป ความสนใจ คะแนน และข้อความล่าสุด |
| Analytics | บทสนทนา AI/คน/รอทีม, handoff/resolution, lead, response time, intent/product/question, tokens และ estimated cost เมื่อใส่อัตราจริง |
| Attribution | เก็บ referral/ad ID สำหรับต่อยอดภายหลัง; ยังไม่อ้างยอดขาย/Revenue/ROAS ที่ไม่มี Order จริง |

## ผลทดสอบ

- `node --test tests/ai-chat.test.cjs` พร้อม PGlite: **29 ผ่าน, 0 ล้มเหลว** รวม Migration/transaction, deduplication, queue lease, Take Over ระหว่างประมวลผล, Return to AI, High Score, admin-send idempotency, window 24 ชม., RLS และ uncertain delivery
- **10 HTTP checks ผ่าน** บน Production Build ที่เปิดในเครื่อง: verification สำเร็จ/ผิด token, signature ผิด, signed invalid payload, worker ไม่มีสิทธิ์, operator API, near-match path, Inbox, Settings และ Login
- **3 ขนาดจอผ่าน**: Desktop 1440×1000, Tablet 820×1180, Mobile 390×844 ใช้ component จริงกับ API fixtures ในพื้นที่ทดสอบเท่านั้น: Inbox, Take Over, admin send, AI Rules, Knowledge Base, Analytics; ไม่มี JavaScript exception และไม่มี page overflow แนวนอน ตรวจภาพ Desktop/Mobile แล้ว
- `npm run typecheck -- --incremental false`: ผ่าน
- `npm run lint`: ผ่านโดยมี warnings ใน component รูปภาพเดิม
- `npm run build`: ผ่าน; `/ai-chat` และ API ใหม่ปรากฏใน build routes
- คำเตือนเดิมที่ยังอยู่: `<img>` ใน Banner/Visual Hook และ Supabase dynamic-dependency warning จากเส้นทางเดิม ไม่มีการขยายขอบเขตไปแก้ฟีเจอร์เหล่านั้น
- Supabase จริง: ตรวจแบบ `limit=0` ยืนยันตารางและคอลัมน์ products, offers, knowledge_items, profiles, settings ที่โมดูลต้องใช้มีอยู่จริง ไม่ดึงข้อมูลลูกค้า; customers/conversations/messages/chat_customers ยังไม่พบ
- **OpenAI จริง: ไม่ผ่าน — `OPENAI_HTTP_401`** เมื่อใช้ `OPENAI_API_KEY` จาก `.env.local` กับคำว่า Hello เท่านั้น จึงยังยืนยันรุ่นที่ตั้งไว้/คำตอบ AI จริงไม่ได้ ต้องตรวจ credential ในสภาพแวดล้อมที่จะเปิดใช้งาน ค่าใน Production อาจต่างจากเครื่องนี้
- **Meta จริง: ยังไม่ได้ทดสอบ** เพราะยังไม่มี Page ID / Page access token / App secret / Verify token ของ Messenger ในเครื่อง ไม่ได้ส่งข้อความหาลูกค้าจริง

การทดสอบ SQL ใช้ Postgres ผ่าน PGlite ชั่วคราว ไม่ใช่ฐานข้อมูล Production และไม่ใช่หลักฐานการทำงาน concurrent บน Supabase จริง ส่วน UI fixtures ไม่ใช่หลักฐานว่าเชื่อมบัญชีจริงแล้ว

## Database / Migration

ไฟล์ `supabase/migrations/0029_ai_sales_chat.sql` เพิ่ม 7 ตาราง:

1. `chat_customers`
2. `chat_conversations`
3. `chat_messages`
4. `chat_customer_memory`
5. `chat_product_knowledge`
6. `chat_jobs`
7. `chat_rate_limits`

เพิ่ม FK/index/RLS และ RPC สำหรับ ingestion, คิว, score/memory, mode controls, rate limit และ analytics ทุก RPC ที่แก้ข้อมูลเรียกได้เฉพาะ service role

ข้อมูลลูกค้าใหม่อ่านได้เฉพาะ Owner/Admin/Content Lead ที่สถานะ approved เขียนผ่าน API ที่ตรวจสิทธิ์เท่านั้น เพิ่ม restrictive policy บน `settings` **เฉพาะ key `ai_chat`** เพื่อไม่ให้ pending user ใช้ policy เดิมข้าม approval ได้ ไม่มีการลบตาราง/คอลัมน์/ข้อมูล หรือเปลี่ยนกฎของ key เก่า

`supabase/ai_chat_schedule.sql` เป็นขั้นตอนติดตั้งแยก ใช้ pg_cron/pg_net/Vault ที่ระบบ Ads ใช้อยู่แล้ว ไม่เริ่มงานอัตโนมัติจนกว่าจะตั้ง secret และรันไฟล์นี้

## API / Environment

| API | หน้าที่ |
|---|---|
| `GET /api/integrations/meta/webhook` | Meta verification |
| `POST /api/integrations/meta/webhook` | รับ event ที่ลายเซ็นถูกต้องและบันทึกทั้ง batch ก่อนตอบสำเร็จ |
| `POST /api/ai-chat/worker` | ประมวลผลคิว ใช้ `AI_CHAT_WORKER_SECRET` |
| `GET /api/ai-chat` | Inbox, history, customer, setup, knowledge, analytics |
| `POST /api/ai-chat` | คำสั่งแอดมิน/การตั้งค่า ตรวจ session, approval, role, origin และ rate limit |

ตัวแปรใหม่ใน `.env.example`:

- `META_PAGE_ID`
- `META_PAGE_ACCESS_TOKEN` — ใช้ของ Messenger Page ไม่ใช้ Ads system-user token แทนโดยเดา
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `META_MESSENGER_API_VERSION` — กำหนดเวอร์ชันที่แอป Meta ใช้งานได้
- `AI_CHAT_WORKER_SECRET` — ค่าสุ่มยาว ตั้งตรงกันที่ host และ Supabase Vault
- `CHAT_FAST_MODEL`, `CHAT_SALES_MODEL`, `CHAT_ADVANCED_MODEL` — optional; ค่าใน AI Rules มีลำดับก่อน

ใช้ Supabase environment เดิม และ `OPENAI_API_KEY` เดิมฝั่ง server; ไม่แก้ `.env.local` ไม่ใส่ token ลงฐานข้อมูลหรือ frontend

## ขั้นตอนเปิดใช้งาน

1. ตรวจ/สำรองฐานข้อมูลและ apply `0029_ai_sales_chat.sql` บน staging ก่อน จากนั้นทดสอบด้วย approved operator และ pending/viewer accounts
2. แก้ credential OpenAI ที่ตอบ 401 โดยตั้งผ่านช่องทางเก็บ secret ของเครื่อง/hosting ไม่ส่ง key ในแชท แล้วทดสอบ Structured Outputs จริง
3. ตั้ง Messenger secrets ใน hosting ของโปรเจกต์เดิมและทดสอบ Page ที่ควบคุมได้ ตรวจสิทธิ์ Messenger, app mode/review, Page subscription และเวอร์ชัน API กับ Meta Developer console
4. Deploy โปรเจกต์เดิมไปโดเมนที่ต้องการจริง ตรวจ `/ai-chat` และตั้ง callback เป็น `https://mktos.zanadynasty.com/api/integrations/meta/webhook` **เมื่อยืนยันว่ารุ่นนี้ deploy ไปโดเมนนั้นแล้ว**
5. ตั้ง Vault secrets `ai_chat_worker_url` และ `ai_chat_worker_secret` แล้วรัน `supabase/ai_chat_schedule.sql` งานจะเรียกทุกนาที แต่ละ invocation ทำได้สูงสุด 3 jobs ภายในเวลาที่จำกัด ไม่มี fire-and-forget หลังตอบ webhook
6. ตรวจข้อมูลสินค้า ข้อห้าม อายุ FAQ และช่วงโปรโมชั่น อนุมัติสินค้าที่จะใช้ ตั้ง AI Rules ทั้ง 3 รุ่นตามที่บัญชีเข้าถึงได้ ค่า default คือปิดตอบอัตโนมัติ
7. ทดสอบกับเพจจริงครบ 15 สถานการณ์ตาม brief โดยเฉพาะ webhook ซ้ำ/คนรับช่วง/หมดหน้าต่างตอบ/timeout แล้วจึงเปิด AI

หากต้องหยุด: ปิด AI Rules, หยุด cron ชื่อ `ai-chat-worker-every-minute` และเก็บข้อมูลสนทนาไว้ การ Take Over หยุดข้อความที่ยังไม่ dispatch; คำขอที่ส่งออกไป Meta แล้วเรียกคืนไม่ได้

## ข้อจำกัด MVP ที่ระบุไว้ชัดเจน

- รองรับ Facebook Page เดียวต่อ deployment; แยก channel/page/PSID แล้วเพื่อเพิ่ม adapter ภายหลัง
- ยังไม่ต่อ Instagram/LINE/TikTok, Order, Transaction, ERP หรือ verified purchase attribution
- Analytics เป็นยอดสะสม หนึ่ง conversation ต่อลูกค้า/เพจ; การ reopen ใช้เธรดเดิม ไม่ใช่ session ใหม่
- Handoff notification อยู่ใน Inbox ที่ polling อัตโนมัติ ยังไม่มี push/email/LINE notification
- Worker ทุกนาทีทำให้มีเวลารอคิว ต้องวัดปริมาณจริงก่อนเพิ่ม scheduling/throughput
- คำตอบเป็นการเลือกข้อความความรู้ที่ตรวจอนุมัติ + คำถามต่อยอดได้สูงสุดหนึ่งข้อ ไม่ให้โมเดลสร้างข้อเท็จจริงหรือราคาอย่างอิสระ ข้อมูลที่ยาวเกินขนาด snippet ต้องย่อโดยแอดมินก่อน
- Memory เก็บ structured evidence quotes; ยังไม่ parse อายุ/ประวัติซื้อเป็นค่าที่ถือว่ายืนยันจาก CRM
- ถ้า Meta timeout หลังส่ง จะขึ้น uncertain และให้ทีมตรวจใน Messenger ก่อนส่งใหม่ ไม่ retry อัตโนมัติ
- คืนให้ AI มีผลกับข้อความลูกค้าถัดไป ไม่เล่นซ้ำข้อความเก่าที่ถูกยกเลิก
- อัตราค่าใช้จ่ายไม่ hardcode; ต้องใส่ USD ต่อหนึ่งล้าน input/output tokens ที่ถูกต้อง จึงคำนวณประมาณการได้ ไม่ใช่ใบแจ้งหนี้ OpenAI

## Files

เพิ่ม:

- `docs/AI_CHAT_ARCHITECTURE.md`
- `docs/AI_CHAT_DELIVERY.md`
- `app/(dashboard)/ai-chat/page.tsx`
- `app/api/ai-chat/route.ts`
- `app/api/ai-chat/worker/route.ts`
- `app/api/integrations/meta/webhook/route.ts`
- `components/ai-chat-client.tsx`
- `lib/ai-chat/core.ts`
- `lib/ai-chat/meta.ts`
- `lib/ai-chat/ai.ts`
- `lib/ai-chat/server.ts`
- `lib/ai-chat/worker.ts`
- `supabase/migrations/0029_ai_sales_chat.sql`
- `supabase/ai_chat_schedule.sql`
- `tests/ai-chat.test.cjs`

แก้เฉพาะจุด:

- `components/nav-items.ts` — เพิ่ม AI Chat ในเมนูเดิมด้วย group key ที่ไม่ซ้ำ
- `app/globals.css` — ให้กลุ่ม AI Sales ใช้สี Distribution เดิม
- `app/(dashboard)/settings/page.tsx` — ลิงก์ตั้งค่า AI Chat
- `middleware.ts` — ยกเว้นเฉพาะ webhook/worker ที่ตรวจ credentials ของตัวเอง; operator API ยังอยู่หลัง login
- `.env.example` — ชื่อตัวแปรใหม่ ไม่มีค่าความลับ

ไม่ได้แก้ไฟล์ Flow Prompt, TODO, PROJECT_HANDOFF หรือ migration 0028 ที่มีการแก้ไขค้างอยู่ก่อนเริ่มงาน และไม่ได้เปลี่ยน package.json/package-lock.json หรือเพิ่ม production dependency

## ทดสอบซ้ำ

```powershell
cd E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork
node --test tests/ai-chat.test.cjs
npm run typecheck -- --incremental false
npm run lint
npm run build
```

ชุด SQL จะ skip หากไม่ตั้ง `PGLITE_MODULE` ให้ชี้ไปที่แพ็กเกจ `@electric-sql/pglite` ในพื้นที่ QA แยกต่างหาก รอบนี้ใช้ temporary QA installation ภายนอกโปรเจกต์ ไม่เพิ่ม dependency ให้เว็บจริง

อ้างอิง API: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) ส่วนข้อกำหนด Meta ต้องยืนยันจาก Developer console ก่อน go-live เนื่องจากหน้า official docs เรียกไม่ได้ระหว่าง audit

## Follow-up: ตรวจการเชื่อมต่อและหน้าจอก่อนติดตั้ง (7 ตุลาคม 2026)

- ยืนยันสาเหตุด้วย GET /v1/models: OpenAI ส่ง HTTP 401 / invalid_api_key กลับมา รูปแบบ Key ที่โหลดไม่มีช่องว่าง ไม่มี quote เกิน มีหนึ่ง declaration และไม่ถูก environment ค่าอื่นทับ ยังไม่ได้เปลี่ยน Key หรือไฟล์ .env.local
- เพิ่มปุ่ม “ตรวจการเชื่อมต่อ” ใน AI Rules สำหรับ Owner/Admin ตรวจสิทธิ์อ่านรายการรุ่นโดยไม่ generate และไม่ส่งข้อมูลลูกค้า จำกัด 3 ครั้ง/นาที สำเร็จตรงนี้ยังไม่ยืนยันสิทธิ์ Responses หรือความเข้ากันได้ของรุ่น
- แยก invalid key, IP allowlist, quota, rate limit, model not found และ timeout เป็นข้อความไทย โดยไม่แสดง raw provider message ที่อาจมีข้อมูลลับ
- หน้า setup อ่านได้สำหรับ approved operator แม้ยังไม่มี RPC ของ Migration 0029; ยกเว้นเฉพาะ GET setup ไม่มีการข้าม Auth/Role, ไม่มีการเปิด mutations ก่อน Migration และปุ่มตรวจ OpenAI/บันทึกถูกปิดไว้จนกว่าฐานข้อมูลพร้อม
- ลดข้อความผิดพลาดซ้ำ และไม่แสดงสถานะ AI เปิดใช้งานเมื่อฐานข้อมูลยังไม่พร้อม
- ทดสอบล่าสุด: 36 automated tests ผ่าน, Build ผ่านพร้อม warnings เดิม ตรวจ Desktop/Tablet/Mobile ทั้ง auth success, invalid key และ missing migration ด้วย API fixtures ผ่าน ไม่มี JavaScript exception
- ตรวจ JavaScript ฝั่ง browser 58 ไฟล์ ไม่พบค่า OPENAI_API_KEY
- Database: ไม่มี Migration ใหม่หรือการแก้ข้อมูลจริงในรอบนี้; 0029 ยังรอติดตั้งตามขั้นตอนเดิม
- ไฟล์รอบนี้: เพิ่ม lib/ai-chat/issues.ts; แก้ lib/ai-chat/ai.ts, lib/ai-chat/server.ts, app/api/ai-chat/route.ts, components/ai-chat-client.tsx, tests/ai-chat.test.cjs และรายงานนี้
- งานที่ต้องใช้ข้อมูลจากเจ้าของ: ใส่ OpenAI Key ที่ใช้งานได้ในช่องทางจัดเก็บ secret และตั้ง Messenger credentials ที่ยังขาด จากนั้นจึงตรวจ live end-to-end ต่อ
- อ้างอิงสาเหตุ 401: https://developers.openai.com/api/docs/guides/error-codes
