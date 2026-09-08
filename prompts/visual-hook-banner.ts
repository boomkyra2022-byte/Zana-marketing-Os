// Visual Hook Banner mode — Phase 1 of the Creative Brief -> AI Visual Ideas
// -> Prompt Studio -> Generation Destination workflow (explicit user spec,
// scoped to 1 mode first per their own choice). Model Identity is a free
// text field for now — no Model Library exists yet (Phase 2), so it is
// never treated as a fixed reference photo, only as descriptive prompt text.

export const PROMPT_VERSION_VISUAL_IDEAS = 'visual-hook-banner-ideas-v1';
export const PROMPT_VERSION_VISUAL_IMAGE = 'visual-hook-banner-image-v1';

export interface VisualBriefInput {
  modelIdentity?: string;
  funnelStage?: string;
  platform?: string;
  objective?: string;
  targetAudience?: string;
  painPoint?: string;
  benefit?: string;
  proof?: string;
  promotion?: string;
  contentStyle?: string;
  visualHookSeed?: string;
  hookStrength?: string;
  outputRatio?: string;
}

export interface VisualProductInput {
  productName: string;
  brand: string;
  category?: string | null;
  usp?: string | null;
  allowedClaims?: string | null;
  bannedClaims?: string | null;
}

function formatBriefBlock(brief: VisualBriefInput, product: VisualProductInput | null): string {
  return `Product: ${product ? `${product.brand} — ${product.productName} (category: ${product.category ?? 'n/a'})` : 'ไม่ระบุสินค้าเฉพาะ — ทำ Visual ระดับแบรนด์'}
USP: ${product?.usp ?? 'n/a'}
Allowed claims: ${product?.allowedClaims ?? 'n/a'}
Banned claims: ${product?.bannedClaims ?? 'n/a'}
Model Identity (free-text description, not a fixed reference — describe only): ${brief.modelIdentity || 'ไม่ระบุ — ไม่ต้องมีคนในภาพก็ได้'}
Funnel Stage: ${brief.funnelStage || 'ไม่ระบุ'}
Platform: ${brief.platform || 'ไม่ระบุ'}
Objective: ${brief.objective || 'ไม่ระบุ'}
Target Audience: ${brief.targetAudience || 'ไม่ระบุ'}
Pain Point: ${brief.painPoint || 'ไม่ระบุ'}
Benefit: ${brief.benefit || 'ไม่ระบุ'}
Proof: ${brief.proof || 'ไม่ระบุ'}
Promotion: ${brief.promotion || 'ไม่ระบุ'}
Content Style: ${brief.contentStyle || 'ไม่ระบุ'}
Visual Hook Seed (starting idea, optional): ${brief.visualHookSeed || 'ไม่ระบุ — คิดใหม่เอง'}
Hook Strength requested: ${brief.hookStrength || 'ผสม Safe/Strong/Unexpected'}
Output Ratio: ${brief.outputRatio || '1:1'}`;
}

export function buildVisualIdeasPrompt(brief: VisualBriefInput, product: VisualProductInput | null, quantity: number) {
  const system = `You are a senior performance-creative art director for Thai social-commerce banner/hook imagery (TikTok, Facebook, Instagram, marketplace ads).
Generate exactly ${quantity} DISTINCT visual concept ideas as JSON: {"ideas": [...]}.
Each idea must follow this exact shape:
{
  "title": string (Thai, short concept name),
  "funnelStage": "Awareness"|"Consideration"|"Conversion"|"Retention",
  "creativeAngle": string (Thai, the core angle/insight driving this concept),
  "visualHook": string (Thai, the literal first-glance visual that stops the scroll),
  "scene": string (Thai, where/what environment the image is set in),
  "situation": string (Thai, what's happening in the moment depicted),
  "painPoint": string (Thai, the real pain this addresses),
  "emotion": string (Thai, the feeling the viewer should have),
  "solution": string (Thai, how the product enters/solves it visually),
  "benefit": string (Thai, the key benefit communicated),
  "proof": string (Thai, grounded ONLY in allowed_claims/USP given — never invent),
  "textHook": string (Thai, the literal headline text to render on the image),
  "supportingText": string (Thai, secondary supporting line),
  "offer": string|null (Thai, promotion text if relevant),
  "cta": string (Thai, call to action matching the funnel stage),
  "layout": string (Thai, brief graphic layout description — where product/text/badges sit),
  "expectedStrength": "Safe"|"Strong"|"Unexpected"
}
Rules:
- Distribute expectedStrength across the set — include at least one Safe, one Strong, and one Unexpected concept when quantity allows (quantity >= 3).
- Make all ${quantity} ideas genuinely distinct in angle/visual, never near-duplicates.
- proof must be grounded only in the given allowed_claims/USP — NEVER invent a claim, NEVER use anything resembling a banned claim.
- If no product is specified, keep proof/solution/benefit generic and brand-level — do not invent a specific product fact.
- All text fields must be ready to actually put in front of a Thai customer — no placeholder brackets.`;

  const user = `${formatBriefBlock(brief, product)}
Generate exactly ${quantity} visual concept ideas now.`;

  return { system, user };
}

export interface VisualIdeaLike {
  title: string;
  creative_angle: string | null;
  visual_hook: string | null;
  scene: string | null;
  situation: string | null;
  pain_point: string | null;
  emotion: string | null;
  solution: string | null;
  benefit: string | null;
  proof: string | null;
  text_hook: string | null;
  supporting_text: string | null;
  offer: string | null;
  cta: string | null;
  layout: string | null;
  funnel_stage: string | null;
}

export function buildVisualIdeaVariationPrompt(brief: VisualBriefInput, product: VisualProductInput | null, baseIdea: VisualIdeaLike) {
  const system = `You are the same art director. Generate exactly 1 DISTINCT variation of the given base concept as JSON: {"ideas": [...]} (array with exactly 1 item, same shape as before: title, funnelStage, creativeAngle, visualHook, scene, situation, painPoint, emotion, solution, benefit, proof, textHook, supportingText, offer, cta, layout, expectedStrength).
The variation must keep the same core angle/insight but change the visual execution meaningfully (different scene, different visual hook, or different emotional register) — not a near-duplicate of the base concept.`;

  const user = `${formatBriefBlock(brief, product)}

Base concept to vary:
Title: ${baseIdea.title}
Angle: ${baseIdea.creative_angle}
Visual Hook: ${baseIdea.visual_hook}
Scene: ${baseIdea.scene}
Situation: ${baseIdea.situation}
Emotion: ${baseIdea.emotion}
Solution: ${baseIdea.solution}
Text Hook: ${baseIdea.text_hook}

Generate exactly 1 variation now.`;

  return { system, user };
}

// ── Prompt Studio ──────────────────────────────────────────────────────
// Block keys, in assembly order. Labels are Thai for the UI; keys are
// stable identifiers used in saved presets (prompt_studio_presets.blocks).
export const PROMPT_STUDIO_BLOCK_DEFS: { key: string; label: string }[] = [
  { key: 'masterQuality', label: 'Master Quality' },
  { key: 'modelIdentity', label: 'Model Identity' },
  { key: 'productTruth', label: 'Product Source of Truth' },
  { key: 'creativeAngle', label: 'Creative Angle' },
  { key: 'scene', label: 'Scene' },
  { key: 'situation', label: 'Situation' },
  { key: 'emotion', label: 'Emotion' },
  { key: 'pose', label: 'Pose' },
  { key: 'camera', label: 'Camera' },
  { key: 'lighting', label: 'Lighting' },
  { key: 'composition', label: 'Composition' },
  { key: 'productPlacement', label: 'Product Placement' },
  { key: 'textOverlay', label: 'Text Overlay' },
  { key: 'graphicLayout', label: 'Graphic Layout' },
  { key: 'proof', label: 'Proof' },
  { key: 'negativePrompt', label: 'Negative Prompt' }
];

const DEFAULT_MASTER_QUALITY =
  'Commercial-grade Thai social-commerce banner, sharp focus, professional color grading, polished premium finish, mobile-first legibility, ready to publish (not an AI draft).';

const DEFAULT_NEGATIVE_PROMPT =
  'no extra limbs, no distorted hands, no watermark, no blurry or garbled text, no misspelled Thai text, no invented brand logos, no low-resolution artifacts.';

// Seeds every block's starting text from a chosen Visual Idea + the Creative
// Brief + product facts — the user can then edit/toggle any block freely.
export function seedPromptStudioBlocks(
  idea: VisualIdeaLike,
  brief: VisualBriefInput,
  product: VisualProductInput | null
): Record<string, { enabled: boolean; text: string }> {
  const productTruth = product
    ? `Product: ${product.brand} — ${product.productName}. USP: ${product.usp || 'n/a'}. Approved claims only: ${product.allowedClaims || 'n/a'}. Never depict or imply: ${product.bannedClaims || 'n/a'}.`
    : 'No specific product selected — keep brand-level, do not invent product facts.';

  const textOverlay = [idea.text_hook, idea.supporting_text, idea.offer, idea.cta].filter(Boolean).join(' / ');

  return {
    masterQuality: { enabled: true, text: DEFAULT_MASTER_QUALITY },
    modelIdentity: { enabled: !!brief.modelIdentity, text: brief.modelIdentity || '' },
    productTruth: { enabled: true, text: productTruth },
    creativeAngle: { enabled: true, text: idea.creative_angle || '' },
    scene: { enabled: true, text: idea.scene || '' },
    situation: { enabled: true, text: idea.situation || '' },
    emotion: { enabled: true, text: idea.emotion || '' },
    pose: { enabled: false, text: '' },
    camera: { enabled: false, text: 'eye-level, medium shot' },
    lighting: { enabled: false, text: 'soft natural daylight' },
    composition: { enabled: false, text: 'rule of thirds, product in the lower third' },
    productPlacement: { enabled: true, text: idea.solution || '' },
    textOverlay: { enabled: !!textOverlay, text: textOverlay },
    graphicLayout: { enabled: !!idea.layout, text: idea.layout || '' },
    proof: { enabled: !!idea.proof, text: idea.proof || '' },
    negativePrompt: { enabled: true, text: DEFAULT_NEGATIVE_PROMPT }
  };
}

// Assembles enabled blocks into one flat description — the provider-neutral
// base that every format below starts from, so switching provider never
// changes Model Identity / Product Facts / Approved Text / Brand Rules,
// only how they're phrased/structured.
export function assembleBlocksText(blocks: Record<string, { enabled: boolean; text: string }>): string {
  return PROMPT_STUDIO_BLOCK_DEFS.filter((b) => blocks[b.key]?.enabled && blocks[b.key]?.text?.trim())
    .map((b) => `${b.label}: ${blocks[b.key].text.trim()}`)
    .join('\n');
}

export type PromptProvider = 'openai' | 'gemini' | 'midjourney' | 'flux' | 'veo' | 'universal';

// Pure deterministic reformatting — no AI call, so it can never drift the
// underlying facts (explicit spec requirement: switching provider must not
// change Model Identity / Product Facts / Approved Text / Brand Rules).
export function formatPromptForProvider(blocks: Record<string, { enabled: boolean; text: string }>, provider: PromptProvider, ratio: string): string {
  const enabled = PROMPT_STUDIO_BLOCK_DEFS.filter((b) => blocks[b.key]?.enabled && blocks[b.key]?.text?.trim());
  const getText = (key: string) => blocks[key]?.text?.trim() || '';

  switch (provider) {
    case 'midjourney': {
      // Comma-separated keyword style + parameters, Midjourney convention.
      const parts = enabled.filter((b) => b.key !== 'negativePrompt').map((b) => getText(b.key));
      const ar = ratio.replace(':', ':');
      const negative = getText('negativePrompt');
      return `${parts.join(', ')} --ar ${ar} --style raw --v 6${negative ? ` --no ${negative.split(',').map((s) => s.trim()).slice(0, 6).join(', ')}` : ''}`;
    }
    case 'veo': {
      // Video-model framing: treat the still concept as an opening frame +
      // implied camera motion, since Veo/Flow prompts describe motion over
      // time even for a single-shot hook.
      const lines = enabled.filter((b) => b.key !== 'negativePrompt').map((b) => `${b.label}: ${getText(b.key)}`);
      return `[Opening frame — image-to-video hook, aspect ${ratio}]\n${lines.join('\n')}\nCamera motion: slow push-in on the product/subject over the first 2-3 seconds, then hold.\nAvoid: ${getText('negativePrompt') || DEFAULT_NEGATIVE_PROMPT}`;
    }
    case 'gemini':
    case 'flux': {
      // Natural-language paragraph, slightly more descriptive/photographic
      // phrasing than the OpenAI version.
      const prose = enabled
        .filter((b) => b.key !== 'negativePrompt')
        .map((b) => getText(b.key))
        .join('. ');
      return `${prose}. Aspect ratio ${ratio}. ${getText('negativePrompt') ? `Avoid: ${getText('negativePrompt')}.` : ''}`.trim();
    }
    case 'openai':
    case 'universal':
    default: {
      const lines = enabled.map((b) => `${b.label}: ${getText(b.key)}`);
      return `${lines.join('\n')}\nAspect ratio: ${ratio}`;
    }
  }
}

// Final prompt actually sent to OpenAI's Images API for real generation —
// wraps the assembled/formatted text with the compliance guardrails this
// app enforces everywhere else (never invent claims, never redesign a real
// product if one is referenced by text only here since Phase 1 has no
// packshot upload for this mode).
export function buildFinalImagePrompt(formattedPrompt: string): string {
  return `${formattedPrompt}

Compliance (strict): only use product facts/claims explicitly given above — never invent a claim, certification, price, or registration number. Thai text rendered on the image must be spelled correctly and be the exact text given, not paraphrased.`;
}
