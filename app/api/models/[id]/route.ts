import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

export const runtime = 'nodejs';

// Partial update — also how "Archive Preset" works (PATCH { active: false }),
// per the spec (no hard delete for Model Presets, only archive).
const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['founder', 'ai_model', 'custom']).optional(),
  reference_images: z.array(z.string()).max(5).optional(),
  locked_features: z.array(z.string()).optional(),
  editable_features: z.array(z.string()).optional(),
  identity_lock: z.boolean().optional(),
  identity_prompt: z.string().max(2000).nullable().optional(),
  negative_prompt: z.string().max(2000).nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  active: z.boolean().optional()
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('model_presets').select('*').eq('id', params.id).single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'ไม่พบ Model Preset นี้' }, { status: 404 });
  return NextResponse.json({ model: data });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Real bug found via live user testing: same root cause as app/api/
  // models/route.ts — a 'viewer' account's UPDATE gets silently filtered to
  // 0 rows by RLS (model_presets_update requires current_role() <>
  // 'viewer'), and `.single()` then throws the raw, meaningless "Cannot
  // coerce the result to a single JSON object" straight to the UI instead
  // of a message the user can act on. Check the role explicitly first.
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
  const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
  if (input.reference_images) {
    patch.master_reference = input.reference_images[0] ?? null;
    if (!('thumbnail' in input)) patch.thumbnail = input.reference_images[0] ?? null;
  }

  const { data, error } = await supabase.from('model_presets').update(patch).eq('id', params.id).select('*').single();
  if (error) {
    // Defensive fallback in case some OTHER RLS/row-matching condition still
    // produces this same 0-rows PostgREST error (e.g. a stale/deleted id) —
    // don't leak the raw Postgres message for this specific known pattern.
    const friendly = error.message?.includes('Cannot coerce the result to a single JSON object')
      ? 'บันทึกไม่สำเร็จ — ไม่พบ Model Preset นี้ หรือบัญชีนี้ไม่มีสิทธิ์แก้ไข'
      : error.message;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: input.active === false ? 'model_preset_archive' : input.active === true ? 'model_preset_restore' : 'model_preset_update',
    entity_type: 'model_preset',
    entity_id: params.id,
    new_value: input,
    reason: `แก้ไข Model Preset: ${data.name}`
  });

  return NextResponse.json({ model: data });
}
