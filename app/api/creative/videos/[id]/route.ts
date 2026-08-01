import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: video, error: videoError } = await supabase.from('videos').select('*').eq('id', params.id).single();
  if (videoError || !video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  const { data: analysis } = await supabase
    .from('video_analysis')
    .select('*')
    .eq('video_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ video, analysis: analysis ?? null });
}
