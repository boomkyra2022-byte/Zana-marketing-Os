-- Signup approval gate — explicit user request: "มีความเสี่ยงที่คนข้างนอกกดเข้า
-- ลิงก์มาแล้วสมัครรหัสใช้เอง ฉันต้องการตั้งรหัสเจ้าของสำหรับปลดล็อคการสมัครสมาชิก
-- หรืออนุมัติให้เข้าใช้งานได้" — confirmed real: the public /login page's
-- "สร้างบัญชีใหม่" form let anyone call supabase.auth.signUp() with just an
-- email+password, and the existing handle_new_user() trigger auto-created a
-- `profiles` row for them immediately — giving them read access to every
-- table gated only by `auth.role() = 'authenticated'` (products, personas,
-- knowledge base, ideas/scripts, campaigns/performance, etc.) the moment
-- their email was confirmed. User chose "ทั้งสองอย่าง" (both): (1) an access
-- code required at signup (app/login/actions.ts, this migration doesn't
-- touch that half) AND (2) an owner-approval queue — this migration builds
-- the DB side of the approval queue.
--
-- Purely additive: new nullable-with-default column + a backfill UPDATE +
-- two function/trigger replacements. Nothing existing is dropped.

-- ── profiles.status ─────────────────────────────────────────────────────
alter table profiles add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

-- IMPORTANT — run this UPDATE exactly once, right after the ALTER above, in
-- the same migration pass. The ALTER's own DEFAULT 'pending' applies to
-- every row that already existed (not just new ones), so without this
-- backfill every current real team member would suddenly be locked out too.
-- Only signups that happen AFTER this migration should start pending.
update profiles set status = 'approved' where status = 'pending';

-- ── handle_new_user(): new signups now start pending, explicitly ─────────
-- (status also defaults to 'pending' via the column default above — this is
-- just making the intent explicit at the insert site, same as `role`).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (new.id, new.raw_user_meta_data->>'full_name', 'viewer', 'pending')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ── Anti-privilege-escalation trigger ─────────────────────────────────────
-- Real gap found while auditing this: `profiles_update_self_or_admin` (see
-- 0001_init.sql) allows `using (id = auth.uid() or public.current_role() in
-- ('admin','owner'))` for UPDATE — that's a row-level check only, Postgres
-- RLS has no column-level restriction, so as written a 'pending'/'viewer'
-- user could call the Supabase REST/JS client directly (bypassing this
-- app's own UI entirely) and set their OWN `role` to 'admin' or their own
-- `status` to 'approved'. This trigger closes that regardless of which
-- policy allows the row through: for anyone who is not currently admin/owner,
-- it silently clamps `role` and `status` back to their prior values on
-- every UPDATE, so only an existing admin/owner can actually change either
-- column (matches how `updateMemberRole`/the new `updateMemberStatus` in
-- app/(dashboard)/settings/team/actions.ts already gate themselves in app
-- code — this is the defense-in-depth DB-level backstop for that).
create or replace function public.prevent_self_privilege_escalation()
returns trigger as $$
begin
  if public.current_role() not in ('admin', 'owner') then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_prevent_self_privilege_escalation on profiles;
create trigger trg_prevent_self_privilege_escalation
  before update on profiles
  for each row execute procedure public.prevent_self_privilege_escalation();
