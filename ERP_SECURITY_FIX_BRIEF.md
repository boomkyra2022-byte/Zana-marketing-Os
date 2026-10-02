# บรีฟแก้ช่องโหว่ความปลอดภัย — ระบบ ERP (erpos.zanadynasty.com)

**สำหรับ:** วางในแชต Cowork อีกแชทที่สร้าง/ดูแลโค้ด ERP (project Supabase: `gxycxjksrzjzxzgbblup`)
**จัดทำโดย:** ตรวจสอบจริงผ่าน Supabase MCP จากแชต ZANA Marketing OS V2 — วันที่ 2026-10-02
**ระดับความรุนแรง:** วิกฤต (Critical) — ข้อมูลลูกค้า พนักงาน เงินเดือน เปิดให้บุคคลภายนอกดึง/แก้ไขได้โดยไม่ต้องล็อกอิน

---

## 1. สรุปปัญหา (ยืนยันด้วยข้อมูลจริง)

ตรวจ 35 ตารางใน public schema พบว่า **ทุกตารางเข้าถึงได้โดย anon key (กุญแจสาธารณะที่ฝังอยู่ในหน้าเว็บ) แบบไม่มีการตรวจสอบสิทธิ์เลย** แบ่งเป็น 2 กลุ่ม:

**กลุ่ม A — ปิด RLS สนิท (22 ตาราง)** เปิดโล่งให้ anon อ่าน/เขียน/ลบได้ทุกแถว รวมถึง:
- `customers` (ลูกค้า 4,154 รายชื่อ+เบอร์โทร)
- `orders` (ออเดอร์ 8,417 รายการ) + `order_items`
- `crm_followups` (10,105 รายการ), `call_logs` (2,664 รายการ)
- `attendance`, `employee_leaves`, `employee_ot`, `employee_advances` (ข้อมูลลา/โอที/เงินยืมพนักงาน)
- `products`, `product_skus`, `stock_movements`, `ads_performance`, `expenses`, `settings`, `roles`, `hr_requests`, `weekly_reports`, `task_messages`, `content_daily_reports`, `shipping_daily_reports`, `attendance_pending_photo`

**กลุ่ม B — "เปิด RLS" แล้วแต่ policy อนุญาต anon เข้าถึงทุกอย่างอยู่ดี (13 ตาราง)** — การเปิด RLS เฉยๆ ไม่มีผลอะไร เพราะมี policy `qual: true` ที่เท่ากับเปิดหมด:
`users` (รวม PIN login!), `channels`, `cost_settings`, `daily_evaluations`, `import_batches`, `import_batch_rows`, `telesales_daily`, `telesales_daily_reports`, `platform_daily_summary`, `security_alerts`, `monthly_targets`, `content_clips`, `company_expenses`, `audit_logs`, `weekly_reports`

**สรุป: ทั้ง 35/35 ตารางเปิดให้บุคคลภายนอกเข้าถึงได้จริง** ไม่ใช่แค่ 22 ตารางที่ advisor แจ้งเตือน

**หลักฐานเสริม** (จาก log การเชื่อมต่อจริง): หน้าเว็บ ERP **ไม่เคยมีการล็อกอินผ่าน Supabase Auth เลยสักครั้ง** — ทั้ง header `apikey` และ `Authorization` เป็น `anon` role ตลอด แปลว่า browser คุยกับฐานข้อมูลตรงๆ ด้วยกุญแจสาธารณะเพียงอย่างเดียว

**จุดสำคัญที่ต้องรู้ก่อนแก้:** ตาราง `users` ใช้ล็อกอินแบบ **PIN** (คอลัมน์ `pin`) ไม่ใช่ Supabase Auth (email/password) — ระบบสิทธิ์ปัจจุบันเป็นระบบ custom ของตัวเอง ไม่ผูกกับ `auth.uid()` ของ Supabase เลย ตรงนี้คือสาเหตุที่ "เปิด RLS เฉยๆ" จะทำให้แอปพังทันที เพราะไม่มี session ของ Supabase ให้ policy อ้างอิง

---

## 2. ทำไมรัน "ENABLE RLS" เฉยๆ ไม่ได้ทันที

ถ้าเปิด RLS โดยไม่มี policy ที่ถูกต้อง → ทุก request จาก anon key จะถูกบล็อกทันที → **แอป ERP ทั้งระบบใช้งานไม่ได้** (ล็อกอินไม่ได้, โหลดลูกค้า/ออเดอร์ไม่ได้) เพราะตอนนี้แอปพึ่ง anon key 100% ไม่มีชั้น authentication คั่นกลางเลย

ดังนั้น**ห้ามรัน SQL ด้านล่างจนกว่าจะแก้โค้ดฝั่งแอปตามข้อ 3 ก่อน**

---

## 3. แผนแก้ไข — แนะนำ: ย้าย query ไปอยู่หลัง Server API (เร็วและตรงกับสถาปัตยกรรมเดิมที่สุด)

เหตุผลที่แนะนำทางนี้แทนการเปลี่ยนไปใช้ Supabase Auth เต็มรูปแบบ: ระบบ login ด้วย PIN ของคุณใช้งานได้ดีอยู่แล้วกับพนักงาน 7 คน ไม่จำเป็นต้องรื้อ UX ล็อกอินใหม่ — แค่ย้าย "จุดคุยกับฐานข้อมูล" จาก browser ไปเป็น server แทน

**ขั้นตอน (ทำในโค้ด ERP):**

1. ทุกจุดที่โค้ด frontend เรียก `supabase.from('customers')...`, `supabase.from('orders')...` ฯลฯ ตรงๆ จาก browser → เปลี่ยนเป็นเรียก API route ของตัวเอง (เช่น `/api/customers`, `/api/orders`) แทน
2. API routes เหล่านี้รันบน server (Next.js API route / Node backend) ใช้ **service_role key** (เก็บใน env variable server-side เท่านั้น ห้ามส่งไป browser) ซึ่ง bypass RLS ได้โดยตรง
3. ที่ API route ต้องเช็ค **session ของ PIN login** ก่อนทุกครั้ง (เช่น httpOnly cookie ที่ตั้งตอน login สำเร็จ, เก็บ `user_id` + `role_id` ไว้ตรวจสอบสิทธิ์ต่อ endpoint) — ถ้าไม่มี session ที่ถูกต้อง → ตอบ 401 ปฏิเสธ ไม่คุยกับฐานข้อมูลเลย
4. หน้าเพจไหนที่ยังไม่มี login guard (เช็คว่ามี session ก่อนแสดงข้อมูล) ให้เพิ่มด้วย

**เมื่อโค้ดข้อ 1-4 เสร็จและ deploy แล้ว** — ฐานข้อมูลจะไม่ถูกเรียกจาก browser อีกต่อไป จะเหลือแค่ server เรียกด้วย service_role key เท่านั้น ถึงตอนนั้นค่อยรัน SQL ด้านล่างได้อย่างปลอดภัย (เปิด RLS + ไม่มี policy ให้ anon/authenticated = ปิดสนิทสำหรับการเรียกตรงจาก browser แต่ server ยังทำงานได้ปกติเพราะ service_role bypass RLS)

---

## 4. SQL พร้อมรัน (รันหลังข้อ 3 เสร็จเท่านั้น!) — วางใน Supabase SQL Editor ของ project `gxycxjksrzjzxzgbblup`

```sql
-- ========================================
-- STEP 1: ถอด policy เดิมที่เปิดให้ anon เข้าถึงทุกอย่าง (qual: true)
-- ========================================
drop policy if exists "anon_all" on public.audit_logs;
drop policy if exists "allow_all_channels" on public.channels;
drop policy if exists "anon_select_expenses" on public.company_expenses;
drop policy if exists "anon_update_expenses" on public.company_expenses;
drop policy if exists "anon_insert_expenses" on public.company_expenses;
drop policy if exists "anon_update_clips" on public.content_clips;
drop policy if exists "anon_select_clips" on public.content_clips;
drop policy if exists "anon_insert_clips" on public.content_clips;
drop policy if exists "anon_all" on public.cost_settings;
drop policy if exists "anon_all" on public.daily_evaluations;
drop policy if exists "anon_all" on public.import_batch_rows;
drop policy if exists "anon_all" on public.import_batches;
drop policy if exists "anon_insert_targets" on public.monthly_targets;
drop policy if exists "anon_update_targets" on public.monthly_targets;
drop policy if exists "anon_select_targets" on public.monthly_targets;
drop policy if exists "anon_all_platform_daily" on public.platform_daily_summary;
drop policy if exists "anon_select_alerts" on public.security_alerts;
drop policy if exists "anon_update_alerts" on public.security_alerts;
drop policy if exists "anon_insert_alerts" on public.security_alerts;
drop policy if exists "anon_select_tsd" on public.telesales_daily;
drop policy if exists "anon_insert_tsd" on public.telesales_daily;
drop policy if exists "anon_update_tsd" on public.telesales_daily;
drop policy if exists "anon_insert_tsdr" on public.telesales_daily_reports;
drop policy if exists "anon_select_tsdr" on public.telesales_daily_reports;
drop policy if exists "anon_update_tsdr" on public.telesales_daily_reports;
drop policy if exists "anon_update_users" on public.users;
drop policy if exists "anon_select_users" on public.users;
drop policy if exists "allow_anon_insert" on public.weekly_reports;

-- ========================================
-- STEP 2: เปิด RLS ทุกตารางที่ยังปิดอยู่ (22 ตาราง)
-- ========================================
alter table public.roles enable row level security;
alter table public.products enable row level security;
alter table public.product_skus enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.crm_followups enable row level security;
alter table public.call_logs enable row level security;
alter table public.stock_movements enable row level security;
alter table public.ads_performance enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_pending_photo enable row level security;
alter table public.employee_leaves enable row level security;
alter table public.employee_ot enable row level security;
alter table public.employee_advances enable row level security;
alter table public.hr_requests enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.task_messages enable row level security;
alter table public.content_daily_reports enable row level security;
alter table public.shipping_daily_reports enable row level security;

-- ไม่ต้องสร้าง policy ใหม่ให้ anon/authenticated เลย — เจตนาให้ "ปิดสนิท"
-- สำหรับการเรียกตรงจาก browser ทุกตาราง เพราะหลังจากนี้มีแค่ server
-- (ที่ใช้ service_role key) เท่านั้นที่ควรคุยกับฐานข้อมูล และ service_role
-- bypass RLS โดยอัตโนมัติอยู่แล้ว ไม่ต้องมี policy ก็ทำงานได้ปกติ
```

**หลังรันเสร็จ:** กดปุ่ม "Run Advisors" (หรือรัน `get_advisors` ผ่าน Supabase MCP) อีกรอบเพื่อยืนยันว่า `rls_disabled_in_public` หายไปหมด

---

## 5. Checklist ก่อนรัน SQL ข้อ 4

- [ ] ทุก fetch ข้อมูลจาก Supabase ใน frontend ถูกย้ายไปเป็น API route ของ server แล้ว (ไม่มี `createClient()` ฝั่ง browser ที่ query ตารางอ่อนไหวตรงๆ อีกต่อไป)
- [ ] API routes ใช้ service_role key จาก env variable (ตรวจว่าไม่ได้ขึ้นต้นด้วย `NEXT_PUBLIC_` เด็ดขาด — ถ้าขึ้นต้นแบบนั้นจะหลุดไป browser bundle ทันที)
- [ ] มีการเช็ค session/PIN login ก่อนทุก API route ที่คืนข้อมูลลูกค้า/ออเดอร์/พนักงาน
- [ ] ทดสอบ deploy เวอร์ชันใหม่แล้วว่าแอปยังใช้งานได้ปกติทุกหน้า **ก่อน** รัน SQL
- [ ] รัน SQL ข้อ 4 ใน Supabase SQL Editor
- [ ] ทดสอบแอปอีกรอบหลังรัน SQL — ล็อกอิน, ดูลูกค้า, ดูออเดอร์, บันทึกเวลาเข้างาน ต้องทำงานได้ปกติหมด (เพราะผ่าน server แล้ว)
- [ ] เปิด incognito/private window แล้วลองเรียก Supabase REST API ตรงๆ ด้วย anon key (เช่นผ่าน browser console หรือ Postman) — ต้องได้ error ปฏิเสธสิทธิ์ ไม่ใช่ข้อมูลจริง

---

## 6. หมายเหตุ

- รหัสโปรเจกต์ Supabase ของ ERP: `gxycxjksrzjzxzgbblup` (ชื่อ "ZANA DYNASTY COS")
- นี่คนละฐานข้อมูลกับ ZANA Marketing OS V2 (`czpjkszttfibbwcmxwpb`) — ไม่เกี่ยวข้องกัน ไม่กระทบกัน
- ถ้าต้องการ แก้ง่ายกว่านี้ชั่วคราวระหว่างรอ refactor เต็มรูปแบบ (ลดความเสี่ยงไว้ก่อน ไม่ใช่แก้ถาวร): หมุน anon key ใหม่ใน Supabase Dashboard แล้วจำกัด CORS/allowed origins เฉพาะโดเมน erpos.zanadynasty.com เพื่อลดโอกาสคนนอกยิง request ตรงๆ — แต่ไม่ได้ปิดช่องโหว่จริง เพราะ anon key ยังฝังอยู่ใน JS bundle ที่ใครก็เปิดดูได้
