-- Content Studio: real-work production tracking (managed nail-salon accounts).
-- Flow: weekly brief → "แตกเป็นไอเดีย" → each idea is saved with
-- production = 'waiting' (รอผลงานจริงจากร้าน) → when the shop sends the
-- real photos/clips it becomes 'received' with a note (ชื่อเฉด / ราคาที่คิด /
-- ยินยอม / ลิงก์คลิป) → posting it uses the existing status 'used'.
-- Normal posts keep production = null. Safe to run more than once.

alter table studio_posts add column if not exists production text;
alter table studio_posts add column if not exists production_note text;
alter table studio_posts add column if not exists production_at timestamptz;
alter table studio_posts add column if not exists parent_id uuid references studio_posts(id) on delete set null;

alter table studio_posts drop constraint if exists studio_posts_production_check;
alter table studio_posts add constraint studio_posts_production_check check (production is null or production in ('waiting', 'received'));

create index if not exists idx_studio_posts_production on studio_posts(client_id, production) where production is not null;
