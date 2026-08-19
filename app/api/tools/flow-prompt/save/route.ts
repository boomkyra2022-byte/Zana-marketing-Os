import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// FLOW PROMPT DIRECTOR — lightweight save endpoint. No AI call: used for
// (a) the SAVE PROJECT button (project name / status), (b) persisting
// manual text edits made directly inside a PART's prompt_text textarea
// ([EDIT] action), and (c) persisting Lock toggle state. Kept separate from
// /generate so trivial saves don't burn an OpenAI call.
export const runtime = 'nodejs';
export const maxDuration = 30;

const requestSchema = z.object({
  id: z.string().uuid(),
  project_name: z.string().nullable().optional(),
  parts: z.array(z.any()).optional(),
  locks: z.object({ parts: z.array(z.number().int()) }).optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'SAVED']).optional()
});

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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.project_name !== undefined) updatePayload.project_name = input.project_name;
  if (input.parts !== undefined) updatePayload.parts = input.parts;
  if (input.locks !== undefined) updatePayload.locks = input.locks;
  if (input.status !== undefined) updatePayload.status = input.status;

  const { data: saved, error } = await supabase.from('flow_prompts').update(updatePayload).eq('id', input.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ flow_prompt: saved });
}
