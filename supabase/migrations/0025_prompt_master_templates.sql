-- Prompt Master templates — explicit user request after seeing the Korean-
-- drama worked example seeded in 0024: "ฉันไม่ต้องการให้เหมือนเขา ทำเป็น Prompt
-- Master สำหรับแก้ไขตัวละครเอาเองได้ไหม". The 0024 rows are a fixed worked
-- example (JI-HOON/YU-JIN/SEO-A, no [ ] slots — it's a reference, not a
-- template). These two new rows extract the underlying STRUCTURE from that
-- example into a reusable, genre-agnostic master template with real [ ]
-- slots, so the user can plug in their own characters/story instead of
-- reusing someone else's. Purely additive — the 0024 rows are left
-- untouched as a worked reference alongside these.

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Prompt Master — โครงสร้างสำเร็จรูป (แก้ตัวละคร/เนื้อเรื่องเองได้)',
  'Prompt Master — Character Reference Sheet',
  'ใช้ตอน: จะสร้างภาพอ้างอิงตัวละครของคุณเอง (คนไหนก็ได้ เรื่องไหนก็ได้) ให้หน้า/ชุดคงที่ทุกช็อตก่อนเริ่มทำวิดีโอ',
  'Nano Banana Pro (text2image) หรือเครื่องมือ text2image ที่รองรับ multi-view ในภาพเดียว',
  '16:9 · 2K',
$$Professional character reference sheet for [GENRE/STYLE, e.g. Korean drama / Thai lakorn / modern commercial / K-pop MV], photorealistic cinematic style, clean light-grey studio background. Character: [CHARACTER NAME], [NATIONALITY/ETHNICITY] [gender], age [AGE], [ROLE/OCCUPATION/PERSONALITY IN ONE SHORT PHRASE], [BUILD], [HAIR DESCRIPTION], [FACE DESCRIPTION — e.g. kind but tired face, light stubble / bright round eyes]. OUTFIT A ([SCENE/CONTEXT A]): [OUTFIT A DESCRIPTION — colors, style, fabric, any logo/brand restriction such as "absolutely NO logos, NO text, NO brand marks"]. OUTFIT B ([SCENE/CONTEXT B, optional — leave blank if only one outfit needed]): [OUTFIT B DESCRIPTION]. Props: [PROPS IF ANY, e.g. holding a helmet / a piggy bank / a phone]. Layout: left side full-body front, side and back views in OUTFIT A; center one full-body front view in OUTFIT B (skip if no Outfit B); right side a row of 4 close-up facial expressions labeled: [EXPRESSION 1], [EXPRESSION 2], [EXPRESSION 3], [EXPRESSION 4]. Consistent face across all views, soft even studio lighting, [STYLE REFERENCE, e.g. K-drama film look / bright commercial look] , sharp detail, small clean label text '[CHARACTER NAME]' at the top.$$,
  'เคล็ดลับ: ทำ Character Sheet แยกทีละตัวละคร (พระเอก/นางเอก/ตัวประกอบ) แล้วอ้างอิงกลับด้วย @image1, @image2, ... ในขั้นตอน Shot-by-Shot ด้านล่าง — วิธีนี้คือสิ่งที่ทำให้หน้าตัวละครเหมือนกันทุกช็อตของวิดีโอ',
  1
where not exists (select 1 from prompt_library where title = 'Prompt Master — Character Reference Sheet');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, notes, sort_order)
select
  'Prompt Master — โครงสร้างสำเร็จรูป (แก้ตัวละคร/เนื้อเรื่องเองได้)',
  'Prompt Master — Shot-by-Shot Video Prompt',
  'ใช้ตอน: มี Character Reference Sheet ของตัวละคร (จาก Prompt Master ด้านบน) แล้ว และต้องการสั่งสร้างวิดีโอต่อเนื่องเป็นช็อตๆ พร้อมบทพูด',
  'Seedance 2.5 (element2video) หรือเครื่องมือ image2video ที่รับภาพอ้างอิงหลายภาพต่อ 1 prompt',
  '9:16 · 480p · ปรับตามความยาวที่ต้องการ',
$$FORMAT: [DURATION] seconds / [NUMBER] CUTS / [GENRE/MOOD, e.g. family melodrama, tense to heartbreaking / comedy, light and fast] / dialogue in [LANGUAGE], [AMBIENT SOUND STYLE], [NO MUSIC หรือใส่แนวเพลงที่ต้องการ]

STYLE: [CAMERA STYLE, e.g. Cinematic realist, simulating IMAX film camera, Panavision C-series lens, 35mm focal length, f/4]. [COLOR GRADE, e.g. Low saturation, deep blue-black dominant tone, moderate film grain / bright warm commercial grade]. [CAMERA MOVEMENT STYLE, e.g. Handheld throughout, subtle natural camera shake; camera movement intensity follows emotional intensity]. [ASPECT RATIO]. NO TEXT ON SCREEN.

SUBJECT 1: [CHARACTER NAME] @image1 — [SHORT DESCRIPTION MATCHING THE CHARACTER SHEET — key face/outfit details only, not the full sheet]
SUBJECT 2: [CHARACTER NAME 2] @image2 — [SHORT DESCRIPTION] (ลบบรรทัดนี้ถ้าช็อตนี้มีตัวละครเดียว, หรือเพิ่ม SUBJECT 3/4 ถ้ามีมากกว่า 2 คน)

ENVIRONMENT: [LOCATION], [TIME OF DAY], [LIGHTING DETAILS — e.g. single warm bulb, blue window spill, rain streaks on glass]

AUDIO: [AMBIENT SOUND DETAILS — e.g. heavy rain, traffic hum, kitchen sounds, footsteps]

TIMELINE:
0:00–0:0[X]: [SHOT TYPE, e.g. Close-up / Handheld medium / Wide] — [ACTION DESCRIPTION]. [Character name] says ([EMOTION/TONE]): "[DIALOGUE LINE]"
0:0[X]–0:0[Y]: [ต่อช็อตถัดไปแบบเดียวกัน ระบุ action + dialogue ต่อเนื่องกันจนครบ DURATION ที่ตั้งไว้ด้านบน — เว้นบรรทัดว่างไว้เพิ่มได้ตามจำนวนช็อตย่อยที่ต้องการ]$$,
  'เคล็ดลับ: เขียน TIMELINE ให้เวลาต่อเนื่องกันไม่มีช่องว่าง (0:00–0:04 ต่อด้วย 0:04–0:08 ...) และให้รวมกันได้พอดีกับ DURATION ที่ระบุใน FORMAT ด้านบน ไม่งั้นโมเดลจะเดาเติมช่วงที่ขาดเอง',
  2
where not exists (select 1 from prompt_library where title = 'Prompt Master — Shot-by-Shot Video Prompt');
