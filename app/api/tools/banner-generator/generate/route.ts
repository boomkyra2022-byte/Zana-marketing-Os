import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { editImages, type ImageSize } from '@/lib/ai/image-gen';
import { buildAnalysisMessages, buildConceptImagePrompt, type ProductInfo } from '@/prompts/banner-generator';
import { uploadEditedClip, resignEditedClip } from '@/lib/supabase/storage';
import { AIProviderError, callOpenAIVisionJSON } from '@/lib/ai/openai';

// Banner/Ads Image Generator — v2, full two-phase rebuild per the user's own
// "E-Commerce Visual Director" system prompt (pasted in chat) and their
// explicit choice "สร้างเต็มรูปแบบ 2 ขั้นตอน (แนะนำ)" over the faster
// single-step option. Supersedes the v1 six-fixed-template batch tool
// entirely — this prompt is a strict superset (Source-of-Truth rules,
// compliance/claim guardrails, real graphic-design standards) and the user's
// own direct quality complaint about v1 output is exactly what it fixes.
//
// Two modes in ONE route (mode: 'analyze' | 'generate' in the POST body)
// rather than a second route.ts file — this project sits at Vercel Hobby's
// 12-function cap (see the still-unresolved dead-file warning in
// app/api/tools/flow-prompt/[id]/route.ts), so every new capability here
// must fold into the existing file, not add a new Serverless Function slot.
//
// mode: 'analyze' — text+vision call (gpt-4o family), sends product photos
//   + product facts, gets back a structured JSON list of proposed concepts.
//   Nothing is generated or saved yet — purely advisory, matches
//   [WORKFLOW] step 1 in the system prompt.
// mode: 'generate' — real image generation. Takes the concept(s) the user
//   picked (either straight from the analyze step, or typed directly for a
//   "Concept 1-9" request with no analysis first) and calls the image edit
//   endpoint once per concept (each concept is a distinct creative
//   direction, so it needs its own prompt — unlike v1's "N variations of one
//   template" batching). One history row per concept, reusing the existing
//   banner_generator_jobs table/columns as-is (its `template` column has no
//   CHECK constraint — see migration 0015 — so it now just holds the
//   concept's name instead of one of the old 6 fixed values).
export const runtime = 'nodejs';
export const maxDuration = 120;

const productInfoShape = {
  product_name: z.string().min(1, 'กรุณาใส่ชื่อสินค้า').max(200),
  category: z.string().max(200).optional(),
  selling_points: z.string().max(1000).optional(),
  on_pack_text: z.string().max(1000).optional(),
  age_size_qty: z.string().max(200).optional(),
  registration_info: z.string().max(200).optional(),
  price_or_promo: z.string().max(200).optional(),
  marketplace: z.string().max(100).optional(),
  aspect_ratio: z.string().max(20).optional(),
  prohibitions: z.string().max(500).optional(),
  // Product photos as data URLs — same base64-in-JSON pattern used
  // throughout this app (Video Analyzer frames, v1 banner reference_images).
  reference_images: z.array(z.string().min(1)).max(3).default([])
};

const analyzeSchema = z.object({
  mode: z.literal('analyze'),
  ...productInfoShape,
  concept_count: z.number().int().min(1).max(9).default(9)
});

const conceptSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200),
  funnel_stage: z.string().max(50).optional(),
  description: z.string().min(1).max(1000)
});

const generateSchema = z.object({
  mode: z.literal('generate'),
  ...productInfoShape,
  concepts: z.array(conceptSchema).min(1).max(9),
  versions_per_concept: z.number().int().min(1).max(3).default(1),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1024'),
  style_reference: z.string().optional()
});

const requestSchema = z.discriminatedUnion('mode', [analyzeSchema, generateSchema]);

const MAX_TOTAL_REQUEST_BYTES = 4 * 1024 * 1024; // stay under Vercel's 4.5MB body cap with headroom

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new AIProviderError('รูปแบบไฟล์ภาพอ้างอิงไม่ถูกต้อง', 400);
  }
  return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] };
}

function toProductInfo(input: { product_name: string; category?: string; selling_points?: string; on_pack_text?: string; age_size_qty?: string; registration_info?: string; price_or_promo?: string; marketplace?: string; aspect_ratio?: string; prohibitions?: string }): ProductInfo {
  return {
    productName: input.product_name,
    category: input.category,
    sellingPoints: input.selling_points,
    onPackText: input.on_pack_text,
    ageSizeQty: input.age_size_qty,
    registrationInfo: input.registration_info,
    priceOrPromo: input.price_or_promo,
    marketplace: input.marketplace,
    aspectRatio: input.aspect_ratio,
    prohibitions: input.prohibitions
  };
}

const analysisResultSchema = z.object({
  product_summary: z.string(),
  selling_points: z.array(z.string()).default([]),
  bottlenecks: z.array(z.string()).default([]),
  concepts: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        funnel_stage: z.string().optional(),
        description: z.string(),
        priority: z.number().optional()
      })
    )
    .min(1),
  top_priority_ids: z.array(z.number()).default([])
});

// Re-signs expired history result URLs (24h TTL, same pattern as every
// other tool's history — see lib/supabase/storage.ts).
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

  const refBytesEstimate = input.reference_images.reduce((sum, s) => sum + s.length * 0.75, 0);
  if (refBytesEstimate > MAX_TOTAL_REQUEST_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ภาพอ้างอิงรวมกันใหญ่เกินไป — ลองใช้ภาพที่มีขนาดเล็กลง' }, { status: 413 });
  }

  // ── Mode 1: analyze — text+vision call, no images generated, nothing saved ──
  if (input.mode === 'analyze') {
    if (input.reference_images.length === 0) {
      return NextResponse.json({ error: 'กรุณาแนบภาพสินค้าอย่างน้อย 1 ภาพก่อนวิเคราะห์' }, { status: 400 });
    }
    try {
      const productInfo = toProductInfo(input);
      const { system, user: userMsg } = buildAnalysisMessages(productInfo, input.concept_count);
      // No explicit model override — same convention as the Video Analyzer's
      // own callOpenAIVisionJSON usage (app/api/creative/videos/import/route.ts):
      // falls back to AI_MODEL env var, then gpt-4o-mini (vision-capable),
      // so this doesn't require a new env var the user would have to set.
      const { text } = await callOpenAIVisionJSON({
        system,
        user: userMsg,
        images: input.reference_images,
        temperature: 0.6,
        timeoutMs: 90000
      });

      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new AIProviderError('AI ตอบกลับไม่ใช่ JSON ที่ถูกต้อง ลองใหม่อีกครั้ง', 502);
      }
      const result = analysisResultSchema.safeParse(raw);
      if (!result.success) {
        throw new AIProviderError('AI ตอบกลับรูปแบบไม่ตรงตามที่กำหนด ลองใหม่อีกครั้ง', 502);
      }

      return NextResponse.json({ analysis: result.data });
    } catch (err: any) {
      if (err instanceof AIProviderError) {
        return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
      }
      return NextResponse.json({ error: err?.message || 'วิเคราะห์ไม่สำเร็จ' }, { status: 500 });
    }
  }

  // ── Mode 2: generate — one real image-edit call per selected concept ──
  if (input.reference_images.length === 0) {
    return NextResponse.json({ error: 'กรุณาแนบภาพสินค้าจริงอย่างน้อย 1 ภาพก่อนสร้าง — ระบบต้องใช้เป็น Source of Truth' }, { status: 400 });
  }

  const styleBytesEstimate = input.style_reference ? input.style_reference.length * 0.75 : 0;
  if (refBytesEstimate + styleBytesEstimate > MAX_TOTAL_REQUEST_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ภาพอ้างอิงรวมกันใหญ่เกินไป — ลองใช้ภาพที่มีขนาดเล็กลง' }, { status: 413 });
  }

  try {
    const productInfo = toProductInfo(input);

    const productRefImages = input.reference_images.map((dataUrl, i) => {
      const { buffer, contentType } = decodeDataUrl(dataUrl);
      return { buffer, contentType, filename: `ref_${i}.png` };
    });
    const styleRefImage = input.style_reference ? decodeDataUrl(input.style_reference) : null;
    const allReferenceImages = styleRefImage
      ? [...productRefImages, { buffer: styleRefImage.buffer, contentType: styleRefImage.contentType, filename: 'style_ref.png' }]
      : productRefImages;

    // Each concept is its own creative direction → its own prompt → its own
    // API call, run in parallel to keep total wall-clock time reasonable
    // within the route's maxDuration even when the user asks for all 9.
    // allSettled (not all) deliberately — up to 9 simultaneous OpenAI image
    // calls can hit per-org rate limits, and one throttled/failed concept
    // must not wipe out the other 8 that succeeded.
    const settled = await Promise.allSettled(
      input.concepts.map(async (concept) => {
        const prompt = buildConceptImagePrompt(productInfo, {
          id: concept.id,
          name: concept.name,
          funnelStage: concept.funnel_stage,
          description: concept.description
        });
        const buffers = await editImages({
          prompt,
          n: input.versions_per_concept,
          size: input.size as ImageSize,
          referenceImages: allReferenceImages,
          inputFidelity: 'high'
        });
        const uploaded = await Promise.all(
          buffers.map((buf, i) => uploadEditedClip(buf, `banner_${randomUUID()}_${i}.png`, 'image/png'))
        );

        const { data: saved, error: insertError } = await supabase
          .from('banner_generator_jobs')
          .insert({
            product_name: input.product_name,
            template: concept.name,
            price_or_promo: input.price_or_promo || null,
            theme: concept.funnel_stage || null,
            extra_notes: concept.description || null,
            image_count: uploaded.length,
            result_paths: uploaded.map((u) => u.path),
            creator_id: user.id
          })
          .select('id, created_at')
          .single();

        return {
          concept_id: concept.id,
          concept_name: concept.name,
          job_id: insertError ? null : saved?.id ?? null,
          created_at: saved?.created_at ?? new Date().toISOString(),
          signed_urls: uploaded.map((u) => u.signedUrl)
        };
      })
    );

    const results = settled
      .map((r, i) =>
        r.status === 'fulfilled'
          ? r.value
          : { concept_id: input.concepts[i].id, concept_name: input.concepts[i].name, job_id: null, created_at: new Date().toISOString(), signed_urls: [], error: (r.reason as any)?.message || 'สร้างภาพ Concept นี้ไม่สำเร็จ' }
      );

    const anySucceeded = results.some((r) => r.signed_urls.length > 0);
    if (!anySucceeded) {
      const firstError = results.find((r: any) => r.error)?.error as string | undefined;
      return NextResponse.json({ error: firstError || 'สร้างภาพไม่สำเร็จทุก Concept' }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    if (err instanceof AIProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    return NextResponse.json({ error: err?.message || 'สร้างภาพไม่สำเร็จ' }, { status: 500 });
  }
}
