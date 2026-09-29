-- Prompt Library — new standalone tool, explicit user request: "อยากเก็บเป็น
-- คลังความรู้ไว้ เพื่อใช้ในอนาคต หรือปรับใช้ปรับแต่งจากเดิม หรือจะเป็นโหมดเรียกใช้
-- แยกต่างหากเลย" (user chose "สร้างเป็นหน้า/เครื่องมือใหม่แยกต่างหาก" via
-- AskUserQuestion), after being shown 2 public Notion pages by "AI Video
-- Mastery by เข้ม KEMLIFE" (10 ready-to-fill Gemini video-edit prompts +
-- a character-sheet/shot-by-shot AI video prompt-structure example).
--
-- Purely additive: one new table, no existing table touched. Seeded with
-- the prompts read from those 2 pages so the library isn't empty on first
-- load — user can edit/duplicate/delete any seeded row same as their own.

create table if not exists prompt_library (
  id uuid primary key default uuid_generate_v4(),
  group_name text not null, -- clusters related prompts together in the UI (e.g. one Notion page = one group)
  title text not null,
  use_case text, -- "ใช้ตอน: ..." — when this prompt is the right pick
  tool_name text, -- e.g. 'Google Gemini (Video Edit)', 'Nano Banana Pro', 'Seedance 2.5'
  aspect_ratio text,
  prompt_template text not null, -- raw prompt text; may contain [PLACEHOLDER] tokens for the fill-in UI
  notes text,
  source_url text, -- where this was originally sourced from, if any (honesty/attribution)
  sort_order int not null default 0,
  is_favorite boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prompt_library_group on prompt_library(group_name, sort_order);

alter table prompt_library enable row level security;
drop policy if exists "prompt_library_select" on prompt_library;
drop policy if exists "prompt_library_insert" on prompt_library;
drop policy if exists "prompt_library_update" on prompt_library;
drop policy if exists "prompt_library_delete" on prompt_library;
create policy "prompt_library_select" on prompt_library for select using (auth.role() = 'authenticated');
create policy "prompt_library_insert" on prompt_library for insert with check (public.current_role() <> 'viewer');
create policy "prompt_library_update" on prompt_library for update using (public.current_role() <> 'viewer');
create policy "prompt_library_delete" on prompt_library for delete using (public.current_role() <> 'viewer');

-- ── Seed: Group A — 10 ready-to-fill Gemini video-edit prompts ──────────
-- Source: https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7
-- Each [BRACKET] token is an intentional fill-in slot from the original —
-- kept verbatim so the Prompt Library's placeholder-fill UI has real slots
-- to work with, matching how the source page itself instructs using them.

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '1️⃣ เปลี่ยนคลิปธรรมดาให้เป็นรีลระดับหนัง', 'ใช้ตอน: มีคลิปดิบๆ ที่ถ่ายมาเฉยๆ แต่อยากให้ดูแพง', 'Google Gemini (Video Edit)',
$$Edit this uploaded video into a premium cinematic social-media clip. Keep [PERSON/MAIN SUBJECT] and their original appearance consistent. Change the lighting to [golden hour/moody studio], add realistic depth of field, subtle background blur, a smooth cinematic push-in camera movement, and professional contrast. Preserve the original action and make the result feel like a high-budget [fashion/travel] commercial, not obviously AI-generated.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 1
where not exists (select 1 from prompt_library where title = '1️⃣ เปลี่ยนคลิปธรรมดาให้เป็นรีลระดับหนัง');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '2️⃣ เปลี่ยนฉากหลังที่น่าเบื่อทิ้ง', 'ใช้ตอน: ถ่ายในห้องรก แต่อยากให้ดูเหมือนอยู่ออฟฟิศหรู / คาเฟ่ / ถนนโตเกียว', 'Google Gemini (Video Edit)',
$$Replace the current background in this video with [luxury office/modern café/Tokyo street/beach/minimal studio]. Keep [PERSON/PRODUCT] unchanged, including face, clothing, proportions, movement, and positioning. Match the new environment's lighting, shadows, reflections, perspective, and depth to the original footage so the edit looks naturally filmed there. Do not alter [DETAILS THAT MUST STAY THE SAME].$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 2
where not exists (select 1 from prompt_library where title = '2️⃣ เปลี่ยนฉากหลังที่น่าเบื่อทิ้ง');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '3️⃣ ทำโฆษณาสินค้าระดับพรีเมียม', 'ใช้ตอน: ถ่ายสินค้าด้วยมือถือ แต่อยากได้ภาพแบบโฆษณาแบรนด์เนม', 'Google Gemini (Video Edit)',
$$Transform this product video into a premium [10-second] commercial for [PRODUCT/BRAND]. Keep the product's exact shape, logo, packaging, colors, and text unchanged. Place it in a [dark luxury/minimal white/futuristic/neon] studio environment with cinematic reflections, controlled lighting, shallow depth of field, and elegant camera movement. Make [PRODUCT FEATURE] the visual focus. Style reference: premium advertising for [INDUSTRY/BRAND TYPE].$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 3
where not exists (select 1 from prompt_library where title = '3️⃣ ทำโฆษณาสินค้าระดับพรีเมียม');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '4️⃣ ลบสิ่งที่ทำให้ช็อตพัง', 'ใช้ตอน: มีคนเดินผ่าน มีสายไฟ มีถังขยะ มีป้ายโผล่เข้ามาในเฟรม', 'Google Gemini (Video Edit)',
$$Clean up this video by removing [PERSON/OBJECT/CAR/SIGN/TRASH/CABLE/etc.] from the scene. Reconstruct everything behind it realistically using the surrounding environment as reference. Preserve the main subject, camera movement, lighting, shadows, textures, and perspective. The removed element should leave no visible artifacts, distortion, flickering, or unnatural empty areas.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 4
where not exists (select 1 from prompt_library where title = '4️⃣ ลบสิ่งที่ทำให้ช็อตพัง');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '5️⃣ เปลี่ยนคลิปกลางวันให้เป็นกลางคืน', 'ใช้ตอน: ถ่ายได้แค่ตอนกลางวัน แต่อยากได้บรรยากาศกลางคืน', 'Google Gemini (Video Edit)',
$$Convert this daytime video into a realistic [cinematic night/neon night/blue-hour] scene. Keep all people, buildings, objects, and movements unchanged. Darken the sky naturally, introduce realistic [streetlights/window lights/neon signs], add appropriate reflections and shadows, and adjust the subject lighting so everything belongs in the same environment. Keep it photorealistic and avoid excessive darkness.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 5
where not exists (select 1 from prompt_library where title = '5️⃣ เปลี่ยนคลิปกลางวันให้เป็นกลางคืน');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '6️⃣ ทำคลิปอาหารให้เหมือนโฆษณาราคาแพง', 'ใช้ตอน: รับงานร้านอาหาร หรือทำคอนเทนต์รีวิวอาหาร', 'Google Gemini (Video Edit)',
$$Turn this food clip into a professional restaurant advertisement. Keep the actual [FOOD/DISH] recognizable and realistic, but improve the lighting, texture, highlights, steam, and depth. Change the setting to [dark restaurant table/rustic kitchen/luxury dining setup] and create a slow cinematic close-up emphasizing [cheese pull/sauce/steam/crispy texture/etc.]. Make it appetizing and realistic rather than overly glossy or artificial.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 6
where not exists (select 1 from prompt_library where title = '6️⃣ ทำคลิปอาหารให้เหมือนโฆษณาราคาแพง');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '7️⃣ ใส่การเคลื่อนกล้องให้คลิปที่ถ่ายนิ่งๆ', 'ใช้ตอน: ตั้งขาตั้งถ่ายนิ่ง แล้วคลิปดูน่าเบื่อ', 'Google Gemini (Video Edit)',
$$Re-edit this shot so it feels like it was filmed with professional cinema equipment. Preserve the subject and original action, but change the camera presentation to a smooth [slow dolly-in/orbit/low-angle push-in/close-up reveal]. Maintain realistic perspective, subject proportions, background geometry, lighting, and motion. Keep the movement subtle and stable—no sudden warping or unnatural camera motion.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 7
where not exists (select 1 from prompt_library where title = '7️⃣ ใส่การเคลื่อนกล้องให้คลิปที่ถ่ายนิ่งๆ');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '8️⃣ เปลี่ยนคลิปให้เป็นแคมเปญแฟชั่นไฮเอนด์', 'ใช้ตอน: ทำคอนเทนต์เสื้อผ้า ร้านค้า หรือ personal brand', 'Google Gemini (Video Edit)',
$$Transform this video into a high-fashion campaign for [BRAND/STYLE]. Keep the person's face, identity, body proportions, pose, and movement consistent. Change the environment to [luxury hotel/minimal studio/Paris street/futuristic set] and give the scene [editorial/moody/clean luxury] lighting. Make the final result resemble a professionally directed fashion advertisement while maintaining realistic skin and fabric textures.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 8
where not exists (select 1 from prompt_library where title = '8️⃣ เปลี่ยนคลิปให้เป็นแคมเปญแฟชั่นไฮเอนด์');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '9️⃣ อัปคลิปเที่ยวให้เป็นช็อตหนัง', 'ใช้ตอน: มีคลิปเที่ยวเก่าๆ ในมือถือ อยากเอามาทำคอนเทนต์ใหม่', 'Google Gemini (Video Edit)',
$$Make this travel video look like a cinematic tourism campaign for [LOCATION]. Preserve recognizable landmarks and the main subject. Enhance the natural lighting, sky, landscape depth, water reflections, and environmental detail without making them unrealistic. Add a smooth [cinematic push-in/wide establishing movement/subtle aerial-style perspective] and use a [warm adventurous/tropical/luxury travel] visual mood.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 9
where not exists (select 1 from prompt_library where title = '9️⃣ อัปคลิปเที่ยวให้เป็นช็อตหนัง');

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, source_url, sort_order)
select '10 Prompt Gemini ตัดคลิปมือถือให้เป็นระดับโฆษณา', '🔟 ทำคลิป "ของจริง → AI" ที่หยุดนิ้วคนดู', 'ใช้ตอน: อยากได้คลิปไวรัล แบบมีจังหวะพลิกให้คนดูอึ้ง', 'Google Gemini (Video Edit)',
$$Edit this video as a dramatic transformation. Begin with the original-looking [PERSON/], then smoothly transform the environment into [futuristic city] while keeping the main subject consistent throughout. Make the transformation happen around [2–3 seconds], with realistic lighting and reflections changing alongside the environment. The transition should feel seamless, cinematic, and designed for a viral social-media reveal.$$,
'https://app.notion.com/p/cryptodog/10-Prompt-Gemini-30-3de0157f27d7816dbef1ff05a92feea7', 10
where not exists (select 1 from prompt_library where title = '🔟 ทำคลิป "ของจริง → AI" ที่หยุดนิ้วคนดู');

-- ── Seed: Group B — โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) ──
-- Source: https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4
-- This is a worked EXAMPLE (Korean-drama family story), not a [ ]-templated
-- prompt — kept verbatim as a structural reference: how to write a character
-- reference sheet that keeps a face consistent across shots, and how to
-- write a shot-by-shot video prompt (FORMAT/STYLE/SUBJECT/ENVIRONMENT/AUDIO/
-- TIMELINE) that references those character sheets by @image tag.

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'Character Sheet — พ่อ (JI-HOON)', 'ใช้ตอน: สร้างภาพอ้างอิงตัวละครให้หน้า/ชุดคงที่ทุกช็อตก่อนเริ่มทำวิดีโอ', 'Nano Banana Pro (text2image)', '16:9 · 2K',
$$Professional character reference sheet for a Korean drama, photorealistic cinematic style, clean light-grey studio background. Character: JI-HOON, Korean man age 32, food delivery rider and loving father, medium build, short black hair slightly flattened from a helmet, kind but exhausted face, light stubble, faint tan. OUTFIT A (rider): plain unbranded delivery rider windbreaker jacket with a pointed collar and full front white zipper — upper chest, shoulders and long sleeves in mint-green, lower body panel in off-white, separated by a wide grey reflective chevron (V-shaped) stripe across the chest, navy-blue elastic ribbed waistband and cuffs, two slanted front pockets; absolutely NO logos, NO text, NO brand marks anywhere on the jacket; black work pants, worn sneakers, holding a white open-face motorcycle helmet, black riding gloves, a square green insulated delivery backpack with no logo. OUTFIT B (ending): casual clean navy knit sweater and beige chinos, relaxed happy look. Layout: left side full-body front, side and back views in OUTFIT A; center one full-body front view in OUTFIT B; right side a row of 4 close-up facial expressions labeled: tired, angry shouting, crying in the rain, proud warm smile. Consistent face across all views, soft even studio lighting, K-drama film look, sharp detail, small clean label text 'JI-HOON' at the top.$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 1
where not exists (select 1 from prompt_library where title = 'Character Sheet — พ่อ (JI-HOON)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'Character Sheet — แม่ (YU-JIN)', 'ใช้ตอน: สร้างภาพอ้างอิงตัวละครให้หน้า/ชุดคงที่ทุกช็อตก่อนเริ่มทำวิดีโอ', 'Nano Banana Pro (text2image)', '16:9 · 2K',
$$Professional character reference sheet for a Korean drama, photorealistic cinematic style, clean light-grey studio background. Character: YU-JIN, Korean woman age 30, young housewife and mother, slim, long dark-brown hair tied in a loose low ponytail with a few strands falling on her face, natural minimal makeup, pretty but worried face. Outfit: oversized cream knit cardigan over a light grey t-shirt, loose dark-blue jeans, house slippers, thin silver wedding ring. Layout: full-body front view, full-body side view, full-body back view on the left; on the right a row of 4 close-up facial expressions labeled: worried, angry shouting, crying, hopeful gentle smile. Consistent face and outfit across all views, soft even studio lighting, K-drama film look, sharp detail, small clean label text 'YU-JIN' at the top.$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 2
where not exists (select 1 from prompt_library where title = 'Character Sheet — แม่ (YU-JIN)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'Character Sheet — ลูก (SEO-A)', 'ใช้ตอน: สร้างภาพอ้างอิงตัวละครให้หน้า/ชุดคงที่ทุกช็อตก่อนเริ่มทำวิดีโอ', 'Nano Banana Pro (text2image)', '16:9 · 2K',
$$Professional character reference sheet for a Korean drama, photorealistic cinematic style, clean light-grey studio background. Character: SEO-A, Korean girl age 6, cute round face, big bright eyes, straight black bob haircut with short bangs and a small yellow hair clip. Outfit: pastel pink long-sleeve cotton pajama set with small white star pattern, white socks. Props: holding a pink ceramic piggy bank in her arms, a crayon drawing of a family of three held in the other hand. Layout: full-body front view, full-body side view, full-body back view on the left; on the right a row of 4 close-up facial expressions labeled: shy, sad holding back tears, fake brave smile, overjoyed laughing. Consistent face and outfit across all views, soft even studio lighting, K-drama film look, sharp detail, small clean label text 'SEO-A' at the top.$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 3
where not exists (select 1 from prompt_library where title = 'Character Sheet — ลูก (SEO-A)');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'ช็อต A (0:00–0:30) — ทะเลาะเรื่องเงิน · ลูกซ่อนใบทัศนศึกษา', 'ใช้ตอน: อ้างอิง Character Sheet 3 ภาพ (พ่อ/แม่/ลูก) แล้วสั่งวิดีโอต่อเนื่องแบบมี dialogue จริง', 'Seedance 2.5 (element2video)', '9:16 · 480p · 30s',
$$FORMAT: 30 seconds / 8 CUTS / Korean family melodrama, tense to heartbreaking / dialogue in Korean, ambient rain, NO MUSIC

STYLE: Cinematic realist, simulating IMAX film camera, Panavision C-series lens, 35mm focal length, f/4. Low saturation, deep blue-black dominant tone, moderate film grain. Handheld throughout, subtle natural camera shake; camera movement intensity follows emotional intensity. Vertical 9:16. NO TEXT ON SCREEN.

SUBJECT 1: JI-HOON @image1 — Korean man, 32, short black hair, light stubble, tired kind face; mint-green and off-white rider windbreaker with grey reflective chevron, navy cuffs, no logos.
SUBJECT 2: YU-JIN @image2 — Korean woman, 30, long dark-brown hair in loose low ponytail, cream knit cardigan, grey t-shirt.
SUBJECT 3: SEO-A @image3 — Korean girl, 6, black bob with bangs, yellow hair clip, pink star-print pajamas.

ENVIRONMENT: Cramped Seoul rental apartment. Midnight: single warm ceiling bulb, blue night spill from window, rain streaks on glass, small table covered with unpaid bills, the edge of the book @image4 peeking out beneath the pile. Then pale grey early morning in the tiny kitchen.

AUDIO: Heavy rain, dripping jacket, paper slap, fridge hum; muffled arguing through a door; morning kettle, spoon on bowl.

TIMELINE:
0:00–0:04: Handheld medium, door opens — Ji-hoon enters soaked, helmet in hand, water dripping.
0:04–0:08: Close on table — Yu-jin slams an envelope of bills down. She says (furious, voice cracking): "이번 달 월세도 못 냈어. 돈이 어디 있어!"
0:08–0:11: Tight shaky close-up — He replies (exploding, gripping helmet): "나 하루에 14시간 배달해!"
0:11–0:15: Slow handheld drift past them to a half-open bedroom door — Seo-a peeks through the gap, clutching a folded paper, eyes wet.
0:15–0:19: Extreme close-up — Seo-a's small hands unfold a school field-trip permission slip, then crumple it slowly.
0:19–0:22: Medium, handheld — she hides the paper behind her back and quietly closes the door.
0:22–0:26: Morning, kitchen, medium two-shot — Seo-a at the table in pajamas. She says (forced bright smile, eyes down): "나 소풍 안 가고 싶어."
0:26–0:30: Close-up Ji-hoon in rider jacket, frozen mid-bite; Yu-jin behind him turns away.$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 4
where not exists (select 1 from prompt_library where title = 'ช็อต A (0:00–0:30) — ทะเลาะเรื่องเงิน · ลูกซ่อนใบทัศนศึกษา');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'ช็อต B (0:30–1:00) — พ่อเจอใบในถังขยะ · ร้องไห้กลางฝน', 'ใช้ตอน: ต่อเนื่องจากช็อต A — โฟกัสตัวละครเดียว (พ่อ) จุดพีคทางอารมณ์', 'Seedance 2.5 (element2video)', '9:16 · 480p · 30s',
$$FORMAT: 30 seconds / 7 CUTS / Korean family melodrama, quiet pain to emotional low point / minimal dialogue in Korean, ambient, heavy rain, NO MUSIC

STYLE: Cinematic realist, simulating IMAX film camera, Panavision C-series lens, 35mm focal length, f/4. Low saturation, deep blue-black dominant tone, moderate film grain. Handheld throughout, subtle natural camera shake; camera movement intensity follows emotional intensity. Vertical 9:16. NO TEXT ON SCREEN.

SUBJECT 1: JI-HOON @image1 — Korean man, 32, short black hair, light stubble, tired kind face; mint-green and off-white rider windbreaker with grey reflective chevron, navy cuffs, no logos.
Only Ji-hoon appears from the references. The rich girl in this shot is a different child, NOT Seo-a @image3.

ENVIRONMENT: Apartment kitchen at dawn; then the doorway of a spacious modern Seoul apartment at night, warm interior glow against a dark blue hallway; then an empty Seoul side street at night in pouring rain, sodium streetlight halo, wet asphalt reflections, a parked delivery scooter with an unbranded green box.

AUDIO: Trash bin lid, paper rustle; doorbell, bag handoff, children laughing inside; torrential rain on helmet and scooter, distant traffic hiss, one shaky exhale.

TIMELINE:
0:00–0:05: Close-up — Ji-hoon lifts a crumpled permission slip out of the kitchen trash bin, smooths it with his thumb, slips it into his jacket pocket.
0:05–0:09: Handheld medium at a luxury apartment door — he hands over a food bag with a polite bow.
0:09–0:12: POV over his shoulder — inside, a different girl about six packs a new backpack. She says (excited, to her mother): "내일 동물원 간다!"
0:12–0:15: Close-up Ji-hoon — a small smile fades; the door closes on him.
0:15–0:20: Wide, handheld — Ji-hoon sits alone on his scooter in the pouring rain, helmet visor up, not moving.
0:20–0:25: Medium close — he pulls the damp permission slip from his pocket, rain spotting the paper.
0:25–0:30: Slow handheld push-in to extreme close-up — his jaw trembles, tears mix with rain, he presses the paper to his chest.$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 5
where not exists (select 1 from prompt_library where title = 'ช็อต B (0:30–1:00) — พ่อเจอใบในถังขยะ · ร้องไห้กลางฝน');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'ช็อต C (1:00–1:30) — กระปุกหมู · คุยกันที่ระเบียง', 'ใช้ตอน: จุดคลี่คลาย — ตัวละครทั้ง 3 กลับมารวมกันในซีนเดียว', 'Seedance 2.5 (element2video)', '9:16 · 480p · 30s',
$$FORMAT: 30 seconds / 7 CUTS / Korean family melodrama, climax to reconciliation / dialogue in Korean, ambient rain, NO MUSIC

STYLE: Cinematic realist, simulating IMAX film camera, Panavision C-series lens, 35mm focal length, f/4. Low saturation, deep blue-black dominant tone, moderate film grain. Handheld throughout, subtle natural camera shake; camera movement intensity follows emotional intensity. Vertical 9:16. NO TEXT ON SCREEN.

SUBJECT 1: JI-HOON @image1 — Korean man, 32, short black hair, light stubble, tired kind face; mint-green and off-white rider windbreaker with grey reflective chevron, navy cuffs, no logos.
SUBJECT 2: YU-JIN @image2 — Korean woman, 30, long dark-brown hair in loose low ponytail, cream knit cardigan, grey t-shirt.
SUBJECT 3: SEO-A @image3 — Korean girl, 6, black bob with bangs, yellow hair clip, pink star-print pajamas.

ENVIRONMENT: Same cramped apartment, late night, single warm bulb, blue window light, rain on glass. Then a narrow apartment balcony at 2 a.m., rain easing, blurred city lights in deep blue, warm glow from the room behind where Seo-a sleeps.

AUDIO: Ceramic piggy bank cracking, coins scattering on a wooden floor, small footsteps, sobbing; then light rain and distant city hum.

TIMELINE:
0:00–0:03: Close-up — Seo-a cracks her pink piggy bank; coins spill on the floor.
0:03–0:07: Low handheld — she walks to Ji-hoon, still in his wet jacket and riding gloves, and pours coins into his gloved palms.
0:07–0:11: Close-up Seo-a — she says (trying to be brave, voice shaking): "나 돈 있어. 아빠 이제 비 맞으면서 일하지 마."
0:11–0:15: Handheld medium — Ji-hoon collapses to his knees and hugs her; Yu-jin rushes in crying and wraps both of them.
0:15–0:20: Handheld two-shot from behind — the couple stand side by side at the balcony railing, silent.
0:20–0:25: Close-up Yu-jin — she says (quiet, tearful): "미안해. 당신한테 화난 게 아니라 무서웠어."
0:25–0:30: Close-up Ji-hoon — he replies (firm, gentle, taking her hand): "다시는 애가 이런 걱정 안 하게 하자."$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 6
where not exists (select 1 from prompt_library where title = 'ช็อต C (1:00–1:30) — กระปุกหมู · คุยกันที่ระเบียง');

insert into prompt_library (group_name, title, use_case, tool_name, aspect_ratio, prompt_template, source_url, sort_order)
select 'โครงสร้าง Prompt วิดีโอ AI (ตัวละคร + Shot-by-shot) — ตัวอย่างละครเกาหลี', 'ช็อต D (1:30–2:00) — แม่หยิบหนังสือ · ตอนจบ · CTA', 'ใช้ตอน: ปิดเรื่องด้วย resolution + แทรก CTA สินค้า/คอร์สแบบมีเหตุผลในเนื้อเรื่อง (ไม่ใช่โฆษณาแยกลอย)', 'Seedance 2.5 (element2video)', '9:16 · 480p · 30s',
$$FORMAT: 30 seconds / 8 CUTS / Korean family melodrama, turning point to hopeful resolution / dialogue in Korean, ambient, NO MUSIC

STYLE: Cinematic realist, simulating IMAX film camera, Panavision C-series lens, 35mm focal length, f/4. Low saturation, deep blue-black dominant tone, moderate film grain. Handheld throughout, subtle natural camera shake; camera movement intensity follows emotional intensity. Vertical 9:16. NO TEXT ON SCREEN.

SUBJECT 1: JI-HOON @image1 — Korean man, 32, short black hair, light stubble, kind face; mint-green and off-white rider windbreaker with grey reflective chevron, navy cuffs, no logos; in the final beats (0:22 onward) wearing the casual navy knit sweater and beige chinos from his sheet.
SUBJECT 2: YU-JIN @image2 — Korean woman, 30, long dark-brown hair in loose low ponytail, cream knit cardigan, grey t-shirt.
SUBJECT 3: SEO-A @image3 — Korean girl, 6, black bob with bangs, yellow hair clip; in the ending wearing a school outfit with a small backpack.
PRODUCT: BOOK @image4 — hardcover "CLAUDE + VIDEO = MONEY", beige cover, smiling man in glasses, sticky notes. Keep cover design exact.

ENVIRONMENT: Same apartment table at night, bills pile, laptop, warm bulb against blue shadows; a night montage; then a cool clear morning outside a school with a yellow school bus, same blue-black grade, slightly brighter daylight.

AUDIO: Paper sliding, laptop keys, soft rain; street ambience, school bus engine, children chatter.

TIMELINE:
0:00–0:04: Close-up — Yu-jin slides the book @image4 out from under the bills; cover clearly visible.
0:04–0:08: Medium two-shot — she says (hopeful, holding up the book): "친구가 집에서 AI 영상으로 부수입 번대. 우리 같이 해볼까?"
0:08–0:11: Close-up Ji-hoon — he looks at the book, then at her, and nods slowly.
0:11–0:15: Handheld over-the-shoulder — both lean toward the glowing laptop; a child's crayon family drawing lies beside it.
0:15–0:19: Handheld montage — Ji-hoon in rider jacket edits on his phone while waiting for an order; Yu-jin at the laptop late at night, Seo-a's crayon drawing coming alive as a cartoon on screen.
0:19–0:23: Wide — three months later, Seo-a with a backpack waves from the school bus steps. She says (beaming): "아빠 엄마 이제 안 싸워!"
0:23–0:26: Medium — Ji-hoon in the navy sweater and Yu-jin wave back, holding hands.
0:26–0:30: Handheld medium close, Ji-hoon faces camera and holds up the book @image4, cover sharp. He says (warm, confident): "AI Video Mastery by KEMLIFE. 자세한 내용은 링크에서 확인하세요."$$,
'https://app.notion.com/p/cryptodog/Prompt-Prompt-AI-3e90157f27d78178a837d21c5f9184e4', 7
where not exists (select 1 from prompt_library where title = 'ช็อต D (1:30–2:00) — แม่หยิบหนังสือ · ตอนจบ · CTA');
