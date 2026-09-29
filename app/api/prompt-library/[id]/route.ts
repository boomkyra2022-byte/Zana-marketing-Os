import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

export const runtime = 'nodejs';

const patchSchema = z.object({
  group_name: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(300).optional(),
  use_case: z.string().max(1000).nullable().optional(),
  tool_name: z.string().max(200).nullable().optional(),
  aspect_ratio: z.string().max(100).nullable().optional(),
  prompt_template: z.string().min(1).max(20000).optional(),
  notes: z.string().max(2000).nullable().optional(),
  source_url: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().optional(),
  is_favorite: z.boolean().optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const { data, error } = await supabase
    .from('prompt_library')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*')
    .single();
  if (error) {
    const friendly = error.message?.includes('Cannot coerce the result to a single JSON object')
      ? 'บันทึกไม่สำเร็จ — ไม่พบ Prompt นี้ หรือบัญชีนี้ไม่มีสิทธิ์แก้ไข'
      : error.message;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'prompt_library_update',
    entity_type: 'prompt_library',
    entity_id: params.id,
    new_value: input,
    reason: `แก้ไข Prompt: ${data.title}`
  });

  return NextResponse.json({ prompt: data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  const { data: existing } = await supabase.from('prompt_library').select('title').eq('id', params.id).maybeSingle();

  const { error } = await supabase.from('prompt_library').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'prompt_library_delete',
    entity_type: 'prompt_library',
    entity_id: params.id,
    reason: `ลบ Prompt: ${existing?.title ?? params.id}`
  });

  return NextResponse.json({ ok: true });
}
