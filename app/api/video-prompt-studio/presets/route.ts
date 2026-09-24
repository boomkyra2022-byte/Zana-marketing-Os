import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

// AI Video Prompt Studio — 1-click presets (spec doc section 13). Same
// GET+POST-in-one-file pattern as app/api/creative/prompt-studio-presets/
// route.ts, so this feature stays at a fixed +1 function regardless of how
// many presets exist (the 5 seeded ones live as data in
// 0023_video_prompt_studio.sql, not as client-side branches).
export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  variables: z.record(z.any())
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('video_prompt_presets')
    .select('*')
    .order('is_system_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presets: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const guard = await requireNonViewer(supabase, user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: 403 });

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

  // User-saved presets never claim to be the system default — that flag is
  // reserved for the 5 seeded rows so the picker's "recommended first" spot
  // stays stable regardless of how many personal presets people save.
  const { data, error } = await supabase
    .from('video_prompt_presets')
    .insert({ name: input.name, variables: input.variables, is_system_default: false, created_by: user.id })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ preset: data });
}
