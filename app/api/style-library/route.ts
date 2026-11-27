import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireNonViewer } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { STYLE_CODES, STYLE_DEMO_BUCKET } from '@/lib/style-library/types';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  code: z.enum(STYLE_CODES),
  order_template: z.string().trim().min(1).max(20000),
});

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const [styles, demos, access] = await Promise.all([
    supabase.from('video_styles').select('*').order('sort').order('code'),
    supabase.from('style_demos').select('*').order('created_at', { ascending: false }),
    requireNonViewer(supabase, user.id),
  ]);
  if (styles.error || demos.error) {
    return NextResponse.json({ error: styles.error?.message ?? demos.error?.message }, { status: 500 });
  }

  const bucket = supabase.storage.from(STYLE_DEMO_BUCKET);
  const rows = demos.data ?? [];
  const paths = rows.flatMap(({ video_path, poster_path }) => [video_path, poster_path]);
  const signed = paths.length ? await bucket.createSignedUrls(paths, 3600) : null;
  if (signed?.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });

  const urls = new Map(signed?.data?.map(({ path, signedUrl }) => [path, signedUrl]));
  return NextResponse.json({
    styles: styles.data ?? [],
    canWrite: access.ok,
    demos: rows.map(({ video_path, poster_path, ...demo }) => ({
      ...demo,
      video_url: urls.get(video_path) || null,
      poster_url: urls.get(poster_path) || null,
    })),
  });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: 403 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลคำสั่งไม่ถูกต้อง' }, { status: 400 });

  const { code, order_template } = parsed.data;
  const { data, error } = await supabase.from('video_styles')
    .update({ order_template, updated_at: new Date().toISOString() })
    .eq('code', code).select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'ไม่พบสไตล์' }, { status: 404 });
  return NextResponse.json({ style: data });
}
