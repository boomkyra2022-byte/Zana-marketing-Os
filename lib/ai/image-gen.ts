// OpenAI Image Generation — powers the Banner/Ads Image Generator tool.
// Explicit user request: "เพิ่ม Mode Gennerator ภาพ Banner Ai หรือภาพ Ads
// สำเร็จ เป็นงานที่ให้ค่าย OpenAi ทำ" — same provider as every other AI call
// in this app, no new API key needed (reuses OPENAI_API_KEY).
//
// Two OpenAI endpoints, both used here:
//   - /v1/images/generations — text-to-image, no reference photo
//   - /v1/images/edits — image-to-image with 1+ reference photos, used
//     whenever the user attaches real product photos (the normal case per
//     the team's own prompt library — every template requires "แนบภาพสินค้า
//     จริง" and forbids redesigning the bottle/label). gpt-image-1 accepts
//     multiple reference images per edit call via repeated `image[]` parts.
//
// Model default is `gpt-image-1` (not the newer gpt-image-2 mentioned in
// OpenAI's latest docs) specifically because gpt-image-1 has been generally
// available longer and doesn't risk hitting an org-verification wall the
// user hasn't been through yet — overridable via OPENAI_IMAGE_MODEL once
// they've confirmed gpt-image-2 works on their account.
//
// gpt-image-1 always returns base64-encoded images (no `response_format`/
// hosted-URL option the way older dall-e-2/3 had) — every response here is
// decoded straight from `data[].b64_json`.

import { AIProviderError } from './openai';

export type ImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';

export interface ReferenceImage {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

interface GenerateImagesOpts {
  prompt: string;
  n: number; // 1-10, enforced by caller (zod) before this is called
  size?: ImageSize;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  timeoutMs?: number;
}

interface EditImagesOpts extends GenerateImagesOpts {
  referenceImages: ReferenceImage[];
  inputFidelity?: 'low' | 'high';
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AIProviderError('OPENAI_API_KEY is not configured', 500);
  }
  return apiKey;
}

function getModel(): string {
  return process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
}

function extractB64Images(json: any): string[] {
  const items = Array.isArray(json?.data) ? json.data : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item?.b64_json === 'string' && item.b64_json.length > 0) {
      out.push(item.b64_json);
    }
  }
  return out;
}

// Text-to-image — used only when the user has no product reference photo to
// attach (e.g. a pure theme/mood exploration). The team's own prompt
// library treats this as the exception, not the default.
export async function generateImages(opts: GenerateImagesOpts): Promise<Buffer[]> {
  const apiKey = getApiKey();

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getModel(),
        prompt: opts.prompt,
        n: opts.n,
        size: opts.size || '1024x1024',
        quality: opts.quality || 'high'
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError('สร้างภาพใช้เวลานานเกินไป (timeout)', 504);
    }
    throw new AIProviderError(err?.message || 'เชื่อมต่อ OpenAI Image API ไม่สำเร็จ', 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new AIProviderError(`สร้างภาพไม่สำเร็จ (${res.status}): ${errText.slice(0, 400)}`, 502);
  }

  const json = await res.json();
  const images = extractB64Images(json);
  if (images.length === 0) {
    throw new AIProviderError('OpenAI ไม่ได้คืนค่าภาพกลับมา', 502);
  }
  return images.map((b64) => Buffer.from(b64, 'base64'));
}

// Image-to-image with reference photo(s) — the normal path. Preserves the
// real product (bottle shape, label, logo, colors) instead of letting the
// model invent a new package, per the team's own hard rule
// ("ห้ามออกแบบขวด/ซอง/ฉลากใหม่").
export async function editImages(opts: EditImagesOpts): Promise<Buffer[]> {
  const apiKey = getApiKey();
  if (opts.referenceImages.length === 0) {
    throw new AIProviderError('ต้องแนบภาพสินค้าอ้างอิงอย่างน้อย 1 ภาพ', 400);
  }

  const form = new FormData();
  form.append('model', getModel());
  form.append('prompt', opts.prompt);
  form.append('n', String(opts.n));
  form.append('size', opts.size || '1024x1024');
  form.append('quality', opts.quality || 'high');
  // input_fidelity: 'high' tells gpt-image-1 to closely preserve fine
  // detail from the reference image(s) (product shape/label/logo, or a
  // face) instead of treating them as loose inspiration. Without this it
  // defaults to 'low', which explains a real bug found via user testing:
  // a batch of "same product" variations came back with visibly DIFFERENT
  // pouch designs/colors per image instead of the same real product in
  // different layouts — the model was redesigning the package each time
  // instead of preserving it, which directly violates this tool's core
  // rule ("ห้ามออกแบบขวด/ซอง/ฉลากใหม่").
  form.append('input_fidelity', opts.inputFidelity || 'high');
  for (const ref of opts.referenceImages) {
    form.append('image[]', new Blob([new Uint8Array(ref.buffer)], { type: ref.contentType }), ref.filename);
  }

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000)
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new AIProviderError('สร้างภาพใช้เวลานานเกินไป (timeout)', 504);
    }
    throw new AIProviderError(err?.message || 'เชื่อมต่อ OpenAI Image API ไม่สำเร็จ', 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new AIProviderError(`สร้างภาพไม่สำเร็จ (${res.status}): ${errText.slice(0, 400)}`, 502);
  }

  const json = await res.json();
  const images = extractB64Images(json);
  if (images.length === 0) {
    throw new AIProviderError('OpenAI ไม่ได้คืนค่าภาพกลับมา', 502);
  }
  return images.map((b64) => Buffer.from(b64, 'base64'));
}
