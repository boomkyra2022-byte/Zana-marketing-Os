import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

// Content Studio — per-client content library. POST saves a generated piece,
// PATCH edits text/status, DELETE removes one. Reads happen server-side in
// the page (app/(dashboard)/content-studio/page.tsx).
export const runtime = 'nodejs';

const retentionSchema = z
  .object({
    score: z.number().min(0).max(10),
    checks: z.array(z.object({ name: z.string(), pass: z.boolean(), fix: z.string().optional().default('') }))
  })
  .nullable()
  .optional();

const createSchema = z.object({
  client_id: z.string().uuid(),
  format: z.string().min(1).max(50),
  funnel: z.enum(['tofu', 'mofu', 'bofu']).nullable().optional(),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(30000),
  topic: z.string().max(1000).nullable().optional(),
  retention: retentionSchema,
  status: z.enum(['draft', 'approved', 'used']).default('draft'),
  // migration 0033: ideas split from a brief start as "waiting for real work"
  production: z.enum(['waiting', 'received']).nullable().optional(),
  parent_id: z.string().uuid().nullable().optional()
});

const patchSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1).max(30000).optional(),
  title: z.string().min(1).max(300).optional(),
  status: z.enum(['draft', 'approved', 'used']).optional(),
  production: z.enum(['waiting', 'received']).nullable().optional(),
  production_note: z.string().max(4000).nullable().optional()
});

// Column missing = migration 0033 not run yet; say so instead of the raw error.
function dbError(message: string) {
  if (/production|parent_id/i.test(message) && /column|schema cache/i.test(message)) {
    return 'ยังไม่ได้รัน migration 0033_studio_production.sql ใน Supabase SQL Editor (ต้องใช้กับสถานะรอผลงานจริง)';
  }
  return message;
}

async function guard() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return { error: NextResponse.json({ error: access.message }, { status: 403 }) } as const;
  return { supabase, user } as const;
}

export async function POST(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await g.supabase
    .from('studio_posts')
    .insert({ ...parsed.data, created_by: g.user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: dbError(error.message) }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function PATCH(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  const { id, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (rest.status === 'used') update.used_at = new Date().toISOString();
  if (rest.production) update.production_at = new Date().toISOString();

  const { data, error } = await g.supabase.from('studio_posts').update(update).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: dbError(error.message) }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(request: Request) {
  const g = await guard();
  if ('error' in g) return g.error;
  const id = z.string().uuid().safeParse((await request.json().catch(() => null))?.id);
  if (!id.success) return NextResponse.json({ error: 'ไม่พบชิ้นงาน' }, { status: 400 });
  const { error } = await g.supabase.from('studio_posts').delete().eq('id', id.data);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
