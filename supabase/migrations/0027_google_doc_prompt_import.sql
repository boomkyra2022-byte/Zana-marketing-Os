-- Import of the user's Google Doc "รวม Prompt" (21-tab prompt collection),
-- explicit user request: pasted the doc link + "รวมถึงชุด Prompt Libary นี้เข้าไปด้วย".
-- Extracted via /export?format=txt (Google Docs' new editor doesn't expose
-- body text to normal DOM/accessibility-tree scraping), read in full
-- (2,502 lines / ~70k characters), verbatim, no paraphrasing.
--
-- Organized into 7 groups roughly matching the doc's own tab structure,
-- consolidated where multiple tabs were the same kind of thing (the many
-- small "prompt รูปภาพ / prompt วิดีโอ" factory-conveyor pairs near the end
-- of the doc are grouped together under one group_name, one row per pair).
--
-- Known de-duplication: "MASTER PROMPT — ULTRA REALISTIC WAREHOUSE MEGA SALE
-- CANVAS BANNER + MASS PRODUCT DISPLAY" appeared TWICE in the source doc,
-- verbatim, back to back (once ~line 1119, again ~line 1867) — seeded ONCE
-- here, not duplicated.
--
-- Purely additive, same idempotent `where not exists` pattern as
-- 0024/0025/0026. Does not touch any existing prompt_library rows.

-- ============================================================
-- GROUP 1: ZANA Flow Prompt Director — Custom GPT Instructions
-- ============================================================

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select
  'ZANA Flow Prompt Director — Custom GPT Instructions',
  'ZANA Flow Prompt Director — Full System Prompt',
  'ใช้ตอน: ต้องการ AI assistant ที่คุยกับผู้ใช้เป็นขั้นตอน (ถาม Brief 4 ข้อ → วิเคราะห์ → เขียนบท → สร้าง Prompt) แล้วแปลงเป็น Google Flow Prompt แบบ Scene-by-Scene (10 วินาที/Scene) พร้อม Kinetic Typography, Motion Graphic, B-Roll, Camera Movement, Sound Design ครบ',
  'System Prompt สำหรับ AI Assistant (เช่น Claude Project instructions, Custom GPT) → ใช้สร้าง Prompt สำหรับ Google Flow',
$$ZANA Flow Prompt Director — Custom GPT Instructions
ROLE
คุณคือ ZANA Flow Prompt Director
AI Video Prompt Director + Creative Director + Motion Designer + Short-form Content Strategist
หน้าที่ของคุณคือช่วยผู้ใช้คิดคอนเทนต์วิดีโอ และสร้าง Prompt แบบละเอียดสำหรับนำไปใช้ต่อใน Google Flow
คุณเชี่ยวชาญ:
* Talking Head Video
* Short-form Video
* TikTok
* Facebook / Instagram Reels
* YouTube Shorts
* Viral Content
* Business Content
* Product Advertising
* UGC
* News-style Business Content
* Cinematic Product Video
* Motion Graphics
* Kinetic Typography
* B-Roll
* Camera Movement
* Sound Design
* Retention Editing
เป้าหมายสำคัญ:
ผู้ใช้ไม่จำเป็นต้องเป็น Prompt Engineer
ผู้ใช้เพียงบอกความต้องการคร่าว ๆ
คุณต้องคิด Creative Direction และแปลงข้อมูลทั้งหมดให้เป็น Google Flow Prompt แบบ Production-ready

IMPORTANT WORKFLOW
ห้ามสร้าง Prompt ทันที
เมื่อเริ่มบทสนทนาใหม่ หรือเมื่อผู้ใช้บอกว่าสนใจสร้างวิดีโอ
ให้ถามข้อมูลก่อนสร้าง Prompt เสมอ
ต้องถาม 4 เรื่องต่อไปนี้:

1. สินค้าหรือบริการคืออะไร?
ถามว่า: 1. สินค้าหรือบริการที่ต้องการทำคลิปคืออะไร?
สามารถให้ผู้ใช้อธิบายสั้น ๆ เช่น: ชื่อสินค้า, จุดเด่น, ราคา, โปรโมชั่น, กลุ่มลูกค้า, ปัญหาที่สินค้าช่วยแก้
ไม่จำเป็นต้องตอบทั้งหมด หากผู้ใช้มีข้อมูลเพียงพอแล้ว

2. ต้องการคอนเทนต์แนวไหน?
ถามว่า: 2. ต้องการทำคอนเทนต์แนวไหน?
พร้อมเสนอไอเดียให้ผู้ใช้เลือกทุกครั้ง ตัวอย่าง:
A. Talking Head — ผู้พูดพูดกับกล้อง แล้วเพิ่ม Motion Graphic / B-Roll / Typography
B. Viral News / Business Presenter — เล่าเหมือนรายการข้อมูลหรือคอนเทนต์ข่าวสั้น แต่ไม่แอบอ้างว่าเป็นข่าวจริง
C. Problem → Solution — เปิด Pain ของลูกค้า แล้วค่อย Reveal สินค้า/บริการ
D. UGC / รีวิว — เหมือนลูกค้าเล่าประสบการณ์จริงแบบ Native Content
E. Storytelling — เล่าเรื่องหรือสถานการณ์ให้คนดูอินก่อนขาย
F. Cinematic Product — เน้นภาพสินค้า แสง กล้อง Texture และ Visual Premium
G. Meme / Pattern Interrupt — เปิดด้วย Visual หรือสถานการณ์แปลกเพื่อหยุด Scroll
H. Before / After — เปรียบเทียบก่อนและหลังใช้สินค้า/บริการ
I. Educational / How-to — ให้ความรู้ก่อน แล้วค่อยเชื่อมสินค้า
J. Founder / Expert Content — ผู้เชี่ยวชาญหรือเจ้าของแบรนด์อธิบายปัญหาและวิธีคิด
หลังจากเสนอ ให้ผู้ใช้สามารถตอบเป็นตัวอักษร เช่น: B + C หรืออธิบายสไตล์ใหม่เองก็ได้

3. ต้องการความยาวเท่าไร และกี่ฉาก?
ถามว่า: 3. ต้องการคลิปทั้งหมดกี่วินาที และแบ่งเป็นกี่ฉาก?
ให้คำแนะนำ: Google Flow มักเหมาะกับการสร้างเป็น Scene สั้น ๆ แล้วนำมาต่อกัน ตัวอย่าง:
* 10 วินาที = 1 Scene
* 20 วินาที = 2 Scenes × 10 วินาที
* 30 วินาที = 3 Scenes × 10 วินาที
* 40 วินาที = 4 Scenes × 10 วินาที
* 60 วินาที = 6 Scenes × 10 วินาที
ผู้ใช้สามารถกำหนดเองได้ ถ้าผู้ใช้บอกเพียงความยาว เช่น "30 วินาที" ให้เสนอ: แนะนำ 3 ฉาก × 10 วินาที

4. ต้องการเน้นเรื่องอะไร / Hook แบบไหน?
ถามว่า: 4. มีเนื้อหา จุดขาย Pain Point หรือ Hook ที่อยากเน้นเป็นพิเศษไหม?
พร้อมยกตัวอย่าง:
"ทำธุรกิจคนเดียว ไม่มีใครช่วยคิด" / "ยิงแอดทุกวันแต่ยอดไม่โต" / "ไม่ต้องเก่งเทคก็ขายออนไลน์ได้" / "แม่ท้องไม่ควรต้องทนใส่กางเกงอึดอัด" / "ลูกเหงื่อออก แต่ไม่อยากใช้น้ำหอมผู้ใหญ่" / "อยากให้คนหยุดดูตั้งแต่ 2 วินาทีแรก" / "เปิดคลิปด้วยคำถาม" / "เปิดคลิปแบบข่าว" / "เปิดด้วย Pain แรง ๆ" / "เปิดด้วยประโยคขัดความเชื่อ" / "อยาก Hard Sell ช่วงท้าย" / "อยากเน้นราคา / โปรโมชั่น"
ถ้าผู้ใช้ไม่มี Hook ให้ตอบว่า: ถ้ายังไม่มี เดี๋ยวฉันคิด Hook ให้จากสินค้าและกลุ่มเป้าหมายได้

FIRST RESPONSE FORMAT
เมื่อผู้ใช้เริ่มใช้งาน GPT ให้ตอบในรูปแบบนี้:

ก่อนสร้าง Prompt ขอ Brief 4 ข้อนี้ก่อน:
1. สินค้า / บริการคืออะไร? บอกชื่อ + รายละเอียดคร่าว ๆ ได้เลย
2. อยากได้คอนเทนต์แนวไหน? A. Talking Head / B. Viral News / Business Presenter / C. Problem → Solution / D. UGC / รีวิว / E. Storytelling / F. Cinematic Product / G. Meme / Pattern Interrupt / H. Before / After / I. Educational / J. Founder / Expert — เลือกได้มากกว่า 1 แนว เช่น B + C
3. คลิปกี่วินาที / กี่ฉาก? เช่น 30 วินาที = 3 ฉาก × 10 วินาที
4. อยากเน้นอะไรเป็นพิเศษ? Pain / จุดขาย / โปรโมชั่น / Hook / CTA หรือประโยคที่อยากให้พูด
ส่งมาแบบสั้น ๆ ได้ เช่น: สินค้า: ... / แนว: ... / ความยาว: ... / เน้น: ...

IMPORTANT: DO NOT OVER-QUESTION
หากผู้ใช้ให้ข้อมูลบางส่วนมาแล้ว ห้ามถามข้อมูลเดิมซ้ำ ถามเฉพาะสิ่งที่ยังขาด
ถ้าข้อมูลทั้ง 4 ส่วนครบแล้ว ห้ามถามเพิ่มเติมโดยไม่จำเป็น ให้เริ่มสร้างงานทันที

STEP 2 — ANALYZE THE BRIEF
หลังได้รับข้อมูลครบ ให้วิเคราะห์ภายในก่อนสร้าง Prompt:
1. ใครคือคนดู 2. Pain หลักคืออะไร 3. Desire คืออะไร 4. Core Message คืออะไร 5. Benefit สำคัญที่สุดคืออะไร 6. Hook แบบไหนเหมาะ 7. Video Objective คืออะไร 8. CTA ควรเป็นอะไร 9. Video Flow ควรเดินอย่างไร
จากนั้นสรุปให้ผู้ใช้สั้น ๆ: Concept: [1–2 ประโยค] / Hook: [Hook ที่เลือก] / Flow: Scene 1 → ... / Scene 2 → ... / Scene 3 → ...
แล้วสร้าง Prompt ต่อทันที

STEP 3 — GENERATE SCRIPT
แต่ละ Scene ต้องมีบทพูดภาษาไทยจริง บทพูดต้อง: ฟังเหมือนภาษาคนพูด, ไม่เหมือนบทความ, กระชับ, พูดได้ทันตามเวลาที่กำหนด, มี Hook, มี Rhythm, เข้าใจง่าย, ไม่ใช้ศัพท์ยากโดยไม่จำเป็น
ถ้า Scene = 10 วินาที: บทพูดควรสั้นพอให้พูดได้จริงภายในประมาณ 10 วินาที ห้ามเขียนบทพูดยาวเกินเวลาอย่างชัดเจน

STEP 4 — GENERATE GOOGLE FLOW PROMPTS
สร้าง Prompt แยกตามจำนวน Scene ทุก Scene ต้องเป็น Standalone Prompt
หมายความว่า: ผู้ใช้สามารถ Copy Scene 2 ไปใช้โดยไม่ต้องมี Scene 1 อยู่ใน Prompt เดียวกัน
ห้ามเขียน: "ทำเหมือนฉากก่อน" / "ใช้ Style เดิม" / "ต่อจากฉาก 1"
แต่ต้องเขียนรายละเอียด Visual Identity ที่จำเป็นซ้ำให้ครบในแต่ละ Scene

STRUCTURE OF EACH SCENE
ทุก Prompt ต้องประกอบด้วย:
SCENE TITLE เช่น SCENE 1 — HOOK / PROBLEM
DURATION ระบุ: 10 seconds, Vertical 9:16
CHARACTER — หากผู้ใช้ใช้ Talking Head หรือ Existing Footage: ระบุอย่างชัดเจนว่าคงตัวละครเดิม 100% ทั้ง ใบหน้า, รูปร่าง, เสื้อผ้า, ทรงผม, สีผิว, สีหน้า, Gesture, Body Movement, Lip Sync, Timing, Original Voice — ห้ามเปลี่ยนบุคคล ห้ามสร้างใบหน้าใหม่ ปรับเฉพาะองค์ประกอบรอบตัว
SCRIPT — ระบุ: บทพูดภาษาไทย: "..." บทพูดต้องสัมพันธ์กับ Scene Purpose
TIMELINE — แบ่ง Execution ภายใน Scene ตัวอย่าง:
0–2 วินาที — Hook (อธิบาย Camera / Text / Motion / Sound / Visual)
2–6 วินาที — Message (อธิบาย Visual Response ตามคำพูด)
6–10 วินาที — Reveal / Transition (อธิบายการปิด Scene)

KINETIC TYPOGRAPHY
สร้างข้อความจริงที่ต้องแสดง ห้ามเขียนเพียง "เพิ่มข้อความ" ต้องเขียนเช่น:
หัวข้อเล็ก: "เจ้าของร้านต้องรู้"
Headline: "ทำทุกอย่างคนเดียวอยู่ไหม?"
Supporting Text: "ขายเอง • โพสต์เอง • ตอบเอง"
CTA: "ทักคำว่า ครบจบ"
Typography ต้อง: อ่านง่าย, สั้น, สัมพันธ์กับเสียงพูด, เข้าตามจังหวะคำพูด

MOTION GRAPHIC
ต้องระบุ Graphic ที่ต้องสร้างจริง เช่น Animated Funnel, Workflow Diagram, Floating UI, Dashboard, Content Calendar, Chat Interface, Product Callout, Before / After, Checklist, Data Flow, Customer Journey, Timeline, Graph Animation, Sales Pipeline
อย่าใช้ Graphic เพียงเพื่อความสวย Graphic ต้องช่วยอธิบาย Message

B-ROLL
ถ้าควรมี B-Roll ให้ระบุ: 1. B-Roll คืออะไร 2. ปรากฏช่วงไหน 3. อยู่ตำแหน่งใด 4. เข้ามาด้วย Animation แบบไหน
ตัวอย่าง: "ช่วง 3–4.5 วินาที แทรก B-Roll เจ้าของร้านกำลังจดออเดอร์ลงสมุด เป็น Floating Window ด้านซ้ายของผู้พูด แล้วใช้ Mask Wipe เปลี่ยนเป็นหน้าจอแชตลูกค้า"
ห้ามเขียนเพียง "ใส่ B-Roll ที่เกี่ยวข้อง"

CAMERA MOVEMENT
เลือกตามบริบท: Dynamic Push-In, Punch Zoom, Smooth Camera Drift, Digital Zoom, Parallax, Controlled Camera Shake, Rack Focus Simulation, Crop Change, Camera Pan, Speed Ramp — ไม่จำเป็นต้องใช้ทั้งหมด

SOUND DESIGN
คงเสียงพูดต้นฉบับให้ชัดที่สุด สามารถเพิ่ม: Whoosh, UI Click, Pop, Impact, Riser, Sweep, Notification, Digital Beep, Bass Hit
Sync กับ: Text, Graphic, Transition, CTA, Punchline — ห้าม Sound Effect กลบเสียงพูด

RETENTION RULE
วิดีโอ Short-form: ทุกประมาณ 1–2 วินาทีต้องมี Visual Change อย่างน้อยหนึ่งอย่าง เช่น Camera Change, Typography, B-Roll, Motion Graphic, UI, Transition, Zoom, Object Movement
แต่ห้ามใส่ Effect จนรก ให้ Message เป็นพระเอก

STYLE ADAPTATION
ให้ปรับ Visual Style ตามคอนเทนต์ที่ผู้ใช้เลือก ตัวอย่าง:
Talking Head — ใช้ Floating Typography, Motion Tracking, B-Roll, UI Overlay, Punch Zoom
Viral Business Presenter — ใช้ Modern Information Studio, Lower Third, Business Ticker, Data Graphic, Presenter Style (ห้ามทำให้เข้าใจว่าเป็นข่าวจริง หากเนื้อหาไม่ใช่ข่าวจริง)
UGC — ใช้ Native Social Look, Smartphone Framing, Comment Bubble, Casual Text, Light Editing
Cinematic Product — ใช้ Product Hero, Macro, Lighting, Texture, Camera Orbit, Slow Motion, Premium Sound
Problem → Solution — ใช้ Pain Visualization, Chaos, Pattern Interrupt, Reveal, Transformation

SAFETY FOR NEWS-STYLE CONTENT
ถ้าผู้ใช้เลือก Viral News / Breaking News Style / พิธีกรข่าว / รายการข่าว และเป็นโฆษณาหรือ Fictional Marketing Content:
ให้เปลี่ยนคำอธิบายเป็น Business Presenter / Information Studio / News-inspired Presentation / Digital Business Report Style
ระบุว่าเป็น Creative Advertising Content ห้ามอ้างว่าเป็นข่าวจริง
ห้ามสร้าง: ข่าวปลอม, เหตุการณ์ปัจจุบันปลอม, สำนักข่าวปลอมที่ดูเหมือนของจริง, โลโก้สถานีข่าว, Public Figure, รายงานสด, สถิติปลอม
สามารถเก็บ Visual Energy แบบรายการข่าวได้

CLAIM SAFETY
ห้ามสร้าง: ยอดขายปลอม, รีวิวปลอม, ผลลัพธ์ปลอม, สถิติปลอม, ก่อน/หลังที่หลอกผู้ชม, Claim ที่ไม่ได้รับจากผู้ใช้
ถ้าต้องใช้ Dashboard เพื่อสื่อ Concept ให้เป็น Abstract / Conceptual Dashboard ไม่แสดงตัวเลขที่ทำให้เข้าใจว่าเป็นผลลัพธ์จริง

OUTPUT STYLE
ตอบเป็นภาษาไทยเป็นหลัก ศัพท์ Production สามารถใช้ภาษาอังกฤษได้ เช่น Motion Tracking, Kinetic Typography, Punch Zoom, B-Roll, CTA, Workflow, Dashboard
Prompt ต้องละเอียด เป้าหมายคือให้ผู้ใช้สามารถ COPY → GOOGLE FLOW → GENERATE ได้ทันที ไม่ต้องนำไปขยาย Prompt อีก

FINAL OUTPUT FORMAT
หลังได้รับ Brief ครบ:
แนวคิดคลิป [Concept]
Hook [Hook]
Flow Scene 1 → ... / Scene 2 → ... / Scene 3 → ...

จากนั้น:
PROMPT 1 — SCENE 1
[Full detailed prompt]

PROMPT 2 — SCENE 2
[Full detailed prompt]
ดำเนินต่อจนครบ

MOST IMPORTANT RULE
คุณไม่ได้มีหน้าที่แค่เขียน Prompt คุณต้อง ช่วยคิด Creative Execution ให้ผู้ใช้
Brief ของผู้ใช้อาจมีเพียง: "ขายบริการการตลาดให้เจ้าของร้านอายุเยอะ ทำร้านคนเดียว"
คุณต้องสามารถคิดต่อเองว่า: Pain คืออะไร, Hook คืออะไร, ควรใช้ Visual แบบไหน, แต่ละ Scene ควรเล่าอะไร, ข้อความบนจอควรเป็นอะไร, B-Roll ควรเป็นอะไร, Motion ควรตอบสนองอย่างไร, CTA ควรปิดแบบไหน
ผู้ใช้มีหน้าที่บอก "สิ่งที่อยากสื่อ" คุณมีหน้าที่เปลี่ยนสิ่งนั้นให้เป็น Production-ready Google Flow Prompt$$,
  'วิธีใช้: วาง prompt นี้ทั้งหมดเป็น system prompt / custom instructions ของ AI assistant ที่คุณใช้ จากนั้นบอกสินค้า/บริการที่ต้องการทำคลิป — AI จะถาม Brief 4 ข้อ แล้วสร้าง Script + Google Flow Prompt แบบ Scene-by-Scene ให้ครบ',
  1
where not exists (select 1 from prompt_library where title = 'ZANA Flow Prompt Director — Full System Prompt');


-- ============================================================
-- GROUP 2: Visual Metaphor / Surreal Concept Ads — ZANA
-- ============================================================

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'โครงสร้าง Prompt พื้นฐาน (Base Structure)',
  'ใช้ตอน: จะเขียน Prompt โฆษณาแนว Visual Metaphor เองตั้งแต่ต้น อยากมีโครงตั้งต้นที่ครบทุกช่อง (Role/Style/Idea/Scene/Product/Layout/Text/Tone/Format) ก่อนค่อยเติมรายละเอียด',
  'Text-to-image (Nano Banana Pro, Midjourney, หรือเครื่องมือ text2image ทั่วไป)',
  '4:5 หรือ 9:16',
$$[ROLE / GOAL]
Create a high-impact Thai social commerce advertising poster for [PRODUCT NAME].
[STYLE]
Use a conceptual advertising style with visual metaphor, surreal product staging, miniature diorama details, commercial key visual quality, and infographic ad layout.
[MAIN IDEA]
The core metaphor is: [PAIN POINT] = [VISUAL METAPHOR].
[SCENE]
Show [MAIN VISUAL SCENE] as the hero scene, with the product placed clearly in the foreground or lower-right area.
[PRODUCT]
Use ZANA branding only.
Show the product packaging clearly and attractively.
The product must look premium, clean, realistic, and readable.
Do not use KYRA branding.
[LAYOUT]
Design the layout like a Thai ad poster:
- Big Thai headline at the top
- Supporting subheadline
- Main metaphor scene in the center
- Product shot clearly visible
- Benefit icons section
- Simple step-by-step usage section
- CTA section at the bottom
- Rich but organized composition
- Social-commerce-ready vertical poster
[TEXT]
All visible headline and supporting text must be in Thai, bold, clear, legible, and ad-ready.
[VISUAL TONE]
Polished, premium, playful, smart, eye-catching, scroll-stopping, dramatic lighting, highly detailed, glossy commercial finish.
[FORMAT]
Vertical 4:5 or 9:16 poster, high resolution, ultra detailed.$$,
  'ใช้เป็นจุดตั้งต้นก่อนไปดู MASTER PROMPT (พร้อมใช้กว่า) หรือตัวอย่าง A1-A3 / P1-P5 ด้านล่างในกลุ่มนี้',
  1
where not exists (select 1 from prompt_library where title = 'โครงสร้าง Prompt พื้นฐาน (Base Structure)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'Master Prompt — ใช้ได้กับสินค้าทุกตัว',
  'ใช้ตอน: อยากได้ Prompt พร้อมใช้ทันที (ไม่ต้องประกอบเองทีละช่อง) แค่เติม [PRODUCT NAME] / [PROBLEM] / [METAPHOR SCENE] แล้วก็ generate ได้เลย',
  'Text-to-image (Nano Banana Pro, Midjourney, หรือเครื่องมือ text2image ทั่วไป)',
  '4:5 หรือ 9:16 แนวตั้ง',
$$Create a premium Thai advertising poster in a conceptual visual metaphor style for ZANA [PRODUCT NAME].
The poster must feel like a social commerce ad, combining surreal product photography, miniature diorama storytelling, and infographic poster design.
Use a strong visual metaphor where [PROBLEM] is transformed into a striking scene: [METAPHOR SCENE].
Show the product clearly in the composition with ZANA branding only, no KYRA branding anywhere.
The image should include:
- a large bold Thai headline at the top
- a short supporting subheadline
- a central hero visual based on the metaphor
- the product packshot displayed clearly
- benefit icons with short Thai labels
- a 3-step or 4-step usage section
- a CTA area at the bottom
- premium ad composition with clean hierarchy
Style details:
- highly detailed
- realistic but imaginative
- glossy commercial lighting
- rich pink / purple / white or brand-appropriate color palette
- dramatic but cute and accessible
- perfect for Thai Facebook / TikTok / social commerce posting
- vertical layout
- ultra sharp
- high readability
- premium advertising quality
Do not make it look like a generic ecommerce packshot.
Make it feel like an idea-led advertising visual.
Text must be in Thai and visually clear.$$,
  'คำสั่งเสริมที่ควรใส่ท้าย Prompt ทุกครั้ง (จากต้นฉบับ): use ZANA branding only / do not show KYRA or Kyra / make the text readable and ad-like / keep the product label clean and believable / emphasize social-commerce clarity / avoid generic ecommerce packshot style / focus on a strong single visual metaphor / vertical 4:5 composition / ultra detailed / premium advertising look / Thai audience friendly. เคล็ดลับปรับผลลัพธ์: ถ้าภาพ "สวยแต่ยังไม่ขาย" ให้เพิ่ม direct-response layout, high readability, clear Thai headline hierarchy, conversion-friendly poster, strong CTA area; ถ้าภาพ "ขายเกินไป ไม่น่าหยุดดู" ให้เพิ่ม more conceptual, stronger visual metaphor, more surreal, more cinematic hero scene',
  2
where not exists (select 1 from prompt_library where title = 'Master Prompt — ใช้ได้กับสินค้าทุกตัว');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'A1 — "ปลายทางที่ถูกต้อง" Billboard Concept (Alpha Arbutin)',
  'โฆษณา ZANA Alpha Arbutin เน้นสื่อสารว่าห้ามกิน ต้องผสมครีมเท่านั้น',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a high-impact Thai vertical advertising poster for ZANA Alpha Arbutin in a billboard conceptual ad style.
Main idea:
The message is that Alpha Arbutin is not for eating, the correct destination is mixing into body cream.
Hero scene:
Show a giant roadside billboard in a city at sunset.
On the billboard, a large capsule labeled Alpha Arbutin is opening and pink powder is pouring into a cream jar.
A bold arrow points from a crossed-out mouth icon to a jar of cream, symbolizing the correct usage path.
The cream jar should look glossy, soft pink, premium, and attractive.
Include:
- big Thai headline: idea about "ปลายทางของเม็ดนี้...ไม่ใช่ปาก"
- supporting Thai text explaining that it must be mixed with cream
- a clear crossed-out "ห้ามกิน" warning box
- a "ผสมครีม" destination label
- product sachet shown clearly on the lower-right side
- a 4-step usage strip at the bottom: 1. เปิดแคปซูล 2. เทผงลงครีม 3. ผสมให้เข้ากัน 4. ใช้ตามวิธีที่ระบุ
- benefit icon row at the bottom
- small Thai legal-style caution: ใช้ภายนอกเท่านั้น / ไม่ใช่ยา / ไม่ใช่อาหารเสริม
Style:
- conceptual advertising
- polished billboard mockup
- pink and white color palette
- glossy commercial look
- eye-catching Thai social commerce poster
- high readability
- premium lighting
- ultra detailed
- vertical composition
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  3
where not exists (select 1 from prompt_library where title = 'A1 — "ปลายทางที่ถูกต้อง" Billboard Concept (Alpha Arbutin)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'A2 — "ขาวอย่างเดียวไม่พอ ต้องดูเนียนด้วย" Beauty Infographic (Alpha Arbutin)',
  'โฆษณา ZANA Alpha Arbutin เน้นว่าผิวขาวอย่างเดียวไม่พอ ต้องเนียนและสีผิวสม่ำเสมอด้วย',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a premium Thai skincare poster for ZANA Alpha Arbutin in a beauty infographic advertising style.
Main concept:
Healthy-looking skin is not only about being white; it should also look smooth and even-toned.
Hero scene:
Show soft, beautiful body skin in the background with a feminine premium skincare mood.
Place the ZANA Alpha Arbutin sachet clearly at center.
Show opened pink capsules with powder spilling out elegantly near the product.
Include supporting visual callouts in translucent circles: ผิวดูกระจ่างใส / ผิวดูเนียนขึ้น / สีผิวดูสม่ำเสมอ
Include:
- large Thai headline at the top
- short emotional supporting line
- product at center
- easy 4-step usage strip at the lower section
- right-side info box: "ทำไมต้องผงผสมครีม?"
- bottom strip with short trust points: ใช้ผสมกับครีม / 1 ซอง 10 แคปซูล / ควรทดสอบการแพ้ก่อนใช้
Style:
- feminine
- premium
- pink-white skincare aesthetic
- soft glow
- glossy beauty ad
- clean hierarchy
- highly readable Thai typography
- vertical poster
- commercial advertising finish
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  4
where not exists (select 1 from prompt_library where title = 'A2 — "ขาวอย่างเดียวไม่พอ ต้องดูเนียนด้วย" Beauty Infographic (Alpha Arbutin)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'A3 — "เพิ่มอีก 1 Step" Problem-Solution Infographic (Alpha Arbutin)',
  'โฆษณา ZANA Alpha Arbutin แบบ Problem-Solution — ผิวหมอง/ไม่เนียน/สีไม่สม่ำเสมอ → เพิ่ม 1 step ในรูทีนครีม',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a Thai social commerce poster for ZANA Alpha Arbutin in a problem-solution conceptual infographic style.
Main idea:
For people with dull-looking skin, rough texture, and uneven tone, ZANA Alpha Arbutin becomes "one extra step" added into their cream routine.
Hero composition:
Divide the upper section into 3 problem panels: ผิวหมอง / ดูไม่เนียน / สีผิวไม่สม่ำเสมอ
Use clean pink arrows pointing from each problem panel down toward the product sachet in the center.
On the right side, show a result box with 3 core benefits: กระจ่างใส / ดูเนียน / สีผิวสม่ำเสมอ
At the bottom:
- show the 4-step usage strip
- show a pink promo box with price options
- a CTA button area like "สั่งซื้อเลย!"
Style:
- direct-response ad
- Thai marketplace style
- clean but bold
- pink-white visual identity
- infographic-heavy layout
- optimized for conversion
- high readability
- vertical format
- commercial poster quality
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  5
where not exists (select 1 from prompt_library where title = 'A3 — "เพิ่มอีก 1 Step" Problem-Solution Infographic (Alpha Arbutin)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'P1 — "CASE FILE / Evidence Board" Detective Concept (Alpha Purple)',
  'โฆษณา ZANA Alpha Purple 3 Plus+ Booster Serum แนวสืบสวน — คราบบนฟันคือ "หลักฐาน" ที่ต้องสืบและแก้',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a dramatic Thai advertising poster for ZANA Alpha Purple 3 Plus+ Booster Serum in a detective evidence board style.
Main metaphor:
Stains on teeth are like criminal evidence. The product is the helper that investigates and fixes the problem.
Hero scene:
Create a dark desk / crime-board setup with pinned photos, evidence notes, and purple dramatic lighting.
Show a before-after smile photo pinned on the board.
Show "suspect" items causing stains: coffee, tea, red wine, smoking
Place the ZANA Alpha Purple product box and serum bottle prominently in the center foreground.
Include:
- bold Thai headline like a case file title
- evidence labels
- a stain checklist
- a shade guide card
- benefit box: ฟันดูขาวขึ้น / ลดคราบเหลือง / ยิ้มมั่นใจขึ้น
- simple 3-step usage card
- promo price strip at bottom
- legal/trust strip
Style:
- conceptual ad
- detective / crime board storytelling
- purple brand color
- dramatic cinematic lighting
- premium, scroll-stopping, highly detailed
- readable Thai text
- vertical social ad format
Use ZANA branding only, no KYRA.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  6
where not exists (select 1 from prompt_library where title = 'P1 — "CASE FILE / Evidence Board" Detective Concept (Alpha Purple)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'P2 — "Smile Car Wash" Miniature Diorama Concept (Alpha Purple)',
  'โฆษณา ZANA Alpha Purple แนว Diorama — คราบบนฟันเหมือนสิ่งสกปรกบนรถ ต้องมี "คาร์แคร์" ให้รอยยิ้ม',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a Thai conceptual ad poster for ZANA Alpha Purple 3 Plus+ Booster Serum in a miniature diorama style.
Main metaphor:
Teeth stains are like dirt on a car, so the smile needs a "car wash."
Hero scene:
Show a giant tooth going through a whimsical Smile Car Wash system.
Tiny workers in purple uniforms are cleaning the tooth with brushes, foam, water spray, and polishing tools.
The tooth should visibly have stain patches being cleaned.
Place the ZANA Alpha Purple product box and serum bottle clearly in the lower-left or lower foreground.
Include:
- big Thai headline about "คราบสะสมก็เหมือนรถ...ปล่อยไว้นานก็เห็นชัด"
- subheadline supporting the metaphor
- benefit icons row: ช่วยดูแลคราบเหลืองบนผิวฟัน / ช่วยให้ฟันดูขาวขึ้น / อ่อนโยน ไม่ทำร้ายเคลือบฟัน / มั่นใจทุกการยิ้ม
- 4-step usage strip at bottom
- strong CTA panel
Style:
- miniature diorama advertising
- playful but premium
- glossy commercial lighting
- detailed foam, water, machinery
- purple and white palette
- fun, clever, high-stop-scroll effect
- ultra detailed vertical poster
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  7
where not exists (select 1 from prompt_library where title = 'P2 — "Smile Car Wash" Miniature Diorama Concept (Alpha Purple)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'P3 — "Smile Pit Stop" Racing Concept (Alpha Purple)',
  'โฆษณา ZANA Alpha Purple แนวแข่งรถ — รอยยิ้มก็ต้องมี pit stop เพื่อลบคราบและเติมความมั่นใจ',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a premium Thai poster for ZANA Alpha Purple 3 Plus+ Booster Serum in a racing pit stop conceptual ad style.
Main metaphor:
Your smile needs a pit stop to remove stains and restore confidence.
Hero scene:
Show a giant stained tooth in the center of a racing pit stop.
Mini pit crew members in purple uniforms are scrubbing, polishing, spraying, and cleaning the tooth like a Formula-style pit stop service.
Show pit stop signs and direction boards referencing daily habits: coffee every morning, daily life, smile care every night
Place the product box and serum bottle clearly in the foreground on glowing product podiums.
Include:
- very large Thai headline: "รอยยิ้มก็ต้องมี PIT STOP"
- subheadline about stopping stains and adding confidence
- icon row of key benefits
- easy 4-step usage panel
- trust badge row at bottom
Style:
- dynamic
- energetic
- purple brand-dominant
- premium advertising finish
- playful motorsport inspiration
- social-commerce poster
- ultra detailed
- vertical format
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  8
where not exists (select 1 from prompt_library where title = 'P3 — "Smile Pit Stop" Racing Concept (Alpha Purple)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'P4 — "Smile Security X-Ray Scan" Airport Concept (Alpha Purple)',
  'โฆษณา ZANA Alpha Purple แนวสนามบิน — สแกนหาคราบก่อนที่จะทำลายความมั่นใจ',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a Thai conceptual product ad for ZANA Alpha Purple 3 Plus+ Booster Serum in a security X-ray scan style.
Main metaphor:
Stains can be scanned and detected before they damage your confidence.
Hero scene:
Show a futuristic airport security scanner labeled Smile Security X-Ray Scan.
Inside the scan screen, display a giant tooth with highlighted stain spots.
Around the screen, identify common stain-causing items as if they are scanned luggage: coffee, Thai tea, smoking, red wine, dark drinks
Place the product bottle prominently in the foreground.
Make the whole composition feel like a premium airport security checkpoint for smiles.
Include:
- bold Thai headline about every stain being scannable
- short line about not letting stains pass into your smile
- benefit icon row
- simple 3-step or 4-step usage card
- bottom trust strip
- sticky-note style CTA box
Style:
- surreal ad concept
- futuristic but approachable
- purple / silver lighting
- glossy signage
- strong readability
- high-detail screen interface
- vertical commercial poster
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  9
where not exists (select 1 from prompt_library where title = 'P4 — "Smile Security X-Ray Scan" Airport Concept (Alpha Purple)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'P5 — "คราบเหลืองบนฟัน อยากลบตรงไหนก่อน?" Problem Mapping (Alpha Purple)',
  'โฆษณา ZANA Alpha Purple แนวแผนผังปัญหา — เชื่อมสาเหตุคราบเหลืองแต่ละอย่างเข้ากับฟัน',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง',
$$Create a Thai social commerce ad poster for ZANA Alpha Purple 3 Plus+ Booster Serum in a problem-mapping infographic style.
Main idea:
The poster visually maps stain sources to yellowing on a large tooth.
Hero scene:
Show a large tooth in the center with visible stain patches.
From the left side, connect stain source icons to the tooth with clean graphic lines: coffee, Thai tea, smoking, red wine
At the upper-right, show the ZANA Alpha Purple bottle tilted so that purple serum pours or radiates toward the tooth.
Place the product packshot at the lower-left.
Include:
- large Thai headline asking where the yellow stains should be removed first
- subheadline positioning the product as a helper
- 3 benefit bullets: ช่วยดูแลคราบเหลืองบนผิวฟัน / ให้ฟันดูขาวและสดใสขึ้น / เพิ่มความมั่นใจในทุกการยิ้ม
- easy usage strip
- smile photo inset
- CTA corner
Style:
- clean medical-meets-commercial aesthetic
- purple-white color palette
- premium healthcare advertising
- polished infographic
- readable Thai text
- ultra detailed vertical poster
Use ZANA branding only.$$,
  'ปิดท้ายด้วยคำสั่งเสริมที่แนะนำ (ดูใน "Master Prompt — ใช้ได้กับสินค้าทุกตัว" ในกลุ่มเดียวกัน)',
  10
where not exists (select 1 from prompt_library where title = 'P5 — "คราบเหลืองบนฟัน อยากลบตรงไหนก่อน?" Problem Mapping (Alpha Purple)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Visual Metaphor / Surreal Concept Ads — ZANA Alpha Arbutin & Alpha Purple',
  'Template สินค้าอื่น + คำสั่งท้าย Prompt (ใช้ประยุกต์ต่อ)',
  'ใช้ตอน: จะเอาสไตล์ Visual Metaphor นี้ไปใช้กับสินค้า ZANA ตัวอื่นที่ยังไม่มีตัวอย่าง',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'แนวตั้ง 4:5',
$$Create a Thai conceptual advertising poster for ZANA [PRODUCT NAME].
Use a visual metaphor where [pain/problem] is transformed into [unexpected scene/metaphor].
Blend surreal product ad, miniature diorama, and infographic social-commerce poster design.
Show the product clearly, use only ZANA branding, and make the layout look like a premium Thai Facebook/TikTok ad poster.
The poster must include:
- bold Thai headline
- short subheadline
- hero metaphor scene
- product shot
- 3 to 4 benefits
- usage steps
- CTA zone
Style:
- highly detailed
- scroll-stopping
- premium lighting
- polished commercial finish
- readable Thai text
- vertical poster

Additional requirements (ใส่ท้าย Prompt ทุกครั้ง):
- use ZANA branding only
- do not show KYRA or Kyra
- make the text readable and ad-like
- keep the product label clean and believable
- emphasize social-commerce clarity
- avoid generic ecommerce packshot style
- focus on a strong single visual metaphor
- vertical 4:5 composition
- ultra detailed
- premium advertising look
- Thai audience friendly$$,
  'เก็บเข้าระบบในชื่อหมวด: Visual Metaphor / Surreal Concept Ads (ชื่อทางเลือกอื่น: Surreal Concept Ads, Miniature Diorama Product Ads, Idea-led Social Commerce Posters)',
  11
where not exists (select 1 from prompt_library where title = 'Template สินค้าอื่น + คำสั่งท้าย Prompt (ใช้ประยุกต์ต่อ)');


-- ============================================================
-- GROUP 3: UGC CGI Auto-Generate
-- ============================================================

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'UGC CGI Auto-Generate (ไม่ต้องถามคำถาม)',
  'สร้างวิดีโอ UGC CGI TikTok/Reels/Shorts อัตโนมัติทันที',
  'ใช้ตอน: ต้องการวิดีโอ UGC สไตล์รีวิวจากผู้ใช้จริง แบบรวดเร็ว ไม่ต้องตอบคำถามอะไรเพิ่ม — ใส่รูปสินค้าแล้วปล่อยให้ AI วิเคราะห์และคิดสคริปต์/สตอรี่บอร์ดเองทั้งหมด',
  'AI Video Generator ที่รับรูปสินค้าเป็น reference (เช่น Seedance, Kling, Veo)',
  '9:16 แนวตั้ง · 10 วินาที',
$$## PRODUCT LOCK
ใช้รูปสินค้าเป็น Master Reference 100%
ห้ามเปลี่ยนแพ็กเกจ โลโก้ แบรนด์ ฉลาก สี รูปทรง วัสดุ สัดส่วน และรายละเอียดทุกจุด สินค้าต้องเหมือนกันทุกเฟรม

## AUTO ANALYZE
วิเคราะห์อัตโนมัติ
- ประเภทสินค้า
- จุดเด่น
- กลุ่มเป้าหมาย
- วิธีใช้
- Mood & Tone
- Environment
- Props
- Hook
- Ending

## VIDEO
- Vertical 9:16
- 10 วินาที
- 8K HDR
- Ultra Photorealistic
- Sony A7R V
- Commercial Quality
- Natural Motion
- ไม่มี Flicker, Morph, Deformation

## STYLE
โฆษณาแนว UGC เหมือนผู้ใช้จริงรีวิวให้เพื่อน
เป็นธรรมชาติ น่าเชื่อถือ ไม่ Hard Sell ไม่โอเวอร์

## VOICE
เลือกเพศเสียงให้เหมาะกับสินค้า
พูดแบบวัยทำงาน ใช้ภาษาปาก ฟังลื่น เป็นกันเอง กระชับ จบจริงใน 10 วินาที
ห้ามใช้คำเกินจริงหรือกล่าวอ้างที่พิสูจน์ไม่ได้ และต้องภาษาไทยเท่านั้น

## SCRIPT
AI คิดใหม่ทุกครั้ง
Hook → ประสบการณ์ → จุดเด่น → ความรู้สึก → Soft CTA
ประมาณ 28–38 คำ พูดจบครบภายใน 10 วินาที

## STORYBOARD
สร้าง 7–8 ฟุตเทจ
เปลี่ยนมุมกล้องทุกประมาณ 2 วินาที
ห้ามใช้มุมซ้ำติดกัน
มุมกล้อง 2 วินาทีแรก ปาสินค้าเข้ากล้อง
ใช้มุมกล้องให้เหมาะกับสินค้า เช่น
Hero, Macro, Close-up, POV, Handheld, Orbit, Slider, Top View, Detail, Over Shoulder

## CAMERA
ทุกช็อตต้องมี Movement เช่น
Push In, Pull Out, Orbit, Pan, Tilt, Slide, Truck, Tracking, Rack Focus, Handheld

## ENVIRONMENT
AI เลือกฉากให้เหมาะกับสินค้า เช่น
Beauty, Bathroom, Kitchen, Office, Bedroom, Cafe, Living Room, Studio, Outdoor, Luxury Table พร้อม Props ที่เกี่ยวข้อง

## EDITING
ตัดต่อเร็ว ลื่นไหล สไตล์ TikTok
ใช้ Transition เช่น
Whip, Speed Ramp, Match Cut, Object Wipe, Lens Wipe, Flash, Push, Zoom, Motion Blur

## SOUND
ใส่ BGM Lifestyle เบา ๆ (20–30%)
ทุกการเปลี่ยนฉากต้องมี SFX เช่น Whoosh, Swipe, Pop, Click
เพิ่ม SFX ตามการใช้งานจริงของสินค้า เช่น เปิดฝา กดปั๊ม เทน้ำ ฉีกซอง หมุนฝา วางสินค้า สัมผัสเนื้อสินค้า

## COMMANDS & USAGE
แสดงวิธีใช้งานหรือกินดื่มตามความเหมาะสมของสินค้า

## TEXT
ห้ามมีข้อความบนวิดีโอตามที่แจ้ง
ไม่มี Subtitle, Caption, ราคา, โปรโมชัน, โลโก้เพิ่ม หรือ Watermark

## OUTPUT
สร้างอัตโนมัติ
- Storyboard
- Script พากย์ไทย
- Scene Breakdown
- Camera
- SFX Automatically generate realistic, perfectly synchronized sound effects for every scene, action, interaction, object movement, transition, camera movement, environmental ambience, and product usage throughout the entire video.
- Transition
- BGM เบาๆ
- ข้อความ hook ที่ตัวสินค้าทุก ~2 วินาที ตัวหนังสือน่ารักสีขาว

## QC
✓ สินค้าเหมือนต้นฉบับ 100%
✓ แสดงวิธีใช้งานหรือกินดื่มตามความเหมาะสมของสินค้า
✓ ข้อความ hook ที่ตัวสินค้าทุก ~2 วินาที ตัวหนังสือน่ารักสีขาว
✓ ไม่มี Watermark
✓ กล้องเปลี่ยนทุก ~2 วินาที
✓ วิดีโอลื่นไหล
✓ เสียงธรรมชาติ
✓ SFX ทุกฉาก
✓ SFX Automatically generate realistic, perfectly synchronized sound effects for every scene, action, interaction, object movement, transition, camera movement, environmental ambience, and product usage throughout the entire video.
✓ BGM เบาๆ
✓ พร้อมใช้งาน TikTok / Reels / Shorts$$,
  'ใช้กับรูปสินค้าอัปโหลด — AI จะวิเคราะห์และคิดสคริปต์/สตอรี่บอร์ดเองทั้งหมดโดยไม่ต้องตอบคำถามเพิ่ม',
  1
where not exists (select 1 from prompt_library where title = 'สร้างวิดีโอ UGC CGI TikTok/Reels/Shorts อัตโนมัติทันที');


-- ============================================================
-- GROUP 4: Master Prompt — สินค้าถือมือ / POV Commercial
-- ============================================================

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Master Prompt — สินค้าถือมือ / POV Commercial Photography',
  'Master Prompt — POV มือถือสินค้า (ใช้กับทุกสถานการณ์)',
  'ใช้ตอน: ต้องการภาพสินค้าถือในมือแบบ POV สมจริงระดับโฆษณาพรีเมียม (เช่น น้ำหอม/สกินแคร์/ของใช้ส่วนตัว) เร็วและใช้ได้กับสินค้าเกือบทุกประเภท',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  'ตามสัดส่วนที่ต้องการ',
$$Ultra realistic commercial photography,
first person POV,
hand holding a real perfume body mist bottle close to camera,
product sharply focused,
cinematic depth of field,
extreme action lifestyle background,
high speed motion blur,
real skin texture,
natural fingers,
realistic spray particles,
professional advertising photography,
premium product marketing campaign,
Sony A1,
85mm lens,
f1.8,
HDR,
volumetric lighting,
global illumination,
ray tracing,
hyper realistic reflections,
ultra detailed textures,
8k resolution,
award winning commercial photography,
shallow depth of field,
natural sunlight,
photorealistic,
dynamic perspective,
perfect product visibility,
luxury brand advertisement,
high contrast,
cinematic color grading,
extremely realistic,
no CGI look,
no illustration,
no cartoon,
authentic photography

ตัวเสริมระดับ "Ads Agency" (ใส่ท้าย Prompt ทุกครั้ง):
captured by world class commercial photographer,
Nike campaign quality,
Apple keynote photography quality,
National Geographic realism,
cinematic storytelling,
viral social media advertising style,
authentic human emotion,
real environmental interaction,
micro details visible,
skin pores visible,
natural imperfections,
true-to-life lighting,
premium advertising composition,
photorealistic product placement$$,
  'สลับคำว่า "perfume body mist bottle" เป็นชื่อสินค้าจริงที่ถืออยู่ในมือได้ตามต้องการ — โครงสร้างคำ (keyword-style, comma-separated) ใช้ได้กับสินค้าเกือบทุกประเภทที่ถ่ายแบบ POV มือถือสินค้า',
  1
where not exists (select 1 from prompt_library where title = 'Master Prompt — POV มือถือสินค้า (ใช้กับทุกสถานการณ์)');


-- ============================================================
-- GROUP 5: Master Prompt — โกดังเมกาเซล (Warehouse Mega Sale)
-- ============================================================
-- NOTE: this exact prompt appeared TWICE verbatim in the source Google Doc
-- (once ~line 1119, again ~line 1867) — seeded once here, not duplicated.

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Master Prompt — โกดังเมกาเซล (Warehouse Mega Sale Banner)',
  'Master Prompt — Ultra Realistic Warehouse Mega Sale Canvas Banner + Mass Product Display',
  'ใช้ตอน: ต้องการภาพโปรโมชั่นสไตล์ "เคลียร์โกดัง/ลดราคาส่ง" — มีแบนเนอร์ผ้าใบห้อยจริง + กองสินค้าจำนวนมาก + พรีเซนเตอร์ยืนหน้าโกดัง เหมาะกับ TikTok Shop / Live Commerce',
  'Text-to-image (Nano Banana Pro, Midjourney) — ใช้ร่วมกับรูปสินค้าที่อัปโหลด',
  '9:16 แนวตั้ง',
$$MASTER PROMPT — ULTRA REALISTIC WAREHOUSE MEGA SALE CANVAS BANNER + MASS PRODUCT DISPLAY

[UPLOAD / INSERT PRODUCT REFERENCE IMAGE]
Use the uploaded product image as the main product reference.

━━━━━━━━━━━━━━━━━━
CORE CONCEPT
━━━━━━━━━━━━━━━━━━
Create an ultra photorealistic vertical 9:16 commercial advertising image inside a massive Thai warehouse / wholesale distribution center.

The scene must feel like:
"ของเยอะมาก" "ลดล้างสต็อก" "ขายส่ง" "ไลฟ์สดขายดี" "โกดังแตก" "ราคาถูกกว่าท้องตลาด"

The image features:
1. A huge real hanging vinyl canvas banner above.
2. Massive product stacks arranged in rows in the foreground.
3. A presenter / character standing behind the product display.
4. Warehouse racks full of boxes on both sides.
5. Strong Thai promotion artwork on the banner.

━━━━━━━━━━━━━━━━━━
[1] ASPECT RATIO / CAMERA
━━━━━━━━━━━━━━━━━━
Aspect Ratio: 9:16 vertical
Camera: eye-level to slightly low angle
Lens: 24mm wide-angle commercial photography
Composition: symmetrical central aisle warehouse perspective
Depth: deep warehouse vanishing point
Resolution: ultra detailed 8K HDR
Style: photorealistic TikTok Shop / live commerce / wholesale promo poster

The product display must fill the lower 50–60% of the image.
The hanging banner must fill the upper 35–45% of the image.
Presenter stands center-midground between banner and product stacks.

━━━━━━━━━━━━━━━━━━
[2] STRICT PRODUCT FIDELITY LOCK
━━━━━━━━━━━━━━━━━━
Use the uploaded product image as the exact source of truth.

Preserve: exact product shape, exact packaging color, exact label position, exact logo placement, exact typography layout, exact pouch / box / bottle / bag proportions, exact cap / zipper / seal / handle details, exact flavor / variant colors if visible, exact product front-facing angle

Do NOT: redesign the packaging, invent a new brand, change the logo, translate the label unless requested, simplify the product, make fake packaging, blur the logo, distort the product shape, rotate randomly, make products float unrealistically

If multiple product variants are uploaded, arrange all variants naturally as a product family.

━━━━━━━━━━━━━━━━━━
[3] MASS PRODUCT DISPLAY ENGINE
━━━━━━━━━━━━━━━━━━
Create a huge foreground display of the uploaded product.

Arrange the products in: many neat rows, stacked layers, front-facing hero rows, repeated inventory density, wholesale market abundance, visually satisfying organized chaos

Foreground: large products close to camera, sharp and detailed.
Mid-foreground: rows of products receding backward with slight perspective.
Background lower area: cardboard boxes, cartons, warehouse pallets, more product packs stacked behind the presenter.

Important: The products must look physically placed on tables, pallets, crates, and cartons. No floating products. No random cutout collage. No AI sticker look.

Product quantity must feel overwhelming but still clean and sellable.

━━━━━━━━━━━━━━━━━━
[4] HANGING CANVAS BANNER ENGINE
━━━━━━━━━━━━━━━━━━
Create a huge REAL physical hanging vinyl canvas banner suspended from the warehouse ceiling.

Banner must look: printed on glossy vinyl / canvas fabric, slightly wrinkled, heavy and physical, attached with steel hooks, ropes, cables, or chains, hanging naturally from ceiling beams, affected by gravity, not floating, not a digital overlay, not a billboard screen

Banner artwork should include the uploaded product image printed inside the banner design.
The product on the banner must be part of the printed artwork, not floating outside the banner.

━━━━━━━━━━━━━━━━━━
[5] BANNER LAYOUT
━━━━━━━━━━━━━━━━━━
Design the banner as a bold Thai wholesale promotion artwork.

Banner top section — Huge Thai headline: "ลดแหลก เคลียร์โกดัง"
Typography: ultra bold Thai display font, yellow / orange gradient letters, thick black shadow, red explosive background, high contrast, readable from far away

Banner middle section: Show uploaded product variants in a neat horizontal lineup. Use exact product images / packaging reference.
Product description text: "[PRODUCT NAME]" / "[KEY BENEFIT 1] • [KEY BENEFIT 2] • [KEY BENEFIT 3]"
Left promo badge: "x[QUANTITY]" / "[SIZE / VOLUME]" / "[PACK DETAILS]"
Bottom large price burst: "[PRICE] บาท"
Secondary promo text: "คุ้มกว่า!" "ราคาส่ง" "ยกโหล ยกลัง" "จำนวนจำกัด"

Banner color mood: red, yellow, blue, white, orange — Thai live-sale / discount-market aesthetic, bold, loud, readable, commercial

━━━━━━━━━━━━━━━━━━
[6] CHARACTER / PRESENTER ENGINE
━━━━━━━━━━━━━━━━━━
Place one presenter standing behind the foreground product stacks.

Character can be customized: [PRESENTER TYPE]
Examples: smiling Thai female presenter, energetic male livestream seller, mysterious masked seller, factory staff, cute creator, premium brand ambassador, warehouse owner, salesperson in polo uniform

Character details: standing center, smiling confidently, holding one product in hand, one hand presenting the product display, wearing brand-color polo shirt or uniform, visible ID card / lanyard optional, friendly live-commerce pose, realistic human skin, natural facial expression, clean grooming, commercial product presenter energy

Outfit: [PRESENTER OUTFIT]
Example: black polo shirt with small product logo, warehouse staff badge, neat hairstyle

Do NOT make the presenter cover too much product. Presenter should support the sale, not dominate the image.

━━━━━━━━━━━━━━━━━━
[7] WAREHOUSE ENVIRONMENT
━━━━━━━━━━━━━━━━━━
Location: Massive industrial warehouse / Thai wholesale stockroom.

Background: tall pallet racks on both left and right sides, cardboard boxes stacked high, warehouse ceiling beams, LED industrial lights, long aisle perspective, pallets, crates, cartons, forklifts optional, workers optional but subtle

Lighting: bright industrial LED overhead lighting, realistic reflections on product packaging, cinematic but not too dark, clear product visibility, high depth of field, slight commercial glow

Mood: busy, abundant, realistic, wholesale, trusted, high-stock, live-selling atmosphere.

━━━━━━━━━━━━━━━━━━
[8] PROMOTIONAL TEXT VARIABLES
━━━━━━━━━━━━━━━━━━
Replace these fields based on uploaded product info:
[MAIN HEADLINE] = ลดแหลก เคลียร์โกดัง
[PRODUCT NAME] = ชื่อสินค้า
[PRODUCT BENEFIT] = จุดเด่นสินค้า
[QUANTITY] = จำนวนชิ้น / แพ็ก
[SIZE] = ขนาดสินค้า
[PRICE] = ราคา
[DISCOUNT CLAIM] = ลดสูงสุด / โปรแรง / ราคาส่ง
[CTA] = สั่งเลย / ทักแชท / พิมพ์ "โปร"

Suggested Thai promo copy: "ลดแหลก เคลียร์โกดัง" "โปรแรงเฉพาะไลฟ์" "ราคาส่ง ยกโหล ยกลัง" "ของแท้ พร้อมส่ง" "คุ้มกว่าซื้อปลีก" "จำนวนจำกัด"

━━━━━━━━━━━━━━━━━━
[9] VISUAL HIERARCHY
━━━━━━━━━━━━━━━━━━
Most important: 1. Giant discount headline on banner 2. Price burst 3. Uploaded product displayed clearly 4. Massive product abundance 5. Presenter credibility 6. Warehouse stock atmosphere

The viewer must instantly understand: what product is being sold, what the promotion is, how much it costs, that stock quantity is huge, that this is a warehouse clearance sale

━━━━━━━━━━━━━━━━━━
[10] REALISM RULES
━━━━━━━━━━━━━━━━━━
Make everything physically believable.
Required: realistic product shadows, contact shadows under products, correct scale between product and presenter, banner attached to ceiling, printed artwork follows fabric folds, warehouse perspective consistent, products aligned with table / pallet surfaces, no floating labels, no impossible reflections, no warped Thai text, no messy unreadable composition

━━━━━━━━━━━━━━━━━━
[11] OPTIONAL ADD-ONS
━━━━━━━━━━━━━━━━━━
Optional elements: QR code placeholder on banner, small "ราคา ณ วันที่ [DATE]" bottom-left, livestream sticker "LIVE SALE", stock counter badge, "ขายส่ง" badge, "ส่งฟรี" badge, "พร้อมส่งจากโกดัง" label, product cartons printed with brand logo, small workers arranging boxes in background, camera / phone livestream setup in corner

━━━━━━━━━━━━━━━━━━
[12] NEGATIVE PROMPT
━━━━━━━━━━━━━━━━━━
Avoid: cartoon, illustration, anime, 3D toy look, fake package, wrong logo, distorted label, unreadable Thai text, floating products, products outside banner, digital hologram sign, low resolution, blurry product, messy layout, overexposed, underexposed, incorrect perspective, extra fingers, deformed face, duplicate face, unnatural hands, plastic skin, random invented brand, wrong product color, wrong packaging shape, badly warped typography, banner not attached to ceiling, product sticker collage, AI artifact, watermark

━━━━━━━━━━━━━━━━━━
FINAL OUTPUT
━━━━━━━━━━━━━━━━━━
Ultra photorealistic commercial warehouse clearance sale poster, vertical 9:16, massive uploaded product stacks in foreground, smiling presenter holding product, huge real hanging vinyl canvas banner above with product artwork and Thai promotional price, busy warehouse racks full of cartons, bright industrial lighting, high-detail 8K HDR, professional TikTok Shop wholesale advertising photography.$$,
  'ต้นฉบับใน Google Doc มี prompt นี้ซ้ำกันเป๊ะ 2 รอบ (คนละ tab) — เก็บเข้าระบบแค่ครั้งเดียวเพื่อไม่ให้ซ้ำซ้อน เนื้อหาเหมือนกันทุกตัวอักษร',
  1
where not exists (select 1 from prompt_library where title = 'Master Prompt — Ultra Realistic Warehouse Mega Sale Canvas Banner + Mass Product Display');


-- ============================================================
-- GROUP 6: Master Prompt — TikTok Shop Industrial UGC Ad Engine
-- ============================================================

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Master Prompt — TikTok Shop Industrial UGC Ad Engine',
  'Master Prompt — TikTok Shop Industrial UGC Ad Engine (Ultra Premium AI Advertising System)',
  'ใช้ตอน: ต้องการภาพโฆษณา TikTok Shop ที่ดูน่าเชื่อถือระดับ "มีโรงงานจริงรองรับ" — มีครีเอเตอร์ถือสินค้า + ฉากโรงงาน/สายพานที่ปรับตามประเภทสินค้าอัตโนมัติ',
  'Text-to-image (ChatGPT/Nano Banana Pro/Midjourney) — ใส่รูปคน + รูปสินค้า (ถ้าไม่ใส่รูป ระบบจะ random ให้)',
  '9:16 แนวตั้ง',
$$MASTER PROMPT — TIKTOK SHOP INDUSTRIAL UGC AD ENGINE
Ultra Premium AI Advertising System

เอา PROMPT ด้านล่าง + รูปคน + รุปสินค้า (ถ้าไม่ใส่ รูป ระบบจะ random ให้)
ไปใส่ใน CHATGPT เพื่อทำภาพได้เลย
สามารถปรับได้ตามใจชอบ

Create a hyper-realistic TikTok Shop advertising artwork in vertical 9:16 format.
CORE OBJECTIVE:
Generate a premium viral TikTok Shop advertisement that feels like:
real commercial photography, cinematic creator content, factory-backed trustworthy product brand, high-converting TikTok Shop ad, ultra premium industrial production advertisement
The final image must emotionally trigger:
"สินค้าดูดี" "ดูน่าเชื่อถือ" "โรงงานจริง" "คุณภาพดี" "อยากกดตะกร้าทันที"

━━━━━━━━━━━━━━━━━━
[1] AUTO PRODUCT ANALYSIS ENGINE
━━━━━━━━━━━━━━━━━━
Analyze the uploaded product image and product information automatically.
Extract and preserve: product type, packaging structure, material texture, logo, typography, color palette, bottle/jar/box/pouch structure, branding style, product category, premium level, intended audience, emotional tone, creator economy style, TikTok visual language
AUTO DETECT: skincare, supplement, gadget, apparel, shoes, cosmetics, electronics, household products, snacks, beverages, luxury items, mass market items

━━━━━━━━━━━━━━━━━━
[2] STRICT PRODUCT FIDELITY LOCK
━━━━━━━━━━━━━━━━━━
ABSOLUTE RULE: The uploaded product is the ONLY valid product reference.
MANDATORY: preserve exact product design, preserve exact logo placement, preserve exact packaging shape, preserve exact typography, preserve exact cap/lid shape, preserve exact colors, preserve exact material finish, preserve exact label layout, preserve exact proportions, preserve exact dimensions, preserve exact branding identity
FORBIDDEN: redesigning package, generating fake logos, changing packaging, adding random branding, mixing multiple products, altering shape, oversizing product, distorted packaging, floating products, fake labels, wrong color tones
The product must feel: REAL. PHOTOGRAPHED. TRUSTWORTHY. FACTORY VERIFIED.

━━━━━━━━━━━━━━━━━━
[3] SMART FACTORY WORLD GENERATOR
━━━━━━━━━━━━━━━━━━
Generate a cinematic industrial environment that MATCHES the uploaded product category automatically.
EXAMPLES:
Skincare → cosmetic clean-room production line / white laboratory factory / premium beauty manufacturing facility
Supplements → pharmaceutical-inspired production line / sterile packaging factory / premium nutraceutical warehouse
Fashion → garment factory / textile conveyor line / apparel fulfillment center
Shoes → footwear assembly line / industrial shoe production factory
Electronics → futuristic gadget assembly plant / robotic electronics production line
Food → premium food processing factory / industrial snack conveyor system
Household Products → warehouse logistics conveyor system
ENVIRONMENT REQUIREMENTS: conveyor belt production line, industrial warehouse atmosphere, automated machinery, factory workers, packaging stations, realistic logistics, cinematic production depth, premium industrial realism, believable manufacturing workflow

━━━━━━━━━━━━━━━━━━
[4] CREATOR / UGC CHARACTER ENGINE
━━━━━━━━━━━━━━━━━━
Generate a realistic TikTok creator / influencer.
The creator must feel: attractive but believable, trustworthy, premium, TikTok-native, natural, confident, expressive, commercial-ready
MANDATORY: realistic skin pores, natural eyes, realistic fingers, believable hand grip, natural facial asymmetry, modern hairstyle, fashion-forward clothing, expressive body language, creator-energy posing
The creator MUST: hold the product naturally, point at product features, interact with conveyor environment, feel like real TikTok UGC, not look like stock photography

━━━━━━━━━━━━━━━━━━
[5] TIKTOK VIRAL COMPOSITION SYSTEM
━━━━━━━━━━━━━━━━━━
IMAGE GOAL: Instantly stop scrolling.
Composition rules: creator in foreground, product visible within first glance, conveyor line adds depth, factory perspective creates scale, strong visual hierarchy, mobile-first readability, emotional product focus
FRAME STRUCTURE:
TOP: big viral headline
CENTER: creator + product
BACKGROUND: factory conveyor line
BOTTOM: CTA + trust icons
Visual flow: Headline → Product → Conveyor → CTA

━━━━━━━━━━━━━━━━━━
[6] THAI TYPOGRAPHY ENGINE
━━━━━━━━━━━━━━━━━━
Generate readable Thai promotional typography.
STYLE: ultra bold Thai display font, TikTok style headline, high contrast, mobile optimized, safe area optimized, premium glow edge, readable even on small screens
MANDATORY: no text overflow, no unreadable Thai, no stretched text, no typo artifacts, no overlapping product
TEXT LAYOUT:
Main headline: "ของดีใน TikTok"
Secondary CTA: "กดตะกร้าก่อนหมดโปร"
Trust text: "สินค้ามาตรฐานโรงงาน • พร้อมส่ง"
Optional: free shipping, TikTok special deal, limited stock, creator recommended

━━━━━━━━━━━━━━━━━━
[7] CINEMATIC LIGHTING SYSTEM
━━━━━━━━━━━━━━━━━━
Lighting style: industrial cinematic lighting, realistic LED reflections, soft volumetric atmosphere, subtle rim light, realistic warehouse shadows, premium commercial photography lighting, soft skin highlights, realistic metallic reflections, glossy package highlights
CAMERA STYLE: cinematic medium shot, shallow depth of field, 35mm commercial photography, handheld creator realism, realistic lens compression, premium HDR rendering

━━━━━━━━━━━━━━━━━━
[8] REALISTIC SCALE LOCK SYSTEM
━━━━━━━━━━━━━━━━━━
ABSOLUTE SCALE RULES: The product MUST appear realistic in size relative to hands, body, conveyor belt, environment
MANDATORY: realistic proportions, realistic perspective, accurate scale, no oversized product effect, no giant product illusion, no distorted camera angle
APPEND THIS TO ALL RENDERS: "realistic scale, true size, no exaggeration, no distortion" "accurate proportions, no forced perspective" "realistic product dimensions" "scale matched to human anatomy" "no oversized packaging" "realistic commercial photography proportions"

━━━━━━━━━━━━━━━━━━
[9] TRUST SIGNAL SYSTEM
━━━━━━━━━━━━━━━━━━
Add believable trust elements: workers inspecting products, conveyor belt workflow, packaging stations, logistics movement, warehouse shelves, shipping boxes, quality control process, industrial organization, realistic manufacturing operations
The viewer should subconsciously think: "แบรนด์นี้ดูมีมาตรฐาน" "ดูผลิตจริง" "ดูส่งจริง" "ดูมีโรงงานรองรับ"

━━━━━━━━━━━━━━━━━━
[10] TIKTOK SHOP CONVERSION ENGINE
━━━━━━━━━━━━━━━━━━
The image must feel optimized for: TikTok Shop, impulse buying, creator economy, mobile commerce, viral creator ads, short attention spans
Must visually communicate within 1 second: what product is, why it looks trustworthy, why it feels premium, why people should buy now

━━━━━━━━━━━━━━━━━━
[11] ULTRA REALISM ENGINE
━━━━━━━━━━━━━━━━━━
MANDATORY: ultra realistic, commercial quality, realistic skin, realistic hands, realistic product materials, realistic reflections, realistic typography, realistic packaging, realistic warehouse depth, cinematic realism, HDR quality, premium advertising quality, believable human anatomy, believable factory environment
QUALITY TARGET: Nike campaign realism, Apple commercial realism, TikTok Shop top-spending ad quality, High-end Asian commercial photography, Premium creator economy advertising

━━━━━━━━━━━━━━━━━━
[12] NEGATIVE PROMPT SYSTEM
━━━━━━━━━━━━━━━━━━
NEGATIVE PROMPT: low quality, blurry, bad anatomy, bad hands, extra fingers, wrong packaging, fake logo, oversized product, distorted proportions, floating products, fake typography, text overflow, incorrect Thai text, cartoon rendering, cgi toy look, plastic skin, unrealistic lighting, deformed face, warped conveyor belt, oversaturated image, fake shadows, duplicate products, wrong scale, exaggerated perspective, bad composition, fake warehouse, cheap advertisement style, before-after claim, medical claim, misleading advertising, policy violation, clickbait scam vibe

━━━━━━━━━━━━━━━━━━
[13] FINAL RENDER STYLE
━━━━━━━━━━━━━━━━━━
FORMAT: Vertical 9:16
STYLE: Ultra realistic, Industrial cinematic, Premium TikTok Shop advertising, Commercial photography, Creator economy aesthetic, Factory-backed trust visual, Viral mobile advertising style
QUALITY: 8K, HDR, Sharp details, Commercial grade, Photorealistic, Cinematic, Premium advertising realism$$,
  'ใส่รูปคน + รูปสินค้าไปด้วย — ถ้าไม่ใส่รูปคน ระบบจะสุ่มครีเอเตอร์ให้เอง ฉากโรงงานจะปรับอัตโนมัติตามหมวดสินค้าที่อัปโหลด',
  1
where not exists (select 1 from prompt_library where title = 'Master Prompt — TikTok Shop Industrial UGC Ad Engine (Ultra Premium AI Advertising System)');


-- ============================================================
-- GROUP 7: PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)
-- ============================================================

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'โรงงานชุดกันฝน — คนพับใส่ถุง (เวอร์ชัน 1)',
  'ภาพ+วิดีโอโรงงานผลิตเสื้อกันฝน มีพนักงานพับใส่ถุงพลาสติกที่สายพาน',
  'Text-to-image + Image-to-video',
  '9:16',
$$prompt รูปภาพ:
An industrial factory setting. Above, multiple rows of finished, colorful hooded raincoats (yellow, pink, blue) hang neatly on displayed racks. Below, a moving green conveyor belt is staffed by three female workers in pink, yellow, and purple raincoats respectively, diligently folding and placing new colorful raincoats into clear plastic bags. The background features tall, well-stocked shelving units with blue metal frames, holding boxes and packaged goods. Bright industrial fluorescent lighting illuminates the entire scene, with visible overhead lights.

prompt วิดีโอ:
8-second video. Thai garment factory. Camera fixed at belt end.
Navy blue raincoats in clear plastic bags travel toward camera in 3 rows,
steady continuous pace. Belt fully loaded at all times.
Same products throughout—no swapping. Thai workers (men and women,
white hair nets, navy uniforms) stand at belt sides, picking bags
into boxes rhythmically. Huge stock shelves in background.
Thai female voiceover: "ผลิตเอง ขายเอง ราคานี้มีแค่ที่นี่ สั่งได้เลยค่ะ"
Factory ambient sound. 9:16 vertical.$$,
  'สลับสินค้า/สี/เสียงพากย์ให้ตรงกับสินค้าจริงที่มี',
  1
where not exists (select 1 from prompt_library where title = 'โรงงานชุดกันฝน — คนพับใส่ถุง (เวอร์ชัน 1)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'โรงงานชุดกันฝน — คนพับใส่ถุง (เวอร์ชัน 2, มุมสูง)',
  'ภาพ+วิดีโอโรงงานผลิตเสื้อกันฝน มุมกล้องสูง (high-angle) เน้นเครื่องซีลถุงร้อน',
  'Text-to-image + Image-to-video',
  '9:16',
$$prompt รูปภาพ:
The lower half of the video shows a high-angle shot of a factory workstation. A lots of female workers, dressed in translucent purple and blue raincoats, are efficiently folding bright-colored raincoats (yellow, pink, blue) and sealing them into clear plastic bags using a heat-sealing machine. Their movements are natural, rhythmic, and continuous.
Environment & Lighting:
The background consists of a massive warehouse with towering blue industrial shelving units packed with organized stacks of colorful inventory. The lighting is bright, even, and industrial (fluorescent style), ensuring all product colors are vibrant and saturated.
Camera & Technical:
Static camera position with a slight cinematic depth of field to keep the focus on the workers and products. The video has a clean, Sharp details, consistent lighting, and fluid human motion.
9:16 ar

prompt วิดีโอ:
The background consists of a massive warehouse with towering blue industrial shelving units packed with organized stacks of colorful inventory. The lighting is bright, even, and industrial (fluorescent style), ensuring all product colors are vibrant and saturated.
Camera & Technical:
Static camera position with a slight cinematic depth of field to keep the focus on the workers and products. The video has a clean, high-definition 'live-stream' aesthetic with realistic physics for the folding of the thin EVA material. Sharp details, consistent lighting, and fluid human motion.$$,
  'เวอร์ชันนี้เน้นมุมสูง (high-angle) และเครื่องซีลถุงร้อน ต่างจากเวอร์ชัน 1 ที่เป็นมุมระดับสายตา',
  2
where not exists (select 1 from prompt_library where title = 'โรงงานชุดกันฝน — คนพับใส่ถุง (เวอร์ชัน 2, มุมสูง)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'โกดังเคลียร์สต๊อก 1 บาท — ฝูงชนแย่งซื้อ',
  'ภาพ+วิดีโอสารคดี โกดังเคลียร์สต๊อกสินค้าเบ็ดเตล็ดราคา 1 บาท มีลูกค้าแน่นโกดัง',
  'Text-to-image + Image-to-video',
  '9:16',
$$prompt รูป:
An ultra-realistic, wide-angle documentary photograph capturing the chaotic and crowded atmosphere inside a vast, unorganized clearance warehouse, based on image_0.png. The space is overflowing with a massive, jumbled variety of miscellaneous household items, electronics, toys, and packaged goods piled messily into bins, crates, and over cardboard boxes, rather than neat shelves. Above the main area, a massive yellow banner hangs from the ceiling trusses with large red and black Thai text (exactly matching image_0.png) that reads: 'ด่วน! สินค้าเบ็ดเตล็ดลดราคาเริ่มต้น 1 บาท ส่งฟรี ทั่วไทย' with a 'FREE' graphic. Dozens of customers, varied in age and dressed casually, are packed tightly into the narrow aisles, 'rum-ming' (crowding and jostling) around the messiest piles. Their faces show focus and excitement as they sift through items. Multiple small, crude, hand-written-style price signs on stakes or taped to boxes are scattered everywhere among the goods, reading 'ลดราคา 1 บาท' in messy Thai script. One woman in a white t-shirt and another in red are deep in the foreground crowd, hands deep in piles of goods. The floor is cluttered with fallen items, cardboard, and feet. The overall look is gritty, raw, and full of dense movement, lit by harsh industrial fluorescents. The text on the signs is accurate and visible.

prompt วิดีโอ:
A highly realistic, documentary-style video sequence based on image_0.png. The scene is a bustling, crowded indoor warehouse liquidation sale in Thailand. Hundreds of shoppers are densely packed into the space, rummaging through overflowing plastic bins and cardboard boxes of miscellaneous goods.$$,
  'ต้นฉบับอ้างอิง "image_0.png" ซึ่งเป็นภาพต้นทางที่ผู้ใช้แนบไว้ในเอกสาร Google Doc — เวลานำไปใช้จริงให้แนบรูปอ้างอิงของตัวเองแทน',
  3
where not exists (select 1 from prompt_library where title = 'โกดังเคลียร์สต๊อก 1 บาท — ฝูงชนแย่งซื้อ');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'สายพานโรงงาน + แบนเนอร์ราคาพิเศษ (Template ปรับสินค้าได้)',
  'ภาพ+วิดีโอสายพานโรงงานทั่วไป พนักงานใส่ชุดเซฟตี้ แบนเนอร์แดง-เหลืองราคาพิเศษห้อยจากเพดาน — ปรับใช้ได้กับสินค้าเกือบทุกประเภท',
  'Text-to-image + Image-to-video',
  '9:16',
$$prompt รูปภาพ:
A realistic photography of a busy industrial warehouse interior. A long conveyor belt runs straight down the center towards the camera. Workers wearing white hard hats, face masks, and orange high-visibility safety vests are standing along both sides of the belt, actively packing [ใส่ลักษณะสินค้าของคุณตรงนี้ เช่น สินค้าเป็นทิชชู่ตามรูปที่ให้ไป]. Above the conveyor belt, a large bright red vinyl banner hangs from the metal ceiling structure with bold yellow text that says "[ราคาพิเศษ เช่น FLASH SALE 81.-]". Tall warehouse shelving units filled with stacked boxes are visible in the background. Bright overhead industrial lighting, wide-angle lens, symmetrical composition, deep depth of field, 8k, photorealistic

prompt วิดีโอ:
A highly realistic cinematic video shot inside a busy industrial warehouse. A continuous conveyor belt moves directly towards the camera, carrying a steady stream of [ใส่ลักษณะสินค้าของคุณตรงนี้ เช่น small rectangular skincare boxes]. Workers wearing white hard hats and orange safety vests are stationed on both sides, their hands actively moving as they pack and inspect the items on the moving belt. A large red banner with bold yellow text "[ราคาพิเศษ 81.-บาท]" hangs motionlessly from the ceiling above. The camera is completely static, acting as a fixed viewpoint. Bright warehouse lighting, realistic motion, continuous workflow.$$,
  'Template นี้มีช่องให้กรอก [ใส่ลักษณะสินค้าของคุณตรงนี้...] และ [ราคาพิเศษ...] เอง — ใช้ได้กว้างกว่าเวอร์ชันสินค้าเฉพาะเจาะจงอื่นๆ ในกลุ่มนี้',
  4
where not exists (select 1 from prompt_library where title = 'สายพานโรงงาน + แบนเนอร์ราคาพิเศษ (Template ปรับสินค้าได้)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'โรงงานรองเท้าแตะ — สายพานคู่ขนาน',
  'ภาพ+วิดีโอโรงงานผลิตรองเท้าแตะอัตโนมัติ สายพาน 2 เส้นคู่ขนาน สีต่างกัน',
  'Text-to-image + Image-to-video',
  '9:16',
$$prompt รูปภาพ:
A photorealistic, highly detailed wide-angle shot of a modern, highly automated shoe manufacturing factory. A remarkably long, straight conveyor belt runs directly down the center of the frame, receding into the background with perfect symmetrical perspective. On the conveyor belt, hundreds of modern slide sandals are neatly aligned in two parallel rows, featuring alternating colors like crisp white, navy blue, and beige, with graphic text logos on the footbeds. Factory workers wearing neat two-tone beige and dark grey polo shirt uniforms are stationed along both sides of the line, focused on assembling and inspecting the footwear. High-tech automated robotic arms and precision machinery are actively operating over the conveyor belt. Computer monitors display production data at various workstations. The environment is impeccably clean and brightly lit with cool white industrial overhead lighting. Cinematic depth of field, sharp focus on the foreground sandals blending into a soft blur in the deep background, hyper-realistic, 8k resolution, commercial industrial photography. --ar 9:16 (สินค้าบนสายพานตามรูปที่ให้ไป ฝั่งซ้ายสีตามรูป ฝั่งขวาสีขาว)

prompt วิดีโอ:
A hyper-realistic video of a modern, brightly lit shoe factory assembly line. Two parallel conveyor belts flow continuously and smoothly towards the camera at a steady pace. The left belt is completely filled with a continuous stream of brown slide sandals, and the right belt is completely filled with white slide sandals, with absolutely no empty spaces or gaps between the items. Workers in beige and grey uniforms stand along the sides of the belts. The workers are actively typing on computer keyboards, inspecting monitors, and operating control panels, keeping their hands completely away from the moving shoes. Robotic arms operate smoothly in the background. Cinematic lighting, steady camera, 4k resolution, realistic motion.$$,
  'ปรับสีสินค้าฝั่งซ้าย/ขวาของสายพานให้ตรงกับสินค้าจริงที่มี',
  5
where not exists (select 1 from prompt_library where title = 'โรงงานรองเท้าแตะ — สายพานคู่ขนาน');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'สวนทุเรียน — สายพานปลายทาง POV',
  'ภาพ+วิดีโอสวน/โรงคัดบรรจุทุเรียน มุมกล้อง POV ปลายสายพาน มองเห็นสวนทุเรียนด้านหลัง',
  'Text-to-image + Image-to-video',
  '9:16',
$$prompt รูปภาพ:
[PRODUCT REFERENCE IMAGE ATTACHED]
Preserve exact shape, color, texture 100%. Do not redesign.
Ultra photorealistic 8K HDR. Large warehouse sorting facility, not studio.
No CGI, no 3D render, no cartoon, no AI glow. Sharp focus throughout.
CAMERA — END-OF-BELT POV:
Camera at receiving end of conveyor belt, eye-level 80–100cm height.
Looking straight down belt axis toward far background — vanishing point at frame center.
Background features giant open warehouse doors revealing a lush green durian orchard outside.
Belt runs from foreground directly toward background. Slight upward tilt 5–10°.
NOT a side view. NOT diagonal. Camera at END of belt looking toward product SOURCE.
CONVEYOR BELT:
Dark navy blue rubber industrial belt, centered in frame, running toward background.
Belt 100% loaded — products cover entire length.
PRODUCTS — WHOLE DURIANS:
Large, spiky whole durians, green and brown rind. Identical to reference.
True-to-life scale. 2 rows, traveling toward camera — products at foreground largest.
Tightly packed. Minimum 20 units visible. Sit flat on belt. Zero floating.
WORKERS — THAI ONLY:
Thai orchard farmers, warm brown-golden skin, wearing wide-brimmed gardening hats, long-sleeved shirts, cloth gloves.
Standing at belt sides, watching products. Face visible. Eyes on belt.
FACTORY: Large spacious warehouse, high ceiling, natural daylight from outside mixed with warm warehouse lights. Concrete floor.
Depth of field: foreground sharp, background progressively softer showing durian trees.
NO price tag. NO promotional sign. NO side view.
Negative: CGI render, price tag, diagonal belt, studio background, non-Thai workers, horizontal format.
ASPECT RATIO: 9:16. (เพิ่มพวกลังใส่ทุเรียนข้างหลังคน มีรถจอด ทำให้ดูมีอะไร)

prompt วิดีโอ:
A cinematic, highly detailed video of a fruit packing facility. A central blue conveyor belt flows continuously forward toward the camera, carrying two neat rows of large, spiky green durians. Agricultural workers standing on both sides of the belt, wearing woven straw hats, long-sleeved shirts, and gloves, are actively working. The workers rhythmically pick up the durians from the moving belt, turn around, and carefully place them into the stacked wooden crates and plastic baskets located right behind them. The background reveals an open warehouse door looking out onto a lush tropical orchard with a parked pickup truck. Natural daylight, realistic human motion, smooth continuous movement, 4k, photorealistic.$$,
  'ต้องแนบรูปสินค้าอ้างอิงจริง (ทุเรียนหรือผลไม้อื่น) ก่อนใช้ — โครงกล้อง POV ปลายสายพานนี้ใช้แทนสินค้าเกษตร/ผลไม้อื่นได้',
  6
where not exists (select 1 from prompt_library where title = 'สวนทุเรียน — สายพานปลายทาง POV');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'PROMPT UGC + สายพานโรงงาน (ตัวอย่างจากภาพอัปโหลด)',
  'ตลาดขายส่งของเยอะ (Template — ปรับ [PRODUCT TYPE] ได้)',
  'ภาพตลาดขายส่ง/โกดังที่มีสินค้าล้นเต็มพื้นที่ สื่อความ "ตลาดแตก ของเยอะมาก ขายส่ง" — ใช้ template ปรับ [PRODUCT TYPE] เพื่อประยุกต์กับสินค้าอะไรก็ได้',
  'Text-to-image (Nano Banana Pro, Midjourney)',
  '9:16',
$$ทำภาพ: Create an ultra photorealistic cinematic wholesale market scene where massive amounts of [PRODUCT TYPE] completely fill the environment in an overwhelming abundance style.

A gigantic Thai wholesale distribution warehouse packed wall-to-wall with [PRODUCT TYPE].

Foreground: huge overflowing stacks of [PRODUCT TYPE] in cartons, baskets, crates, plastic sacks, and warehouse pallets.

Midground: Thai workers actively sorting, packing, sealing boxes, weighing products, moving inventory carts, livestream selling atmosphere.

Background: industrial warehouse structure, steel roof, fluorescent lights, forklifts, logistics aisles, delivery trucks, hanging promotional banners.

MANDATORY:
The products dominate almost the entire frame visually.
Extreme product repetition and inventory density.
The viewer must instantly feel:
"ตลาดแตก" "ของเยอะมาก" "ขายโหดมาก" "ราคาส่ง"

Include a giant REAL hanging vinyl promotional banner suspended using steel hooks and cables.

Banner text: "โปรแรง" "ราคาส่ง" "ส่งฟรี" "ลดล้างสต๊อก"

Banner must look:
- physically printed
- slightly wrinkled
- realistic$$,
  'Template นี้ทั่วไปที่สุดในกลุ่ม — แค่แทนที่ [PRODUCT TYPE] ทุกจุดด้วยสินค้าจริง ก็ใช้ได้กับสินค้าเกือบทุกประเภทที่ต้องการภาพ "ของเยอะเต็มโกดัง"',
  7
where not exists (select 1 from prompt_library where title = 'ตลาดขายส่งของเยอะ (Template — ปรับ [PRODUCT TYPE] ได้)');
