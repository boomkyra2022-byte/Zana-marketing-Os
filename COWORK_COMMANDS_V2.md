# Claude Cowork Commands — ZANA Marketing OS V2

1) อ่าน MASTER_PROMPT_V2.md ทั้งหมด Audit project ปัจจุบันก่อน ห้าม overwrite แบบสุ่ม จากนั้นปรับ core flow เป็น Creative Generator → Idea → Script → Storyboard → Google Drive Final Video → Video Analyzer → Creative Score สร้าง PLAN.md + TODO.md และ Implement Phase 1 จริง

2) Implement Creative Generator แบบ single-page progressive flow: Product + Persona + Knowledge → Ideas → Scripts → Storyboards ผู้ใช้กำหนดจำนวน Idea/Script/Storyboard/Scene ได้ ใช้ DB จริงและ structured JSON

3) ทำ Storyboard production-ready: scene-by-scene, source AI/Footage, camera shot/movement, VO, text, sound, transition, product placement, editing note, AI prompt + Copy/Export

4) Implement Google Drive public link → download → ffmpeg → transcript → frame sampling → AI analysis → Creative Score ต้องทดสอบด้วยคลิปจริง พร้อม progress + readable errors

5) เพิ่ม Timestamp Fix Recommendations + Storyboard vs Final comparison + Revised Script V2 + Generate V2 Storyboard

6) Final audit: hide flow ที่ไม่จำเป็น ตรวจ security/RLS/AI cost/errors/loading/responsive/lint/typecheck/tests แล้ว deploy
