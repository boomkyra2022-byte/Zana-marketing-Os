import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { generateImages, editImages, type ImageSize } from '@/lib/ai/image-gen';
import { uploadEditedClip, downloadLibraryImages } from '@/lib/supabase/storage';
import { AIProviderError } from '@/lib/ai/openai';
import { PROMPT_VERSION_VISUAL_IMAGE } from '@/prompts/visual-hook-banner';

// Visual Hook Banner mode — "Generate Inside ZANA OS" destination.
// OpenAI-only for real generation in this phase (the only provider with a
// configured API key — see the Prompt Compatibility Selector in the client,
// which is honest that Gemini/Midjourney/Flux/Veo are export-only for now).
// API key stays server-only (never sent to the client) per the spec's own
// security requirement — same pattern as every other AI route in this app.
//
// Model+Product Library upgrade: when a Model Preset (with uploaded
// reference photos) and/or a Product's real packshots are attached, this
// now calls editImages() (image-to-image, gpt-image-1's /v1/images/edits)
// instead of pure text-to-image — this is what makes "Identity Lock" /
// "Preserve Packaging" a REAL effect on the pixels instead of only prompt
// text. Falls back to text-to-image generateImages() when neither is
// available, exactly like before this upgrade.
export const runtime = 'nodejs';
export const maxDuration = 90;

// Rough published-rate estimate for gpt-image-1, per image, by quality
// tier — NOT authoritative billing (OpenAI's Images API does not return a
// per-call cost figure). Purely for the "Estimated Cost" the spec asks for;
// actual_cost is left null and this should be reconciled against the real
// OpenAI usage dashboard periodically, not trusted for invoicing.
const ESTIMATED_COST_USD_PER_IMAGE: Record<string, number> = {
  low: 0.011,
  medium: 0.042,
  high: 0.167,
  auto: 0.042
};

const requestSchema = z.object({
  prompt: z.string().min(1).max(6000),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']).default('1024x1024'),
  quality: z.enum(['low', 'medium', 'high', 'auto']).default('high'),
  n: z.number().int().min(1).max(4).default(1),
  // Carried through for the generation_logs audit row AND to fetch real
  // reference images (Model Preset photos / Product packshots) below.
  product_id: z.string().uuid().nullable().optional(),
  visual_idea_id: z.string().uuid().nullable().optional(),
  model_preset_id: z.string().uuid().nullable().optional()
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
  const estimatedCost = (ESTIMATED_COST_USD_PER_IMAGE[input.quality] ?? 0.042) * input.n;

  // Gather real reference photos, if any — Model Preset first (identity),
  // then Product packshots (packaging), capped at 4 total (gpt-image-1
  // practical limit / quality tradeoff). Missing rows or empty arrays just
  // mean no references are attached; never a hard failure.
  const referencePaths: string[] = [];
  let usedIdentityLock = false;
  let usedPackaging = false;
  if (input.model_preset_id) {
    const { data: modelPreset } = await supabase.from('model_presets').select('reference_images').eq('id', input.model_preset_id).single();
    const imgs = (modelPreset?.reference_images ?? []).slice(0, 2);
    if (imgs.length > 0) {
      referencePaths.push(...imgs);
      usedIdentityLock = true;
    }
  }
  if (input.product_id) {
    const { data: product } = await supabase.from('products').select('packshots, preserve_packaging').eq('id', input.product_id).single();
    if (product?.preserve_packaging !== false) {
      const imgs = (product?.packshots ?? []).slice(0, Math.max(4 - referencePaths.length, 0));
      if (imgs.length > 0) {
        referencePaths.push(...imgs);
        usedPackaging = true;
      }
    }
  }

  try {
    const referenceImages = await downloadLibraryImages(referencePaths);
    const usingEditMode = referenceImages.length > 0;

    const buffers = usingEditMode
      ? await editImages({
          prompt: input.prompt,
          n: input.n,
          size: input.size as ImageSize,
          quality: input.quality,
          referenceImages,
          inputFidelity: 'high'
        })
      : await generateImages({
          prompt: input.prompt,
          n: input.n,
          size: input.size as ImageSize,
          quality: input.quality
        });

    const uploaded = await Promise.all(buffers.map((buf, i) => uploadEditedClip(buf, `visual_hook_${randomUUID()}_${i}.png`, 'image/png')));

    const { data: log } = await supabase
      .from('generation_logs')
      .insert({
        user_id: user.id,
        mode: 'visual_hook_banner',
        provider: 'openai',
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
        prompt_version: PROMPT_VERSION_VISUAL_IMAGE,
        prompt_text: input.prompt,
        image_count: uploaded.length,
        estimated_cost: estimatedCost,
        status: 'success',
        result_paths: uploaded.map((u) => u.path),
        model_preset_id: input.model_preset_id || null,
        product_preset_id: input.product_id || null,
        creative_idea_id: input.visual_idea_id || null
      })
      .select('id, created_at')
      .single();

    return NextResponse.json({
      log_id: log?.id ?? null,
      created_at: log?.created_at ?? new Date().toISOString(),
      signed_urls: uploaded.map((u) => u.signedUrl),
      estimated_cost: estimatedCost,
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      used_reference_images: referenceImages.length,
      used_identity_lock: usedIdentityLock,
      used_packaging_lock: usedPackaging
    });
  } catch (err: any) {
    // Log the failure too — a silent failed generation would defeat the
    // point of a usage/cost audit trail.
    await supabase.from('generation_logs').insert({
      user_id: user.id,
      mode: 'visual_hook_banner',
      provider: 'openai',
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt_version: PROMPT_VERSION_VISUAL_IMAGE,
      prompt_text: input.prompt,
      image_count: 0,
      estimated_cost: estimatedCost,
      status: 'failed',
      error: err?.message || 'Unknown error',
      result_paths: [],
      model_preset_id: input.model_preset_id || null,
      product_preset_id: input.product_id || null,
      creative_idea_id: input.visual_idea_id || null
    });
    if (err instanceof AIProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err?.message || 'สร้างภาพไม่สำเร็จ' }, { status: 500 });
  }
}
