
# Claude Cowork — Command Sequence

## Command 1 — Boot
อ่าน `MASTER_PROMPT.md` ทั้งหมด
ตรวจ directory ปัจจุบัน
ถ้ามี project อยู่แล้วให้ audit ก่อน
ถ้ายังไม่มีให้ scaffold ระบบใหม่
สร้าง PLAN.md + TODO.md
จากนั้น Implement Phase 1 จริง
อย่าหยุดที่การอธิบาย

## Command 2 — Foundation QA
รัน app, lint, typecheck และ tests
แก้ error ทั้งหมด
ตรวจ Supabase migrations + RLS
เมื่อผ่านแล้วจึงเริ่ม Phase 2

## Command 3 — Creative Factory
Implement Creative Factory:
100 Ideas → 40 Scripts → Production workflow
ต้องใช้ DB จริง
ทดสอบ generate + approve + lineage

## Command 4 — Video Analyzer
Implement Video Upload + Google Drive public link import
ใช้ ffmpeg extract audio/frames
ทำ transcription
เรียก AI structured scoring
ทดสอบกับ video จริงอย่างน้อย 1 ไฟล์
แสดง progress state + readable errors

## Command 5 — Performance
Implement TikTok CSV import
mapping + preview + validation
คำนวณ CTR/CVR/CPO/ROAS/Net ROI
สร้าง Winner Engine

## Command 6 — Closed Loop
Implement Winner DNA
Generate Variations
False Positive / False Negative learning
บันทึก Learning กลับ Knowledge Base
ห้าม auto-change scoring weights โดยไม่มี approval

## Command 7 — Production Audit
ตรวจ:
security
RLS
API keys
rate limit
file validation
AI cost controls
audit logs
mobile
error states
loading states
deployment
README
แก้ทั้งหมดก่อนสรุป
