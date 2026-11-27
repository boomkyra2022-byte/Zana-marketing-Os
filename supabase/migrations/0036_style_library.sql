begin;

create table public.video_styles (
  code text primary key check (code in ('A','B','C','D','E','F','G','H','I')),
  name_th text not null,
  best_for text not null,
  material_needed text not null,
  zana_ok boolean not null,
  needs_face boolean not null,
  ad_ok boolean not null,
  order_template text not null,
  sort integer not null,
  updated_at timestamptz not null default now()
);

create table public.style_demos (
  id uuid primary key default gen_random_uuid(),
  style_code text not null references public.video_styles(code),
  title text not null,
  brand text not null,
  video_path text not null unique,
  poster_path text not null unique,
  duration_s numeric not null check (duration_s > 0),
  purpose text not null check (purpose in ('แอด','ออร์แกนิก')),
  status text not null default 'draft' check (status in ('draft','approved')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index style_demos_style_code_idx on public.style_demos (style_code, created_at desc);

alter table public.video_styles enable row level security;
alter table public.style_demos enable row level security;
grant select, insert, update, delete on public.video_styles, public.style_demos to authenticated;

create policy video_styles_read on public.video_styles for select to authenticated using (true);
create policy video_styles_write on public.video_styles for all to authenticated
  using ((select public.current_role()) <> 'viewer')
  with check ((select public.current_role()) <> 'viewer');
create policy style_demos_read on public.style_demos for select to authenticated using (true);
create policy style_demos_write on public.style_demos for all to authenticated
  using ((select public.current_role()) <> 'viewer')
  with check ((select public.current_role()) <> 'viewer');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('style-demos', 'style-demos', false, 52428800, array['video/mp4', 'image/jpeg']);

create policy style_demos_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'style-demos');
create policy style_demos_storage_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'style-demos' and (select public.current_role()) <> 'viewer'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy style_demos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'style-demos' and (select public.current_role()) <> 'viewer');

insert into public.video_styles (code, name_th, best_for, material_needed, zana_ok, needs_face, ad_ok, order_template, sort)
select code, name_th, best_for, material, zana_ok, needs_face, ad_ok,
  concat_ws(E'\n',
    'ใช้สกิล jangzana-video-editor ตัดคลิปให้หน่อย',
    'สไตล์: ' || code || ' ' || name_th,
    'ใช้ทำ: ' || purpose,
    'ความยาว: ' || duration || ' วิ',
    'แบรนด์: จ้างซาน่า',
    'เสียง: ' || voice,
    'วัตถุดิบ: ' || material,
    'ข้อความหลัก / ข้อเสนอ: ' || message,
    'เพลง: [ระบุไฟล์เพลงหรือไม่ใส่เพลง]',
    case when purpose = 'แอด' then '(ใช้โครง ADS45: เสนอ 3 Angle ให้เลือกก่อน)' end,
    'เริ่มจากส่งแผน + ชุดเตรียมงานให้ดูก่อน ยังไม่ต้องตัด'
  ), ascii(code) - ascii('A') + 1
from (values
  ('A','พูดหน้ากล้อง + การ์ด','สอน/เล่า/ขายด้วยตัวเอง','คลิปพูด 1 ตัว',true,true,true,'แอด',45,'เสียงจากคลิป','จ้างซาน่าช่วยวางบรีฟและตัดคลิปจากไฟล์ที่ลูกค้ามี'),
  ('B','จอแยกบน–ล่าง','อธิบายพร้อมภาพ รีวิวสินค้า','คลิปพูด + ภาพ 5–10',true,true,true,'แอด',45,'เสียงจากคลิป','อธิบายบริการพร้อมภาพตัวอย่างงานจริง'),
  ('C','มีมตัดไว','ตลก ไวรัล ข่าว/บันเทิง','เสียงพากย์ + มีม',false,false,false,'ออร์แกนิก',30,'เสียงพากย์','เล่าเรื่องขำ ๆ จากการคุยบรีฟงานตัดต่อ'),
  ('D','Faceless อธิบาย','ความรู้ ขั้นตอน','เสียงพากย์ (ตัวเอง/AI)',true,false,true,'ออร์แกนิก',30,'เสียงพากย์','อธิบายวิธีเตรียมไฟล์ก่อนส่งตัดต่อ'),
  ('E','พรีเซนต์สินค้า 60 วิ','เปิดตัวสินค้า แคมเปญ','โลโก้ + ภาพสินค้าตัดพื้น + facts',true,false,true,'แอด',60,'เสียงพากย์','เปิดตัวบริการจากจุดเด่นและข้อมูลที่ยืนยันได้'),
  ('F','ครึ่งบนโมชัน ครึ่งล่างคนพูด','สอนเชิงข้อมูล ตัวเลข กราฟ','คลิปพูด + บท',true,true,true,'สอน',45,'เสียงจากคลิป','สอนอ่านผลคลิปด้วยกราฟจากข้อมูลจริง'),
  ('G','พูดหน้ากล้อง + fx10','โชว์ผลงาน/พอร์ต เอเจนซี่','คลิปพูด + ภาพผลงาน 4–8',true,true,true,'ออร์แกนิก',45,'เสียงจากคลิป','โชว์พอร์ตจากผลงานที่ได้รับอนุญาตให้เผยแพร่'),
  ('H','AI เล่าเรื่อง','ตำนาน เรื่องเล่า เพจความรู้','บทอย่างเดียว + API ElevenLabs/gpt-image',false,false,false,'ออร์แกนิก',60,'AI ElevenLabs','เล่าว่าบรีฟหนึ่งหน้ากลายเป็นคลิปได้อย่างไร'),
  ('I','Neon 3D โมชันกราฟิก','ขายระบบ บริการ คอร์ส แอป','สกรีนช็อตระบบ 3–6 + บท',false,false,true,'แอด',30,'ไม่มีเสียงพูด','เปิดระบบ Content Studio แล้วเริ่มบรีฟจาก Brand Card')
) as seed(code, name_th, best_for, material, zana_ok, needs_face, ad_ok, purpose, duration, voice, message);

commit;
