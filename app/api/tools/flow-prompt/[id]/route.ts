// ⚠️ DEAD FILE — DELETE THIS FILE (and this now-empty [id] folder) BEFORE
// THE NEXT DEPLOY. Its logic was folded into `GET /api/tools/flow-prompt/
// generate` (query param `?id=`) to free up a Serverless Function slot for
// the new Voiceover tool — this project's deployment sits exactly at
// Vercel Hobby's 12-function cap, and leaving this file in place means the
// deploy will fail again with "No more than 12 Serverless Functions..."
// (same bug class as the earlier Flow Prompt Director postmortem). Both
// client call-sites (`flow-prompt-director-client.tsx`,
// `flow-prompt-client.tsx`) have already been updated to call the new
// `?id=` query-param path — nothing in the app calls this file anymore.
// No shell access this session to actually `rm` it — see TODO.md for the
// exact manual-delete command.
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.from('flow_prompts').select('*').eq('id', params.id).single();
  if (error || !data) return Response.json({ error: 'ไม่พบชุด prompt นี้' }, { status: 404 });

  return Response.json({ flow_prompt: data });
}
