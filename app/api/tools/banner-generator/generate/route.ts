import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { editImages, type ImageSize } from '@/lib/ai/image-gen';
import { buildAnalysisMessages, buildConceptImagePrompt, findAdVisualStrategy, type FounderModelInfo, type ProductInfo } from '@/prompts/banner-generator';
import { uploadEditedClip, resignEditedClip, signLibraryPaths, downloadLibraryImages } from '@/lib/supabase/storage';
import { AIProviderError, callOpenAIVisionJSON } from '@/lib/ai/openai';
import { renderTextOverlay, compositeTextOverlay, hasAnyOverlayText, type TextOverlaySpec } from '@/lib/media/text-overlay';

// Real bug found via live user testing: reference photos used to be sent as
// base64 data URLs inline in this route's JSON body. With MAX_REF_IMAGES=3
// at up to 3MB each (client-side cap), base64 inflates that ~33%, so a
// couple of real product photos could push the raw request body past
// Vercel's hard 4.5MB-per-function limit (infra-level, not configurable).
// When that happens Vercel rejects the request BEFORE it reaches this
// handler at all, returning a plain-text platform error ("Request Entity
// Too Large") instead of JSON — which is why the client saw `Unexpected
// token 'R', "Request En"... is not valid JSON` instead of any error this
// route's own code could produce. Fixed by switching reference_images /
// style_reference to Storage PATHS (uploaded directly browser->Storage via
// the `library-uploads` bucket, same pattern as the Editor tool and the
// Model/Product Library) — the actual image bytes never touch this
// function's request body at all now, only short path strings do.

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

// Limits raised after a real user hit the wall: auto-filling from a
// Product + linked Knowledge Base entries (the "เลือกสินค้าจากคลัง" picker)
// can legitimately produce long selling-points/compliance text — a single
// Knowledge Base COMPLIANCE note plus the product's own banned_claims/
// compliance_notes easily exceeds a few hundred characters. Custom Thai
// messages so a future overflow shows something readable instead of zod's
// raw English "String must contain at most N character(s)".
const productInfoShape = {
  product_name: z.string().min(1, 'กรุณาใส่ชื่อสินค้า').max(200, 'ชื่อสินค้ายาวเกินไป (สูงสุด 200 ตัวอักษร)'),
  brand: z.string().max(100, 'ชื่อแบรนด์ยาวเกินไป (สูงสุด 100 ตัวอักษร)').optional(),
  category: z.string().max(200, 'ประเภทสินค้ายาวเกินไป (สูงสุด 200 ตัวอักษร)').optional(),
  selling_points: z.string().max(3000, 'จุดเด่นยาวเกินไป (สูงสุด 3000 ตัวอักษร) — ลองตัดข้อความที่ไม่จำเป็นออก').optional(),
  on_pack_text: z.string().max(1500, 'ข้อความบนแพ็กยาวเกินไป (สูงสุด 1500 ตัวอักษร)').optional(),
  age_size_qty: z.string().max(200, 'อายุ/ขนาด/ปริมาณยาวเกินไป (สูงสุด 200 ตัวอักษร)').optional(),
  registration_info: z.string().max(300, 'เลขจดแจ้ง/ข้อมูลอ้างอิงยาวเกินไป (สูงสุด 300 ตัวอักษร)').optional(),
  price_or_promo: z.string().max(300, 'ราคา/โปรโมชั่นยาวเกินไป (สูงสุด 300 ตัวอักษร)').optional(),
  marketplace: z.string().max(100).optional(),
  aspect_ratio: z.string().max(20).optional(),
  prohibitions: z.string().max(2000, 'ข้อห้ามยาวเกินไป (สูงสุด 2000 ตัวอักษร) — ลองตัดข้อความที่ไม่จำเป็นออก').optional(),
  // Product photos as `library-uploads` Storage paths (browser uploaded them
  // directly, see components/banner-generator-client.tsx) — NOT base64 data
  // URLs anymore, see the comment above on why that broke for real users.
  reference_images: z.array(z.string().min(1)).max(3).default([]),
  // A key into AD_VISUAL_STRATEGIES, never raw text — resolved server-side
  // via findAdVisualStrategy() so the actual instruction sent to the AI is
  // always this app's own fixed wording (explicit user request: "เพิ่ม
  // ตัวเลือกกลยุทธ์การทำภาพ ADS").
  ad_strategy_key: z.string().max(50).optional(),
  // Model Library id, never raw identity text — resolved server-side below
  // (same lookup pattern as ad_strategy_key) so a client can never spoof a
  // different founder's identity_prompt into the request body.
  model_preset_id: z.string().uuid().optional(),
  // Structured named text-copy fields — explicit follow-up request: "ถ้าจะ
  // ก๊อปไปควรเป็น Prompt ที่สามารถสร้างงานได้จริง...แบบครบองค์ประกอบหลัก". All
  // optional — blank means buildConceptImagePrompt() has the AI draft that
  // block instead (see prompts/banner-generator.ts's textBlock()).
  scene: z.string().max(1000).optional(),
  headline: z.string().max(300).optional(),
  main_message: z.string().max(500).optional(),
  guarantee_text: z.string().max(500).optional(),
  badge_text: z.string().max(300).optional(),
  cta_text: z.string().max(200).optional()
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
  // Storage path, not a data URL — same fix as reference_images above.
  style_reference: z.string().optional(),
  // Real fix for a real, disclosed limitation — explicit user report:
  // "รูปที่เจนได้มีปัญหาฟ้อนอ่านไม่ออก". When true, gpt-image-1 is told to
  // leave clean empty zones instead of drawing the Thai copy itself, and
  // this route composites the EXACT text (from headline/main_message/
  // guarantee_text/badge_text/cta_text above) on top afterward as crisp,
  // guaranteed-legible real typography — see lib/media/text-overlay.tsx.
  // Defaults true (the recommended path); the user can still opt out per
  // job if they specifically want the AI's own stylized lettering.
  render_text_overlay: z.boolean().default(true)
});

const requestSchema = z.discriminatedUnion('mode', [analyzeSchema, generateSchema]);

function toProductInfo(
  input: {
    product_name: string;
    brand?: string;
    category?: string;
    selling_points?: string;
    on_pack_text?: string;
    age_size_qty?: string;
    registration_info?: string;
    price_or_promo?: string;
    marketplace?: string;
    aspect_ratio?: string;
    prohibitions?: string;
    ad_strategy_key?: string;
    scene?: string;
    headline?: string;
    main_message?: string;
    guarantee_text?: string;
    badge_text?: string;
    cta_text?: string;
  },
  founderModel?: FounderModelInfo
): ProductInfo {
  return {
    productName: input.product_name,
    brand: input.brand,
    category: input.category,
    sellingPoints: input.selling_points,
    onPackText: input.on_pack_text,
    ageSizeQty: input.age_size_qty,
    registrationInfo: input.registration_info,
    priceOrPromo: input.price_or_promo,
    marketplace: input.marketplace,
    aspectRatio: input.aspect_ratio,
    prohibitions: input.prohibitions,
    adStrategy: findAdVisualStrategy(input.ad_strategy_key),
    founderModel,
    scene: input.scene,
    headline: input.headline,
    mainMessage: input.main_message,
    guaranteeText: input.guarantee_text,
    badgeText: input.badge_text,
    ctaText: input.cta_text
  };
}

interface ConceptResult {
  concept_id: number;
  concept_name: string;
  job_id: string | null;
  created_at: string;
  signed_urls: string[];
  error?: string;
  used_text_overlay?: boolean;
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

  // Ownership check — same defensive pattern as signSourceUpload() in
  // lib/supabase/storage.ts: a path must live under the caller's own uid
  // folder in the library-uploads bucket, so one user can't reference
  // another user's uploaded photo by guessing/sharing a path string.
  const allPaths = [...input.reference_images, ...(input.mode === 'generate' && input.style_reference ? [input.style_reference] : [])];
  const invalidPath = allPaths.find((p) => !p.startsWith(`${user.id}/`));
  if (invalidPath) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงไฟล์ภาพนี้' }, { status: 403 });
  }

  // ── Mode 1: analyze — text+vision call, no images generated, nothing saved ──
  if (input.mode === 'analyze') {
    if (input.reference_images.length === 0) {
      return NextResponse.json({ error: 'กรุณาแนบภาพสินค้าอย่างน้อย 1 ภาพก่อนวิเคราะห์' }, { status: 400 });
    }
    try {
      const productInfo = toProductInfo(input);
      const { system, user: userMsg } = buildAnalysisMessages(productInfo, input.concept_count);
      // Reference photos are signed Storage URLs now, not base64 — OpenAI's
      // vision API accepts a plain HTTPS image_url just as well as a data
      // URL, so there's no need to download+re-encode server-side here.
      const signed = await signLibraryPaths(input.reference_images);
      const images = input.reference_images.map((p) => signed[p]).filter((url): url is string => !!url);
      if (images.length === 0) {
        return NextResponse.json({ error: 'ไม่พบไฟล์ภาพที่อัปโหลด ลองแนบภาพใหม่อีกครั้ง' }, { status: 400 });
      }
      // No explicit model override — same convention as the Video Analyzer's
      // own callOpenAIVisionJSON usage (app/api/creative/videos/import/route.ts):
      // falls back to AI_MODEL env var, then gpt-4o-mini (vision-capable),
      // so this doesn't require a new env var the user would have to set.
      const { text } = await callOpenAIVisionJSON({
        system,
        user: userMsg,
        images,
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

  try {
    // Model Library lookup — explicit follow-up request: the copy-paste
    // prompt now has a real FOUNDER — SOURCE OF TRUTH section, which needs
    // the actual identity_prompt/locked/editable features from the chosen
    // Model Preset, and (same as Visual Hook Banner's own fix) the model's
    // real reference photo(s) fed into editImages() so Identity Lock is a
    // real pixel effect, not just prompt text.
    let founderModel: FounderModelInfo | undefined;
    let modelRefPaths: string[] = [];
    if (input.model_preset_id) {
      const { data: modelPreset } = await supabase
        .from('model_presets')
        .select('name, identity_prompt, locked_features, editable_features, reference_images')
        .eq('id', input.model_preset_id)
        .single();
      if (modelPreset) {
        founderModel = {
          name: modelPreset.name,
          identityPrompt: modelPreset.identity_prompt,
          lockedFeatures: modelPreset.locked_features || [],
          editableFeatures: modelPreset.editable_features || []
        };
        modelRefPaths = (modelPreset.reference_images || []).slice(0, 2);
      }
    }

    const productInfo = toProductInfo(input, founderModel);

    // Real fix for a real, disclosed limitation — explicit user report:
    // "รูปที่เจนได้มีปัญหาฟ้อนอ่านไม่ออก" (Thai text on AI-generated banners is
    // sometimes unreadable). Render the exact overlay text ONCE up front —
    // same headline/CTA/etc apply to every concept and every version in this
    // batch, so there's no reason to re-render it per image. If rendering
    // itself fails for any reason (e.g. a font-file tracing issue in a given
    // deploy), fall back to the old AI-drawn-text behavior instead of
    // hard-failing the whole generation — a regression here should degrade
    // gracefully, not break image generation entirely.
    const overlaySpec: TextOverlaySpec = {
      headline: input.headline,
      mainMessage: input.main_message,
      guarantee: input.guarantee_text,
      badge: input.badge_text,
      cta: input.cta_text
    };
    let useTextOverlay = input.render_text_overlay && hasAnyOverlayText(overlaySpec);
    let overlayBuffer: Buffer | null = null;
    if (useTextOverlay) {
      try {
        const [overlayW, overlayH] = input.size.split('x').map((n) => parseInt(n, 10));
        overlayBuffer = await renderTextOverlay(overlaySpec, overlayW, overlayH);
      } catch (overlayErr) {
        console.error('Text overlay render failed, falling back to AI-drawn text:', overlayErr);
        useTextOverlay = false;
        overlayBuffer = null;
      }
    }

    // Downloads happen server-side from Storage (service-role) — the actual
    // image bytes never travel through this route's own request body.
    const productRefImages = await downloadLibraryImages(input.reference_images);
    if (productRefImages.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ภาพสินค้าที่อัปโหลด ลองแนบภาพใหม่อีกครั้ง' }, { status: 400 });
    }
    const modelRefImages = modelRefPaths.length > 0 ? await downloadLibraryImages(modelRefPaths) : [];
    const styleRefImages = input.style_reference ? await downloadLibraryImages([input.style_reference]) : [];
    // Capped at 4 total — same gpt-image-1 practical limit/quality tradeoff
    // already applied in the Visual Hook Banner route. Priority: identity
    // (model) first, then product packaging, then style reference — those
    // are the two Source-of-Truth references that must never be dropped.
    const allReferenceImages = [
      ...modelRefImages,
      ...productRefImages,
      ...(styleRefImages[0] ? [{ ...styleRefImages[0], filename: 'style_ref.png' }] : [])
    ].slice(0, 4);

    // Each concept is its own creative direction → its own prompt → its own
    // API call, run in parallel to keep total wall-clock time reasonable
    // within the route's maxDuration even when the user asks for all 9.
    // allSettled (not all) deliberately — up to 9 simultaneous OpenAI image
    // calls can hit per-org rate limits, and one throttled/failed concept
    // must not wipe out the other 8 that succeeded.
    const settled = await Promise.allSettled(
      input.concepts.map(async (concept) => {
        const prompt = buildConceptImagePrompt(
          productInfo,
          {
            id: concept.id,
            name: concept.name,
            funnelStage: concept.funnel_stage,
            description: concept.description
          },
          { textOverlayMode: useTextOverlay }
        );
        const rawBuffers = await editImages({
          prompt,
          n: input.versions_per_concept,
          size: input.size as ImageSize,
          referenceImages: allReferenceImages,
          inputFidelity: 'high'
        });
        // Composite the exact real Thai text on top of every version — same
        // overlay buffer reused for all of them since the copy/size is
        // identical across this whole batch.
        const buffers =
          useTextOverlay && overlayBuffer
            ? await Promise.all(rawBuffers.map((buf) => compositeTextOverlay(buf, overlayBuffer as Buffer)))
            : rawBuffers;
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

        const okResult: ConceptResult = {
          concept_id: concept.id,
          concept_name: concept.name,
          job_id: insertError ? null : saved?.id ?? null,
          created_at: saved?.created_at ?? new Date().toISOString(),
          signed_urls: uploaded.map((u) => u.signedUrl),
          used_text_overlay: useTextOverlay
        };
        return okResult;
      })
    );

    const results: ConceptResult[] = settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            concept_id: input.concepts[i].id,
            concept_name: input.concepts[i].name,
            job_id: null,
            created_at: new Date().toISOString(),
            signed_urls: [],
            error: (r.reason as any)?.message || 'สร้างภาพ Concept นี้ไม่สำเร็จ'
          }
    );

    const anySucceeded = results.some((r) => r.signed_urls.length > 0);
    if (!anySucceeded) {
      const firstError = results.find((r) => r.error)?.error;
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
