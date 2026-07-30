# ZANA Marketing OS

Real, running (not mockup) Next.js + Supabase app. See `MASTER_PROMPT.md` for the full spec, `PLAN.md` for architecture decisions, `TODO.md` for phase-by-phase status.

**Phase 1 is implemented**: auth, DB schema + RLS, full navigation shell, and real CRUD (backed by Supabase, no hardcoded data) for Products, Personas, and Knowledge Base, plus a Command Center dashboard driven by live row counts.

**Not yet run in this environment.** The agent session that wrote this code had no working shell (sandbox disk-space failure), so `npm install`, `next dev`, and the Supabase migration have not been executed or smoke-tested yet. Follow the steps below to do that — they should take under 15 minutes.

## 1. Create a Supabase project
1. Go to https://supabase.com/dashboard and create a new project.
2. In **Project Settings → API**, copy the Project URL, `anon` public key, and `service_role` key.

## 2. Configure environment
```bash
cp .env.example .env.local
```
Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=http://localhost:3000
```
(AI/Google Drive vars are only needed starting Phase 2/3 — leave blank for now.)

## 3. Apply the database migration
In the Supabase dashboard → **SQL Editor**, paste and run the contents of `supabase/migrations/0001_init.sql`. This creates all tables, enables RLS, adds role-based policies, and wires up the `profiles` auto-create trigger on signup.

Optionally, run `supabase/seed.sql` afterward for demo brand/product/persona rows (safe to skip — never runs automatically).

If you use the Supabase CLI instead:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 4. Install and run
```bash
npm install
npm run dev
```
Open http://localhost:3000 — you'll be redirected to `/login`.

## 5. Create your first user
Use the "สร้างบัญชีใหม่" (sign up) form on the login page. Supabase sends a confirmation email by default — either confirm it, or in the Supabase dashboard under **Authentication → Providers → Email**, temporarily disable "Confirm email" for local testing. New users get `role = 'viewer'` automatically; promote yourself to `admin` by editing your row in the `profiles` table via the Supabase Table Editor.

## 6. Verify Phase 1 (Definition of Done items 1-2)
- [ ] Log in successfully
- [ ] Create a Product, confirm it appears in the list and persists after refresh
- [ ] Create a Persona, confirm it appears in the list
- [ ] Create a Knowledge Base item, confirm it appears in the list
- [ ] Confirm Command Center KPI tiles show the real counts (1 product, 1 persona, 1 knowledge item, etc.)

Then run:
```bash
npm run lint
npm run typecheck
```
Fix anything that surfaces — the code has not been compiled in this session, so first-run TypeScript/ESLint errors are possible (missing type export, import path typo, etc.). Report back and the next session will fix them and proceed to Phase 2 (Creative Factory / Ideas / Scripts).

## Project structure
```
app/(dashboard)/       Authenticated app shell + 12 nav sections
app/login/             Auth pages + server actions
app/auth/callback/     Supabase email-confirmation redirect handler
lib/supabase/          Browser + server Supabase client helpers
middleware.ts          Session refresh + route protection
supabase/migrations/   SQL schema + RLS
supabase/seed.sql       Optional demo data (manual only)
types/database.ts      Hand-written types matching the schema
```

## Roadmap
See `TODO.md`. Phases 2-6 (Creative Factory, Video Analyzer/ffmpeg/Creative Score, Performance/Winner Engine, Winner DNA/Learning Loop, Production Audit) are specced in `MASTER_PROMPT.md` and not yet built.

## Security notes already in place
- `SUPABASE_SERVICE_ROLE_KEY` is never imported into a client component; the helper that uses it (`createServiceRoleClient` in `lib/supabase/server.ts`) throws if called without the env var and is reserved for future background jobs, not request-time CRUD.
- All Phase 1 data access goes through the user's session, so Postgres RLS is the real enforcement layer, not app code.
- `.env.local` is gitignored; only `.env.example` (no real secrets) is committed.
