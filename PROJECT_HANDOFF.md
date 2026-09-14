# ZANA Marketing OS V2 — Handoff / Backup Summary

**Backup วันที่:** 2026-09-14 — สร้างขึ้นเพื่อให้สั่งงานต่อในแชทใหม่ได้ทันที ถ้าแชทนี้หายหรือโดนลบ

**สำคัญ:** งานจริงทั้งหมด (โค้ด, migration, เอกสาร) ถูกบันทึกลงไฟล์ในโฟลเดอร์
`E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork` อยู่แล้ว — **ไม่ได้อยู่แค่ในแชท** ต่อให้แชทนี้
หายไป งานไม่หายไปด้วย ไฟล์นี้มีไว้แค่ช่วยให้ Claude แชทใหม่ "อ่านสถานะโปรเจกต์ได้เร็วขึ้น"
โดยไม่ต้องไล่โค้ดทั้งหมดใหม่ตั้งแต่ต้น

## วิธีใช้ไฟล์นี้ในแชทใหม่

เปิดแชทใหม่แล้วพิมพ์ทำนองนี้:

> อ่านไฟล์ `E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork\PROJECT_HANDOFF.md` และ
> `TODO.md` ในโฟลเดอร์เดียวกัน เพื่อดูสถานะโปรเจกต์ ZANA Marketing OS V2 ก่อน
> แล้วช่วย [งานที่ต้องการ]

---

## 1. ข้อมูลโปรเจกต์

- **ชื่อ:** ZANA Marketing OS V2 — เว็บแอป Marketing/Creative สำหรับแบรนด์ ZANA / ZANA Kid / Kyra / JANGZANA (DTC/social-commerce, ไทย)
- **Stack:** Next.js 14.2.15 (App Router) + TypeScript strict + Supabase (Postgres + Auth + Storage) + Tailwind
- **Repo:** `boomkyra2022-byte/Zana-marketing-Os` บน GitHub
- **Deploy:** Vercel (แผน Hobby — จำกัด 12 Serverless Functions), โดเมนจริง `mktos.zanadynasty.com`
- **โฟลเดอร์โปรเจกต์ในเครื่อง:** `E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork`
- **บันทึกงานทั้งหมดแบบละเอียด:** `TODO.md` ในโฟลเดอร์เดียวกัน (ไฟล์ยาวมาก ~485 บรรทัด
  ไล่ตั้งแต่ Phase 1 จนถึงงานล่าสุด — เป็น source of truth ที่แท้จริงของทุกฟีเจอร์/บั๊กที่แก้ไปแล้ว)

## 2. กติกาตายตัวของโปรเจกต์ (ต้องยึดตลอด)

- **Migration เป็นแบบ additive เท่านั้น** — ห้ามลบ/แก้ของเดิมที่มีอยู่ ห้าม overwrite ระบบเดิม
- **ทุก phase ต้องทดสอบจริง** ไม่ใช่แค่เขียนโค้ดแล้วจบ
- **ใช้ design system เดิม** ไม่สร้างสไตล์ใหม่แยกออกไป (สี/ฟอนต์อยู่ใน `app/globals.css`)
- **ห้ามมีปุ่ม/ฟีเจอร์ปลอม (dead/fake)** — ถ้าทำจริงไม่ได้หรือยังไม่ได้ทำ ต้องบอกตรงๆ ในแชทและใน TODO.md ไม่ใช่แกล้งทำเป็นเสร็จ
- **Claude (ในเซสชันนี้) ไม่มี bash/shell access โดยตรงกับเครื่องผู้ใช้** — ผู้ใช้เป็นคนรัน
  `npm install` / `npm run build` / `git add,commit,push` เองผ่าน PowerShell 5.1
  (คำสั่งต้องคั่นด้วย `;` ไม่ใช่ `&&`) และรัน SQL ผ่าน Supabase SQL Editor/Table Editor เอง
- **ทุกครั้งที่ให้คำสั่ง deploy ต้องใส่ `cd E:\WEB\ZANA_Marketing_OS_V2_Claude_Cowork` นำหน้าเสมอ** (ผู้ใช้ขอไว้)
- **Claude ไม่สามารถ login เข้าเว็บแทนผู้ใช้ได้** (นโยบายห้ามกรอกรหัสผ่าน แม้ได้รับอนุญาต) — การตรวจสอบหน้าที่ต้อง login
  ต้องให้ผู้ใช้เช็คเองหรือ Claude ตรวจผ่านการอ่านโค้ดแทน

## 3. สถานะล่าสุด ณ วันที่ backup นี้

**Deploy ล่าสุดที่ผู้ใช้ยืนยันว่าสำเร็จ:** batch ที่รวม —
signup approval gate, RLS viewer-role fix บน Model Library, Visual Hook Banner
`modelIdentity` cap fix (500→1500 ตัวอักษร), ระบบซ้อนข้อความไทยจริงบนภาพ (text-overlay
compositing), ZANA house graphic-layout pattern, MASTER_VISUAL_QUALITY_BLOCK
→ ผู้ใช้ตอบ **"ไม่ติดอะไรเลย Deploy สำเร็จ"**

**งานล่าสุดที่ทำแล้ว:** Mobile-responsive pass ทั้งแอป (แก้ grid 3 คอลัมน์ที่ล็อกตายและ
ตารางที่ไม่มี scroll แนวนอนใน 10 ไฟล์) — deploy ไปแล้ว แต่ผู้ใช้ส่ง screenshot จริงจากมือถือ
กลับมาว่า **"ยังไม่ได้"** — หน้า Dashboard ยังเพี้ยน (เนื้อหาเลื่อนขวา/ล้นจอ/ซ้อนทับ)

**เจอ root cause จริงแล้ว (ยังไม่ได้ deploy):** ปัญหาไม่ได้อยู่ที่ grid/table ที่แก้ไปก่อนหน้า
เลย แต่อยู่ที่ `app/globals.css` — `.app-shell { display: flex; }` ไม่มี `flex-direction`
(เป็น row) พอถึงจอมือถือ `SideNav` เรนเดอร์แถบบนสุด (แบรนด์ + ปุ่มเมนู) เป็น element ที่ยังอยู่ใน
flow ปกติ วางเรียงข้าง `<main>` แบบแถวเดียวกันแทนที่จะซ้อนกันแนวตั้ง — เนื้อหาเพจทั้งหมดเลย
ถูกบีบเข้าไปในคอลัมน์แคบๆ ด้านขวาแล้วล้นจอ ตรงกับ screenshot เป๊ะ **แก้แล้วด้วย
`flex-direction: column` ภายใต้ breakpoint 767px เดียวกับ `.sidebar` บวก `overflow-x: hidden`
บน body กันเผื่อ** — อยู่ใน `app/globals.css` ในเครื่องแล้ว **แต่ยังไม่ได้ push/deploy**
นี่คือสิ่งแรกที่ต้องทำต่อในแชทใหม่: `git push` แล้วให้ผู้ใช้เช็คหน้า Dashboard บนมือถือจริงอีกครั้ง

## 4. รายการที่ต้องเช็ค/ทำต่อ (pending)

1. **ยืนยัน mobile-responsive fixes** ว่า push/deploy สำเร็จ และเช็คบนมือถือจริงแล้ว
   โดยเฉพาะหน้า Team Management, Products, Dashboard (Recent Creative panel)
2. **ยืนยัน checklist ที่เคยให้ไว้** (อาจยังไม่ได้เช็คทุกข้อแม้ deploy จะสำเร็จ):
   - Visual Hook Banner สร้างไอเดียได้ไม่ขึ้น "Invalid request" อีก
   - Banner Generator ติ๊ก "ซ้อนข้อความจริง" แล้วภาพออกมาตัวหนังสือคมชัด
   - สมัครสมาชิกใหม่ไม่ใส่รหัสเจ้าของต้อง fail, ใส่ถูกต้องรออนุมัติก่อนเข้าระบบได้
   - Model Library แก้ preset "คุณชิดชนก" บันทึกได้ปกติ (ด้วยบัญชี owner)
3. **รูปอ้างอิงของคุณชิดชนก (ZANA Founder)** ยังไม่เคยอัปโหลดเข้า Model Library จริง —
   ตอนนี้ identity lock ยังพึ่งคำบรรยายข้อความอย่างเดียว ยังไม่มีรูปจริงอ้างอิง
4. **ช่องโหว่ที่ทราบแล้วแต่ยังไม่ปิด (ตั้งใจเลื่อนไว้ก่อน):** user ที่สมัครแล้วสถานะยัง
   `pending` มี valid Supabase Auth session และในทางทฤษฎีเรียก Supabase REST API ตรงได้
   ถ้าตารางไหน SELECT policy เช็คแค่ `auth.role() = 'authenticated'` ไม่ได้เช็ค
   `profiles.status` — ต้อง audit ~20 migration files ถ้าจะปิดจริง (ยังไม่ได้ทำ)
5. **ระบบซ้อนข้อความ v1 ยังไม่ครอบคลุม** ไอคอน badge / price pill / brand tag ใน
   GRAPHIC LAYOUT PATTERN — ยังเป็น AI วาดเองอยู่ (ยังไม่ composite จริง)
6. **SILENCE_CUT engine ใหม่** (เขียนเองแทน Tamsub) ยังไม่เคยทดสอบกับวิดีโอจริง
7. **Direct-from-device upload** (migration 0008) ยังไม่เคย run/ทดสอบยืนยัน
8. **Thai word-segmentation fix ล่าสุด** ยังไม่เคยทดสอบกับวิดีโอจริงหลัง deploy
9. Phase 2-4 เดิมบางรายการยังมีสถานะ `[~]` (เขียนโค้ดแล้วแต่ยังไม่ verify) หรือ `[ ]`
   (ยังไม่เริ่ม) ใน TODO.md — ส่วนใหญ่เป็นของเก่าที่เว็บใช้งานจริงอยู่แล้วเฉยๆ ยังไม่ได้ติ๊ก
   ให้ครบ ไม่ใช่ตัวบ่งชี้ว่าเว็บพัง — ดูรายละเอียดที่ TODO.md ถ้าต้องสงสัยจุดไหนเฉพาะเจาะจง

## 5. Housekeeping เล็กน้อยที่สังเกตเห็น (ไม่กระทบการทำงาน)

มีไฟล์ migration เลขซ้ำกัน 2 คู่: `0014_voiceover_multi_provider.sql` กับ
`0014_ads_automation_phase1.sql`, และ `0015_ads_cron_schedule.sql` กับ
`0015_banner_generator_jobs.sql` — ไม่กระทบการทำงาน (รันเองทีละไฟล์ผ่าน SQL Editor
ไม่ได้อิงเลขลำดับอัตโนมัติ) แต่ถ้าจะจัดระเบียบสักวันก็ทำได้ ไม่เร่งด่วน

## 6. Migration ล่าสุดที่มีอยู่

`0001` ถึง `0022` (`0022_signup_approval_gate.sql` เป็นล่าสุด) — ทุกไฟล์อยู่ใน
`supabase/migrations/` รันผ่าน Supabase SQL Editor ด้วยตัวเองทั้งหมดตามลำดับเลข
