import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireNonViewer } from '@/lib/auth/guards';

// Prompt Library — explicit user request to keep reusable AI prompts (video
// edit / image / video-structure prompts found on the web, or written
// in-house) as a searchable, fill-in-and-copy knowledge base rather than
// losing them in chat history. GET + POST in one route.ts, same dual-purpose
// pattern as models/route.ts, to keep the Vercel function count down.
export const runtime = 'nodejs';

const createSchema = z.object({
  group_name: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  use_case: z.string().max(1000).nullable().optional(),
  tool_name: z.string().max(200).nullable().optional(),
  aspect_ratio: z.string().max(100).nullable().optional(),
  prompt_template: z.string().min(1).max(20000),
  notes: z.string().max(2000).nullable().optional(),
  source_url: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().default(0)
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('prompt_library')
    .select('*')
    .order('group_name', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prompts: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Same explicit role check as models/route.ts — prevents the raw "Cannot
  // coerce the result to a single JSON object" PostgREST error from leaking
  // to a viewer-role account whose write RLS silently blocks to 0 rows.
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
    .from('prompt_library')
    .insert({
      group_name: input.group_name,
      title: input.title,
      use_case: input.use_case || null,
      tool_name: input.tool_name || null,
      aspect_ratio: input.aspect_ratio || null,
      prompt_template: input.prompt_template,
      notes: input.notes || null,
      source_url: input.source_url || null,
      sort_order: input.sort_order,
      created_by: user.id
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_logs').insert({
    user_id: user.id,
    action: 'prompt_library_create',
    entity_type: 'prompt_library',
    entity_id: data.id,
    new_value: { title: input.title, group_name: input.group_name },
    reason: `เพิ่ม Prompt ใหม่ใน Prompt Library: ${input.title}`
  });

  return NextResponse.json({ prompt: data });
}
