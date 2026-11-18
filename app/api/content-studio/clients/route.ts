import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

// Content Studio — client Brand Cards. GET/POST/PATCH/DELETE in one route.ts
// (id in the body for PATCH/DELETE) to keep the Vercel function count down,
// same reasoning as prompt-library/route.ts.
export const runtime = 'nodejs';

const text = z.string().max(20000).nullable().optional();
const cardSchema = z.object({
  name: z.string().min(1).max(200),
  business: text,
  audience: text,
  pains: text,
  usp: text,
  positioning: text,
  offer: text,
  voice: text,
  pillars: text,
  cta: text,
  banned: text,
  examples: text,
  notes: text
});

async function auth() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase.from('studio_clients').select('*').order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  const parsed = cardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ครบ: ต้องมีชื่อแบรนด์', details: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from('studio_clients')
    .insert({ ...parsed.data, created_by: user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = z.string().uuid().safeParse(body?.id);
  const parsed = cardSchema.safeParse(body);
  if (!id.success || !parsed.success) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const { data, error } = await supabase
    .from('studio_clients')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id.data)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ client: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await auth();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  const id = z.string().uuid().safeParse((await request.json().catch(() => null))?.id);
  if (!id.success) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 400 });
  // studio_posts rows go with it (on delete cascade).
  const { error } = await supabase.from('studio_clients').delete().eq('id', id.data);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
