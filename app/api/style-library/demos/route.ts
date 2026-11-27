import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireNonViewer } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import {
  DEMO_PURPOSES, DEMO_STATUSES, STYLE_CODES, STYLE_DEMO_BUCKET,
} from '@/lib/style-library/types';

const demoFields = z.object({
  title: z.string().trim().min(1).max(200),
  brand: z.string().trim().min(1).max(120),
  purpose: z.enum(DEMO_PURPOSES),
  notes: z.string().trim().max(2000).nullable(),
});
const idSchema = z.object({ id: z.string().uuid() });
const postSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare') }),
  demoFields.extend({
    action: z.literal('complete'),
    id: idSchema.shape.id,
    style_code: z.enum(STYLE_CODES),
    duration_s: z.number().positive().finite(),
  }),
]);
const patchSchema = demoFields.partial().extend({
  id: idSchema.shape.id,
  status: z.enum(DEMO_STATUSES).optional(),
}).refine(({ id, ...fields }) => Object.keys(fields).length > 0);

function fail(error: string, status = 500) {
  return NextResponse.json({ error }, { status });
}

async function authorize() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: fail('กรุณาเข้าสู่ระบบ', 401) };
  const access = await requireNonViewer(supabase, user.id);
  if (!access.ok) return { response: fail(access.message, 403) };
  return { supabase, user };
}

export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const { supabase, user } = auth;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('ข้อมูลคลิปไม่ถูกต้อง', 400);

  const bucket = supabase.storage.from(STYLE_DEMO_BUCKET);
  const input = parsed.data;
  const id = input.action === 'prepare' ? crypto.randomUUID() : input.id;
  const folder = [user.id, id].join('/');
  const videoPath = folder + '/video.mp4';
  const posterPath = folder + '/poster.jpg';

  if (input.action === 'prepare') {
    const [video, poster] = await Promise.all([
      bucket.createSignedUploadUrl(videoPath),
      bucket.createSignedUploadUrl(posterPath),
    ]);
    if (video.error || poster.error) return fail(video.error?.message ?? poster.error!.message);
    return NextResponse.json({ id, video: video.data, poster: poster.data });
  }

  const { data: objects, error: listError } = await bucket.list(folder);
  if (listError) return fail(listError.message);
  const video = objects?.find((object) => object.name === 'video.mp4');
  const poster = objects?.find((object) => object.name === 'poster.jpg');
  if (video?.metadata?.mimetype !== 'video/mp4' || poster?.metadata?.mimetype !== 'image/jpeg') {
    return fail('กรุณาอัปโหลดวิดีโอ MP4 และภาพปก JPG ให้ครบ', 400);
  }

  const { action, ...fields } = input;
  const { error } = await supabase.from('style_demos').upsert({
    ...fields,
    video_path: videoPath,
    poster_path: posterPath,
    created_by: user.id,
  }, { onConflict: 'video_path', ignoreDuplicates: true });
  if (error) return fail(error.message);
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('ข้อมูลคลิปไม่ถูกต้อง', 400);

  const { id, ...fields } = parsed.data;
  const { data, error } = await auth.supabase.from('style_demos')
    .update(fields).eq('id', id).select('id').maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail('ไม่พบคลิป', 404);
  return NextResponse.json({ id });
}

export async function DELETE(request: Request) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const parsed = idSchema.safeParse({ id: new URL(request.url).searchParams.get('id') });
  if (!parsed.success) return fail('รหัสคลิปไม่ถูกต้อง', 400);

  const { data, error } = await auth.supabase.from('style_demos')
    .delete().eq('id', parsed.data.id).select('video_path,poster_path').maybeSingle();
  if (error) return fail(error.message);
  if (!data) return NextResponse.json({ deleted: true });

  const cleanup = await auth.supabase.storage.from(STYLE_DEMO_BUCKET)
    .remove([data.video_path, data.poster_path]);
  return NextResponse.json({
    deleted: true,
    warning: cleanup.error ? 'ลบออกจากคลังแล้ว แต่ลบไฟล์ใน Storage ไม่สำเร็จ' : null,
  });
}
