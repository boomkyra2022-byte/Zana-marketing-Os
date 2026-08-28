import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { editImages, generateImages, type ImageSize } from '@/lib/ai/image-gen';
import { buildBannerPrompt, type BannerTemplate } from '@/prompts/banner-generator';
import { uploadEditedClip, resignEditedClip } from '@/lib/supabase/storage';
import { AIProviderError } from '@/lib/ai/openai';

// Banner/Ads Image Generator — explicit user request, prompts ported from
// the team's own prompt library (see prompts/banner-generator.ts for the
// doc link). Single file, one Serverless Function slot — this project sits
// at Vercel Hobby's 12-function cap, see the dead-file warning in
// app/api/tools/flow-prompt/[id]/route.ts. That file MUST be deleted before
// this route can safely go live, or the deploy will exceed the cap.
export const runtime = 'nodejs';
export const maxDuration = 120;

const TEMPLATE_VALUES: [BannerTemplate, ...BannerTemplate[]] = ['product_ad', 'awareness', 'conversion', 'ecommerce', 'social_proof', 'theme'];

const requestSchema = z.object({
  product_name: z.string().min(1, 'กรุณาใส่ชื่อสินค้า').max(200),
  template: z.enum(TEMPLATE_VALUES),
  price_or_promo: z.string().max(200).optional(),
  theme: z.string().max(200).optional(),
  extra_notes: z.string().max(500).optional(),
  count: z.number().int().min(1).max(10),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1024'),
  // Reference photos as data URLs (data:image/png;base64,....) — small
  // product photos only (a few MB each), same base64-in-JSON pattern
  // already used by the Video Analyzer's frame extraction
  // (app/api/creative/videos/import/route.ts: imageDataUrls). Capped below
  // to stay well under Vercel's 4.5MB request body limit.
  reference_images: z.array(z.string().min(1)).max(3).default([]),
  // Extra screenshot for the social_proof template — kept separate from
  // reference_images so the prompt/UI can be explicit about what each one is.
  review_screenshot: z.string().optional()
});

const MAX_TOTAL_REQUEST_BYTES = 4 * 1024 * 1024; // stay under Vercel's 4.5MB body cap with headroom

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new AIProviderError('รูปแบบไฟล์ภาพอ้างอิงไม่ถูกต้อง', 400);
  }
  return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] };
}

// Re-signs expired history result URLs (24h TTL, same pattern as every
// other tool's history — see lib/supabase/storage.ts). Returns ALL paths
// for the job since one job can have up to 10 images.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get('resign');
  if (!jobId) return NextResponse.json({ error: 'Missing resign id' }, { status: 400 });

  const { data, error } = await supabase.from('banner_generator_jobs').select('result_paths').eq('id', jobId).single();
  if (error || !data?.result_paths?.length) return NextResponse.json({ error: 'ไม่พบภาพนี้' }, { status: 404 });

  try {
    const signedUrls = await Promise.all(data.result_paths.map((p: string) => resignEditedClip(p)));
    return NextResponse.json({ signed_urls: signedUrls });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'สร้างลิงก์ใหม่ไม่สำเร็จ' }, { status: 500 });
  }
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  const input = parsed.data;

  if (input.template === 'social_proof' && !input.review_screenshot) {
    return NextResponse.json({ error: 'เทมเพลต Social Proof ต้องแนบ Screenshot รีวิวจริงก่อน' }, { status: 400 });
  }
  if (input.template === 'theme' && !input.theme?.trim()) {
    return NextResponse.json({ error: 'กรุณาระบุธีม/เทศกาล' }, { status: 400 });
  }

  const allRefsRaw = [...input.reference_images, ...(input.review_screenshot ? [input.review_screenshot] : [])];
  const totalBytesEstimate = allRefsRaw.reduce((sum, s) => sum + s.length * 0.75, 0);
  if (totalBytesEstimate > MAX_TOTAL_REQUEST_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ภาพอ้างอิงรวมกันใหญ่เกินไป — ลองใช้ภาพที่มีขนาดเล็กลง' }, { status: 413 });
  }

  try {
    const prompt = buildBannerPrompt(input.template, {
      productName: input.product_name,
      priceOrPromo: input.price_or_promo,
      theme: input.theme,
      hasReviewShot: Boolean(input.review_screenshot),
      extraNotes: input.extra_notes
    });

    const referenceImages = allRefsRaw.map((dataUrl, i) => {
      const { buffer, contentType } = decodeDataUrl(dataUrl);
      return { buffer, contentType, filename: `ref_${i}.png` };
    });

    const resultBuffers =
      referenceImages.length > 0
        ? await editImages({ prompt, n: input.count, size: input.size as ImageSize, referenceImages })
        : await generateImages({ prompt, n: input.count, size: input.size as ImageSize });

    const uploaded = await Promise.all(
      resultBuffers.map((buf, i) => uploadEditedClip(buf, `banner_${randomUUID()}_${i}.png`, 'image/png'))
    );

    const { data: saved, error: insertError } = await supabase
      .from('banner_generator_jobs')
      .insert({
        product_name: input.product_name,
        template: input.template,
        price_or_promo: input.price_or_promo || null,
        theme: input.theme || null,
        extra_notes: input.extra_notes || null,
        image_count: uploaded.length,
        result_paths: uploaded.map((u) => u.path),
        creator_id: user.id
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({
        signed_urls: uploaded.map((u) => u.signedUrl),
        job_id: null,
        warning: 'สร้างภาพสำเร็จ แต่บันทึกประวัติไม่สำเร็จ'
      });
    }

    return NextResponse.json({
      signed_urls: uploaded.map((u) => u.signedUrl),
      job_id: saved.id,
      created_at: saved.created_at
    });
  } catch (err: any) {
    if (err instanceof AIProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    return NextResponse.json({ error: err?.message || 'สร้างภาพไม่สำเร็จ' }, { status: 500 });
  }
}
