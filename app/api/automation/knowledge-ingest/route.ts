import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Automation ingest endpoint — explicit user request: run competitor-ad
// intelligence on a weekly schedule (Cowork scheduled task running the
// team's existing "spy"/"competitor-intel" skill) and have the result land
// directly in ZANA's Knowledge Base, not just as a chat message that gets
// lost. A scheduled task is a fresh, unauthenticated process outside any
// user's browser session, so it can't carry a Supabase user JWT the way
// every other route in this app does — this route is the one deliberate
// exception that uses the service-role client (bypasses RLS on purpose,
// see lib/supabase/server.ts's createServiceRoleClient, already used
// elsewhere for background jobs/team management) and authenticates instead
// via a separate shared secret (AUTOMATION_INGEST_KEY), never the Supabase
// keys themselves. Rotate that secret any time by changing the env var —
// it isn't tied to anything else in the app.
//
// Scoped deliberately narrow: only inserts new knowledge_items rows, only
// two `type` values relevant to this use case. No update/delete, no other
// table. If this needs to do more later, extend the schema below rather
// than loosening the auth check.
export const runtime = 'nodejs';

const requestSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(20000),
  type: z.enum(['MARKET_INSIGHT', 'CREATIVE_PATTERN']).default('MARKET_INSIGHT'),
  tags: z.array(z.string().max(50)).max(20).default([]),
  source: z.string().max(300).optional()
});

export async function POST(request: Request) {
  const expectedKey = process.env.AUTOMATION_INGEST_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: 'AUTOMATION_INGEST_KEY is not configured on the server' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization') || '';
  const providedKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('knowledge_items')
      .insert({
        title: input.title,
        type: input.type,
        content: input.content,
        tags: input.tags,
        source: input.source || 'automation:competitor-spy',
        status: 'active'
      })
      .select('id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, created_at: data.created_at });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Insert failed' }, { status: 500 });
  }
}
