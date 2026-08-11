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
