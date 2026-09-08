import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Prompt Studio — "บันทึกเป็น Preset" (save/load a full block configuration).
// GET + POST in one route.ts (same file, different HTTP methods) rather
// than splitting into separate routes, keeping this project's function
// count down the same way every other dual-purpose route here does.
export const runtime = 'nodejs';

const blockStateSchema = z.object({ enabled: z.boolean(), text: z.string().max(2000) });

const createSchema = z.object({
  name: z.string().min(1).max(200),
  mode: z.string().max(50).default('visual_hook_banner'),
  blocks: z.record(blockStateSchema)
});

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mode = new URL(request.url).searchParams.get('mode') || 'visual_hook_banner';
  const { data, error } = await supabase.from('prompt_studio_presets').select('*').eq('mode', mode).order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presets: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    .from('prompt_studio_presets')
    .insert({ name: input.name, mode: input.mode, blocks: input.blocks, created_by: user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ preset: data });
}
