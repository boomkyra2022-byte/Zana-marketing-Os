-- 0035_ads_prompt_builder_templates.sql
-- Prompt Library: "Ads Prompt Builder" — ready-to-fill prompt templates for
-- analysing Meta ads (explicit user request 2026-11-14: "Save Prompt Builder
-- ลงในระบบ ไว้เลือกเทมเพลต Prompt", after reviewing MaxxGPT's Prompt Builder).
-- Categories mirror common ad-analysis jobs; every prompt body is ZANA's own
-- wording (not copied). [BRACKET] tokens are fill-in slots for the existing
-- Prompt Library fill-in UI. Pair with the Ads Intelligence CSV export.
--
-- Additive only, idempotent ("where not exists" on group_name + title).

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · แคมเปญ$pb$, $pb$วิเคราะห์แคมเปญเดี่ยว$pb$, $pb$ใช้ตอน: เจาะแคมเปญเดียวว่าดี/แย่ตรงไหน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

วิเคราะห์แคมเปญ [ชื่อแคมเปญ] ช่วง [ช่วงวันที่] เป้าหมายหลักคือ [Inbox/Purchase/Lead] ต้นทุนเป้าหมาย [ต้นทุนเป้าหมาย] บาท
ดู funnel อิมเพรสชัน → คลิก → ผลลัพธ์ และชี้ว่ารั่วที่ขั้นไหน

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 1
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · แคมเปญ$pb$ and title = $pb$วิเคราะห์แคมเปญเดี่ยว$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · แคมเปญ$pb$, $pb$เทียบ 2 แคมเปญ$pb$, $pb$ใช้ตอน: ตัดสินว่าแคมเปญไหนควรได้งบมากกว่า$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

เปรียบเทียบแคมเปญ [แคมเปญ A] กับ [แคมเปญ B] ช่วง [ช่วงวันที่] ด้วย Spend, CPM, CTR ลิงก์, ต้นทุนต่อ[ผลลัพธ์หลัก], ROAS
สรุปว่าตัวไหนชนะเพราะอะไร และควรโยกงบอย่างไร

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 2
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · แคมเปญ$pb$ and title = $pb$เทียบ 2 แคมเปญ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · แคมเปญ$pb$, $pb$ตัดสินใจ เพิ่ม/ลด/หยุด งบแคมเปญ$pb$, $pb$ใช้ตอน: ก่อนปรับงบรายวัน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

แคมเปญ [ชื่อแคมเปญ] งบปัจจุบัน [งบต่อวัน] บาท/วัน ต้นทุนเป้าหมาย [ต้นทุนเป้าหมาย] บาท
แนะนำว่าควร เพิ่ม (กี่ %) / คงไว้ / ลด / หยุด พร้อมเงื่อนไขที่จะกลับมาทบทวน

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 3
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · แคมเปญ$pb$ and title = $pb$ตัดสินใจ เพิ่ม/ลด/หยุด งบแคมเปญ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · แคมเปญ$pb$, $pb$ตรวจความถี่ (Frequency) สูงเกินไหม$pb$, $pb$ใช้ตอน: เมื่อ CTR เริ่มตกหรือคอมเมนต์บ่นว่าเห็นบ่อย$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ตรวจแคมเปญ [ชื่อแคมเปญ] ว่า Frequency สูงเกินจนกระทบผลหรือยัง (ดูคู่กับ CTR และ CPM รายวัน) และควรขยายกลุ่ม/เปลี่ยนครีเอทีฟอย่างไร

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 4
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · แคมเปญ$pb$ and title = $pb$ตรวจความถี่ (Frequency) สูงเกินไหม$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · แคมเปญ$pb$, $pb$หาโอกาสขยายกลุ่มเป้าหมาย$pb$, $pb$ใช้ตอน: แคมเปญดีแต่ยิงไม่ออก/เริ่มอิ่มตัว$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

จากผลแยกอายุ/เพศ/กลุ่มความสนใจของ [ชื่อแคมเปญ] หากลุ่มที่ต้นทุนดีที่ควรแยกชุดโฆษณาหรือขยาย และกลุ่มที่ควรตัดออก

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 5
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · แคมเปญ$pb$ and title = $pb$หาโอกาสขยายกลุ่มเป้าหมาย$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · แคมเปญ$pb$, $pb$แนวทางปรับปรุงแคมเปญทั้งระบบ$pb$, $pb$ใช้ตอน: รีวิวโครงสร้างแคมเปญ$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

รีวิวโครงสร้างแคมเปญ [ชื่อแคมเปญ] (วัตถุประสงค์, จำนวนชุดโฆษณา, งบ, ครีเอทีฟ) แล้วเสนอโครงใหม่ที่ควรทดสอบ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 6
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · แคมเปญ$pb$ and title = $pb$แนวทางปรับปรุงแคมเปญทั้งระบบ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ชุดโฆษณา$pb$, $pb$ลดต้นทุนต่อ Inbox$pb$, $pb$ใช้ตอน: ต้นทุนแชทแพงกว่าเป้า$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ชุดโฆษณา [ชื่อชุดโฆษณา] ต้นทุนต่อแชท [ต้นทุนปัจจุบัน] บาท เป้าหมาย [ต้นทุนเป้าหมาย] บาท
หาสาเหตุ (CPM แพง / CTR ต่ำ / คลิกแล้วไม่ทัก) และวิธีแก้ทีละข้อ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 7
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ชุดโฆษณา$pb$ and title = $pb$ลดต้นทุนต่อ Inbox$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ชุดโฆษณา$pb$, $pb$ประเมินคุณภาพกลุ่มเป้าหมาย$pb$, $pb$ใช้ตอน: สงสัยว่ากลุ่มเป้าหมายผิด$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ประเมินกลุ่มเป้าหมายของชุดโฆษณา [ชื่อชุดโฆษณา] (อายุ เพศ ความสนใจ) จากผลลัพธ์จริง ว่าตรงกับลูกค้าของ [สินค้า] หรือไม่

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 8
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ชุดโฆษณา$pb$ and title = $pb$ประเมินคุณภาพกลุ่มเป้าหมาย$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ชุดโฆษณา$pb$, $pb$ชุดโฆษณาช่วยหรือถ่วงแคมเปญ$pb$, $pb$ใช้ตอน: มีหลายชุดในแคมเปญเดียว$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

เทียบแต่ละชุดโฆษณาใน [ชื่อแคมเปญ] กับค่าเฉลี่ยของแคมเปญ บอกว่าชุดไหนเป็นตัวช่วย ชุดไหนเป็นตัวถ่วง และควรทำอะไรกับแต่ละชุด

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 9
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ชุดโฆษณา$pb$ and title = $pb$ชุดโฆษณาช่วยหรือถ่วงแคมเปญ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$, $pb$วิเคราะห์ Creative Fatigue ของโฆษณา$pb$, $pb$ใช้ตอน: โฆษณาที่เคยดีเริ่มแย่ลง$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ดูผลรายวันของโฆษณา [ชื่อโฆษณา] (CTR ลิงก์, CPM, Frequency, ต้นทุนต่อผลลัพธ์) ว่าเริ่มล้าหรือยัง ล้าตั้งแต่วันไหน และควรเปลี่ยนครีเอทีฟแบบไหน (hook / มุมขาย / format)

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 10
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$ and title = $pb$วิเคราะห์ Creative Fatigue ของโฆษณา$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$, $pb$ถอดครีเอทีฟโฆษณา$pb$, $pb$ใช้ตอน: อยากรู้ว่าโฆษณาที่ชนะมีอะไร$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ถอดองค์ประกอบโฆษณา [ชื่อโฆษณา]: Hook 3 วิแรก, ปัญหา/ความอยาก, ข้อเสนอ, หลักฐาน, CTA, แคปชัน
แคปชัน/สคริปต์: [วางแคปชันหรือสคริปต์]
บอกว่าองค์ประกอบไหนน่าจะทำให้ผลดี/แย่ และเอาไปทำซ้ำอย่างไร

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 11
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$ and title = $pb$ถอดครีเอทีฟโฆษณา$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$, $pb$หาสาเหตุ CTR ลดลง$pb$, $pb$ใช้ตอน: CTR ตกผิดปกติ$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

CTR ของ [ชื่อโฆษณา/แคมเปญ] ลดจาก [CTR เดิม] เหลือ [CTR ล่าสุด] วินิจฉัยสาเหตุที่เป็นไปได้ (ล้า, กลุ่มเปลี่ยน, placement, คู่แข่ง) เรียงตามความน่าจะเป็น

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 12
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$ and title = $pb$หาสาเหตุ CTR ลดลง$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$, $pb$วิเคราะห์อัตราการดูวิดีโอ$pb$, $pb$ใช้ตอน: โฆษณาวิดีโอดูไม่จบ$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

วิเคราะห์ funnel วิดีโอของ [ชื่อโฆษณา]: Hook rate (ดูเกิน 3 วิ/อิมเพรสชัน), Hold rate (ThruPlay/ดูเกิน 3 วิ), ดูถึง 25/50/75/95%
ความยาวคลิป [ความยาว] วินาที บอกว่าคนหลุดช่วงไหน และต้องแก้คลิปตรงไหน

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 13
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$ and title = $pb$วิเคราะห์อัตราการดูวิดีโอ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$, $pb$วิเคราะห์การทัก Inbox ของโฆษณา$pb$, $pb$ใช้ตอน: โฆษณาแชท$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ดูโฆษณา [ชื่อโฆษณา] ว่าคลิก → ทักแชท → ซื้อ เป็นอย่างไร ต้นทุนต่อแชทใหม่เท่าไร และปัญหาอยู่ที่โฆษณาหรือการตอบแชท

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 14
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$ and title = $pb$วิเคราะห์การทัก Inbox ของโฆษณา$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$, $pb$หาเหตุผลที่ครีเอทีฟดีหรือแย่$pb$, $pb$ใช้ตอน: เทียบหลายครีเอทีฟ$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

เทียบครีเอทีฟในชุด [ชื่อชุดโฆษณา] ตัวที่ดีที่สุดกับแย่ที่สุด ต่างกันที่องค์ประกอบไหน แล้วเสนอ 3 ไอเดียครีเอทีฟใหม่ที่ควรทดสอบ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 15
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · โฆษณา & ครีเอทีฟ$pb$ and title = $pb$หาเหตุผลที่ครีเอทีฟดีหรือแย่$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$, $pb$จัดอันดับโฆษณาตาม Metric$pb$, $pb$ใช้ตอน: หา top/bottom ตามตัวชี้วัดเดียว$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

จัดอันดับโฆษณาทั้งหมดตาม [Metric] (ดีที่สุด [จำนวน] อันดับ และแย่ที่สุด [จำนวน] อันดับ) เฉพาะตัวที่ใช้เงิน ≥ [ใช้เงินขั้นต่ำ] บาท พร้อมข้อสังเกต

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 16
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$ and title = $pb$จัดอันดับโฆษณาตาม Metric$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$, $pb$Scan บัญชีด้วยเกณฑ์$pb$, $pb$ใช้ตอน: เช็กทั้งบัญชีว่าอะไรไม่ผ่าน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

เกณฑ์ของเรา: CTR ลิงก์ ≥ [CTR ขั้นต่ำ]%, CPM ≤ [CPM สูงสุด] บาท, ต้นทุนต่อ[ผลลัพธ์หลัก] ≤ [ต้นทุนเป้าหมาย] บาท
ไล่ทุกแคมเปญ/ชุด/โฆษณา บอกว่าตัวไหนไม่ผ่านข้อไหน

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 17
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$ and title = $pb$Scan บัญชีด้วยเกณฑ์$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$, $pb$หา Anomaly ตัวเลขผิดปกติ$pb$, $pb$ใช้ตอน: เช้าวันทำงาน/ก่อนประชุม$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

หา Metric ที่เปลี่ยนผิดปกติใน [ช่วงวันที่] เทียบกับช่วงก่อนหน้า (CPM, CTR, ต้นทุนต่อผลลัพธ์, Spend) และบอกว่าควรตรวจอะไรต่อ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 18
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$ and title = $pb$หา Anomaly ตัวเลขผิดปกติ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$, $pb$ตรวจ Traffic คุณภาพต่ำ$pb$, $pb$ใช้ตอน: คลิกเยอะแต่ไม่มีผล$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

หาโฆษณาที่คลิกเยอะแต่ไม่มีแชท/ยอดซื้อ หรือ CPC ถูกผิดปกติ ระบุ placement/กลุ่มที่น่าสงสัย และวิธีกรอง

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 19
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$ and title = $pb$ตรวจ Traffic คุณภาพต่ำ$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$, $pb$โฆษณาที่ควรพิจารณาปิด$pb$, $pb$ใช้ตอน: ตัดงบที่ไม่คุ้ม$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

หาโฆษณาที่ควรปิด: ใช้เงิน ≥ [ใช้เงินขั้นต่ำ] บาทแต่ไม่มีผลลัพธ์ หรือต้นทุนแพงกว่าเป้า [ต้นทุนเป้าหมาย] บาท ≥ 1.5 เท่า บอกความเสี่ยงก่อนปิดแต่ละตัว

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 20
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · เกณฑ์ชี้วัด$pb$ and title = $pb$โฆษณาที่ควรพิจารณาปิด$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · งบประมาณ$pb$, $pb$หาโอกาสโยกงบภายในบัญชี$pb$, $pb$ใช้ตอน: งบรวมเท่าเดิมแต่อยากได้ผลมากขึ้น$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

งบรวมต่อวัน [งบรวมต่อวัน] บาท เสนอการโยกงบจากตัวที่ต้นทุนแพงไปตัวที่ต้นทุนดี เป็นตาราง (จาก → ไป, จำนวนบาท, เหตุผล)

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 21
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · งบประมาณ$pb$ and title = $pb$หาโอกาสโยกงบภายในบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · งบประมาณ$pb$, $pb$ควรเพิ่มงบแคมเปญหรือไม่$pb$, $pb$ใช้ตอน: ก่อน scale$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

แคมเปญ [ชื่อแคมเปญ] ผลดีมา [จำนวนวัน] วัน ควร scale ไหม เพิ่มเท่าไรต่อครั้ง และสัญญาณไหนที่บอกว่าต้องหยุดเพิ่ม

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 22
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · งบประมาณ$pb$ and title = $pb$ควรเพิ่มงบแคมเปญหรือไม่$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · งบประมาณ$pb$, $pb$ประเมินความคุ้มค่างบทั้งบัญชี$pb$, $pb$ใช้ตอน: สรุปสิ้นเดือน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

สรุปว่างบ [ช่วงวันที่] รวม [ยอดใช้จ่าย] บาท ได้ผลลัพธ์คุ้มไหม เทียบเป้า [เป้าหมาย] และส่วนไหนของงบที่สูญเปล่า

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 23
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · งบประมาณ$pb$ and title = $pb$ประเมินความคุ้มค่างบทั้งบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · รายบัญชี$pb$, $pb$วิเคราะห์ Funnel ของบัญชี$pb$, $pb$ใช้ตอน: ไม่รู้ว่าปัญหาอยู่ตรงไหน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ดู funnel ทั้งบัญชี อิมเพรสชัน → คลิก → แชท/Lead → ซื้อ ช่วง [ช่วงวันที่] บอกว่าปัญหาหลักอยู่ที่ Traffic, Engagement หรือ Conversion

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 24
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · รายบัญชี$pb$ and title = $pb$วิเคราะห์ Funnel ของบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · รายบัญชี$pb$, $pb$สรุปปัญหาหลักของบัญชี$pb$, $pb$ใช้ตอน: บัญชีผลแย่ลง$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

หา 3 ปัญหาหลักที่ทำให้บัญชีผลงานต่ำใน [ช่วงวันที่] เรียงตามผลกระทบเป็นเงิน พร้อมวิธีแก้

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 25
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · รายบัญชี$pb$ and title = $pb$สรุปปัญหาหลักของบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · รายบัญชี$pb$, $pb$เทียบบัญชีช่วงนี้กับช่วงก่อน$pb$, $pb$ใช้ตอน: รายสัปดาห์/รายเดือน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

เทียบ [ช่วงปัจจุบัน] กับ [ช่วงก่อนหน้า] ทุก Metric หลัก บอกสิ่งที่ดีขึ้น แย่ลง และสาเหตุที่เป็นไปได้

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 26
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · รายบัญชี$pb$ and title = $pb$เทียบบัญชีช่วงนี้กับช่วงก่อน$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$, $pb$เช็กสุขภาพโฆษณาวันนี้ทุกบัญชี$pb$, $pb$ใช้ตอน: เช้าทุกวัน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ไล่ทุกบัญชีโฆษณา บอกบัญชี/แคมเปญที่ต้องดูก่อนวันนี้ (งบไม่เดิน, ต้นทุนพุ่ง, ไม่มีผลลัพธ์) เรียงตามความเร่งด่วน

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 27
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$ and title = $pb$เช็กสุขภาพโฆษณาวันนี้ทุกบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$, $pb$หาโฆษณาเปลืองงบแต่ผลต่ำทุกบัญชี$pb$, $pb$ใช้ตอน: ล้างงบรั่ว$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

จากทุกบัญชี หาแคมเปญ/ชุด/โฆษณาที่ใช้เงินมากแต่ผลต่ำที่สุด [จำนวน] อันดับ และสิ่งที่ควรทำ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 28
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$ and title = $pb$หาโฆษณาเปลืองงบแต่ผลต่ำทุกบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$, $pb$ตรวจ Creative Fatigue ทุกบัญชี$pb$, $pb$ใช้ตอน: วางแผนผลิตคอนเทนต์$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

หาครีเอทีฟที่เริ่มล้าในทุกบัญชี และจัดลำดับว่าต้องผลิตครีเอทีฟใหม่ให้บัญชีไหนก่อน กี่ชิ้น แบบไหน

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 29
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$ and title = $pb$ตรวจ Creative Fatigue ทุกบัญชี$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$, $pb$สรุป Action Plan วันนี้$pb$, $pb$ใช้ตอน: ก่อนเริ่มงาน$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

แปลงข้อมูลวันนี้เป็นรายการงาน (ใครทำ / ทำอะไร / กับแคมเปญไหน / ภายในเมื่อไร) ไม่เกิน 10 ข้อ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 30
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · ภาพรวมทุกบัญชี$pb$ and title = $pb$สรุป Action Plan วันนี้$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · รายงาน$pb$, $pb$รายงานผู้บริหาร 1 หน้า$pb$, $pb$ใช้ตอน: ส่งเจ้าของ/ผู้บริหาร$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

เขียนรายงาน [ช่วงวันที่] สำหรับผู้บริหาร: ตัวเลขสำคัญ 5 ตัว, เทียบเป้า [เป้าหมาย], 3 เรื่องที่ต้องตัดสินใจ — ไม่เกิน 1 หน้า ภาษาไม่เทคนิค

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 31
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · รายงาน$pb$ and title = $pb$รายงานผู้บริหาร 1 หน้า$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · รายงาน$pb$, $pb$รายงานแคมเปญสำหรับลูกค้า$pb$, $pb$ใช้ตอน: เอเจนซี/ฟรีแลนซ์ส่งลูกค้า$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

สรุปแคมเปญ [ชื่อแคมเปญ] ให้ลูกค้า [ชื่อลูกค้า] อ่านง่าย: ผลที่ได้, เทียบเป้า, สิ่งที่เรียนรู้, แผนรอบถัดไป

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 32
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · รายงาน$pb$ and title = $pb$รายงานแคมเปญสำหรับลูกค้า$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · รายงาน$pb$, $pb$แปลงผลวิเคราะห์เป็นรายการ Action$pb$, $pb$ใช้ตอน: หลังวิเคราะห์เสร็จ$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

จากผลวิเคราะห์นี้ แปลงเป็นรายการ Action ที่ทำได้ทันที แยก ด่วนวันนี้ / สัปดาห์นี้ / ทดสอบต่อ

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 33
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · รายงาน$pb$ and title = $pb$แปลงผลวิเคราะห์เป็นรายการ Action$pb$);

insert into prompt_library (group_name, title, use_case, tool_name, prompt_template, notes, sort_order)
select $pb$Ads Prompt Builder · งานตั้งเวลา$pb$, $pb$เฝ้าดูสัญญาณดี/แย่ระหว่างวัน$pb$, $pb$ใช้ตอน: ตั้งให้ AI ช่วยเช็กทุกไม่กี่ชั่วโมง$pb$, 'ChatGPT / Claude / Gemini',
$pb$คุณคือ Performance Media Buyer ของแบรนด์ออนไลน์ไทย (Facebook/Instagram Ads) วิเคราะห์จากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลข ถ้าข้อมูลไม่พอให้บอกว่าขาดอะไร

ทุก [ความถี่ เช่น 3 ชั่วโมง] ให้เช็กโฆษณาที่เปิดอยู่: ถ้าต้นทุนต่อ[ผลลัพธ์หลัก] เกิน [ต้นทุนเป้าหมาย] บาท หรือใช้เงินเกิน [ใช้เงินขั้นต่ำ] บาทแต่ไม่มีผล ให้แจ้งเตือนพร้อมเหตุผล ถ้ามีตัวที่ดีกว่าเป้า ≥ 30% ให้แจ้งว่าควรเพิ่มงบ (แจ้งเท่านั้น ห้ามแก้แคมเปญเอง)

ข้อมูล (วาง CSV / ตารางจาก Ads Intelligence หรือ Ads Manager):
[วางข้อมูล]

ตอบเป็นภาษาไทย กระชับ เรียงหัวข้อ: 1) สรุป 1 ประโยค 2) สิ่งที่เห็นจากตัวเลข (อ้างตัวเลขจริง) 3) สิ่งที่ควรทำ เรียงตามความสำคัญ$pb$,
'วางข้อมูลจากหน้า Ads Intelligence (Download CSV) หรือ Ads Manager ในช่อง [วางข้อมูล]', 34
where not exists (select 1 from prompt_library where group_name = $pb$Ads Prompt Builder · งานตั้งเวลา$pb$ and title = $pb$เฝ้าดูสัญญาณดี/แย่ระหว่างวัน$pb$);

