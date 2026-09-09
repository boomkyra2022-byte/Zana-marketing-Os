import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

// Model Library — explicit spec: independent from Product (no FK), reusable
// across any product/mode. GET + POST in one route.ts, same dual-purpose
// pattern as prompt-studio-presets/route.ts, keeping the Vercel function
// count down.
export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['founder', 'ai_model', 'custom']).default('custom'),
  reference_images: z.array(z.string()).max(5).default([]),
  locked_features: z.array(z.string()).default([]),
  editable_features: z.array(z.string()).default([]),
  identity_lock: z.boolean().default(true),
  identity_prompt: z.string().max(2000).nullable().optional(),
  negative_prompt: z.string().max(2000).nullable().optional(),
  thumbnail: z.string().nullable().optional()
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('model_presets').select('*').order('active', { ascending: false }).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ models: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Real bug found via live user testing: a 'viewer'-role account got the
  // raw PostgREST error "Cannot coerce the result to a single JSON object"
  // when trying to save — RLS correctly blocked the write (model_presets_
  // write requires current_role() <> 'viewer'), but that just makes the
  // INSERT...RETURNING affect 0 rows, and `.single()` throws that cryptic
  // message instead of anything the user can act on. Check explicitly first.
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const { data, error } = await supabase
    .from('model_presets')
    .insert({
      name: input.name,
      type: input.type,
      reference_images: input.reference_images,
      master_reference: input.reference_images[0] ?? null,
      thumbnail: input.thumbnail ?? input.reference_images[0] ?? null,
      locked_features: input.locked_features,
      editable_features: input.editable_features,
      identity_lock: input.identity_lock,
      identity_prompt: input.identity_prompt || null,
      negative_prompt: input.negative_prompt || null,
      created_by: user.id
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'model_preset_create',
    entity_type: 'model_preset',
    entity_id: data.id,
    new_value: { name: input.name, type: input.type },
    reason: `สร้าง Model Preset: ${input.name}`
  });

  return NextResponse.json({ model: data });
}
