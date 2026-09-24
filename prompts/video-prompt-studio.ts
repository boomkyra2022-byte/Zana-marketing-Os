import type { Product, ModelPreset } from '@/types/database';

// ZANA AI Video Prompt Studio — Master Prompt Compiler (P0).
// New, standalone module (not an upgrade of prompts/flow-prompt-director.ts
// — explicit user decision). Pure string assembly, no AI call — same
// pattern as buildConceptImagePrompt() in prompts/banner-generator.ts.
// Output is copy-paste text only (confirmed with the user): the compiled
// prompt is pasted into Google Flow / Veo / Runway / etc, this app never
// calls a video-generation API.
//
// 3-layer model (spec doc "ZANA AI Video Prompt Studio — Spec & Build
// Plan", Architecture section):
//   Layer 1 — LOCKED CORE: Product Lock / No Hallucination / Consistency /
//     QC. Always appended server-side from LOCKED_CORE_BLOCK below,
//     regardless of what the client sends — never editable from the UI.
//   Layer 2 — CUSTOM VARIABLES: everything in VideoPromptVariables, chosen
//     in the wizard.
//   Layer 3 — AUTO DIRECTOR: scene-by-scene camera/lighting/props/
//     transitions/SFX — left to the target AI video tool to fill in from
//     the SCENE ENGINE / CAMERA instructions below (this app does not
//     render scenes itself in P0; Custom Director per-scene override is
//     P1).
export const PROMPT_VERSION_VIDEO_PROMPT_STUDIO = 'v1';

export interface VideoPromptVariables {
  creative_mode?: string | null; // one of the 8 Creative Modes
  funnel_stage?: string | null; // Awareness | Consideration | Conversion | Retention
  character_mode?: string | null;
  character_persona?: string | null;
  age_appearance?: string | null;
  duration_sec?: number | null;
  scene_count?: number | null;
  pacing?: string | null;
  visual_quality?: string | null;
  lighting?: string | null;
  environment?: string | null;
  color_direction?: string | null;
  camera_style?: string | null;
  // Skincare Special Engine (P2) — present only when the product's category
  // matched the trigger list on the client; harmless when absent.
  skin_finish?: string | null;
  texture_mode?: string | null;
  ingredient_visualization?: string | null;
  scene_focus?: string | null;
  // Text system
  text_mode?: string | null;
  text_frequency?: string | null;
  text_effects?: string[] | null;
  // Voice system
  voice_gender?: string | null;
  voice_style?: string | null;
  script_length_words?: number | null;
  // Sound
  bgm_style?: string | null;
  bgm_level?: string | null;
  ending_type?: string | null;
  hook_style?: string | null;
  funnel_structure?: string | null;
  content_focus?: string | null;
  transition_speed?: string | null;
  objective?: string | null;
}

// Layer 1 — never rendered from client input, never optional. Mirrors the
// role MASTER_VISUAL_QUALITY_BLOCK plays in prompts/banner-generator.ts:
// appended verbatim after the concept-specific sections, last word on
// product/QC rules regardless of what Layer 2 chose.
//
// Kept as two separate constants (not one block later split apart by
// string matching) so the compiler can place them in the right position
// in the section order without any fragile string surgery.
export const PRODUCT_LOCK_BLOCK = `==================================================
ABSOLUTE PRODUCT SOURCE OF TRUTH
==================================================

Use ONLY the product reference described below as the MASTER PRODUCT
REFERENCE. Product Identity Priority = MAXIMUM.

Preserve exactly: original packaging, logo, brand name, label, typography,
color, material, geometry, proportions, closure/pump/cap/spray structure,
visible details.

DO NOT: redesign, reinterpret, recreate a different package, invent
another variation, alter labels, alter typography, alter logo, change
color, change product shape, hallucinate invisible product details.

If a product detail cannot be confirmed from the reference, DO NOT INVENT
IT — choose another camera angle instead. Product consistency must remain
stable throughout EVERY FRAME.

NOTE: this prompt is text only. Attach the product's real reference photo
(Product Library packshot) in the target AI video tool alongside this
text — a plain-text prompt alone cannot carry image data to an external
tool, so Product Lock here is enforced by putting only real product facts
into the text below, not by an in-app image-lock API call.`;

export const FINAL_QC_BLOCK = `==================================================
FINAL QUALITY CONTROL
==================================================

Before rendering verify: exact reference product; no packaging redesign;
no logo mutation; no label mutation; product consistency every frame;
correct character mode; correct scene count; correct duration; natural
anatomy; realistic product usage; realistic physics; no flicker; no
morphing; no deformation; no unsupported claims; correct text mode;
correct voice mode; synchronized SFX; BGM balanced; smooth scene
transitions; mobile-first composition; ready for TikTok / Reels / Shorts.

FINAL PRIORITY: PRODUCT ACCURACY > REALISM > CREATIVE STRATEGY > RETENTION
> CINEMATIC BEAUTY > EFFECTS.`;

// Kept for anything that wants the full Layer-1 text in one piece
// (documentation, tests) — the compiler below uses the two halves above
// directly instead of parsing this string.
export const LOCKED_CORE_BLOCK = `${PRODUCT_LOCK_BLOCK}\n\n${FINAL_QC_BLOCK}`;

const SKINCARE_CATEGORIES = ['serum', 'cream', 'lotion', 'body oil', 'mist', 'skincare', 'bodycare'];

export function isSkincareCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return SKINCARE_CATEGORIES.some((k) => c.includes(k));
}

// "30+ words in 10 seconds = fast delivery" guard from the spec — a UI-side
// calculation (the AI prompt can't self-correct pacing), exposed here so
// both the client and the compiler use one shared threshold.
export function checkScriptPace(words: number | null | undefined, durationSec: number | null | undefined) {
  if (!words || !durationSec) return { wordsPerSec: 0, isFastDelivery: false };
  const wordsPerSec = words / durationSec;
  // ~2.2 words/sec is a natural spoken-Thai pace ceiling before delivery
  // starts sounding rushed/unnatural.
  return { wordsPerSec, isFastDelivery: wordsPerSec > 2.2 };
}

function productFactsBlock(product: Product | null): string {
  if (!product) {
    return 'No specific product attached to this project — do not invent a product name, packaging, or claim; keep the scene generic to the product category described in the brief.';
  }
  const lines = [
    `Product: ${product.product_name}`,
    product.brand ? `Brand: ${product.brand}` : '',
    product.category ? `Category: ${product.category}` : '',
    product.usp ? `USP: ${product.usp}` : '',
    product.ingredients ? `Ingredients/Material: ${product.ingredients}` : '',
    product.benefits ? `Benefits: ${product.benefits}` : '',
    product.usage ? `Usage: ${product.usage}` : '',
    product.brand_colors ? `Brand colors: ${product.brand_colors}` : '',
    product.allowed_claims ? `Allowed claims (use only these, verbatim in spirit): ${product.allowed_claims}` : '',
    product.banned_claims ? `NEVER claim: ${product.banned_claims}` : '',
    product.registration_number ? `Registration number (show only if legally required in frame): ${product.registration_number}` : ''
  ].filter(Boolean);
  return lines.join('\n');
}

function characterBlock(v: VideoPromptVariables, modelPreset: ModelPreset | null): string {
  const lines = [`Character Mode: ${v.character_mode || 'Not specified'}`, v.character_persona ? `Persona: ${v.character_persona}` : '', v.age_appearance ? `Age appearance: ${v.age_appearance}` : ''];
  if (modelPreset) {
    lines.push(`Model/Founder identity reference: ${modelPreset.name}`);
    if (modelPreset.identity_prompt) lines.push(modelPreset.identity_prompt);
    if (modelPreset.identity_lock) {
      lines.push('This is a real-person Identity Lock. Preserve the referenced face/identity exactly — do not replace with a generic AI face.');
      if (!modelPreset.reference_images?.length && !modelPreset.master_reference) {
        lines.push('⚠ No reference photo is attached to this Model preset yet — identity is text-described only until one is uploaded in Model Library.');
      }
    }
  }
  if ((v.character_mode || '').toLowerCase().includes('no face') || (v.character_mode || '').toLowerCase().includes('hands only')) {
    lines.push('Show only hands / body parts implied by Character Mode. Never reveal face, eyes, mouth, head, or unintended reflections. Human anatomy must remain realistic.');
  }
  return lines.filter(Boolean).join('\n');
}

function skincareEngineBlock(v: VideoPromptVariables): string {
  return `==================================================
SKINCARE BEAUTY ENGINE
==================================================

Use premium skincare commercial cinematography.
Skin Finish: ${v.skin_finish || 'Natural'}
Texture Mode: ${v.texture_mode || 'Not specified'}
Ingredient Visualization: ${v.ingredient_visualization || 'OFF'}

Skin must remain photorealistic, naturally textured, healthy-looking,
believable. Never create plastic skin, waxy skin, excessive smoothing, or
fake CGI liquid. Product texture must obey realistic viscosity, gravity,
reflection, translucency, absorption behavior. Use premium beauty-
commercial lighting and macro cinematography.`;
}

// Layer 3 in P0: instructions for the target AI video tool's own scene
// planning, not scenes this app generates itself. Custom Director
// (per-scene manual override) is P1 — see the spec doc's phased plan.
function sceneAndCameraBlock(v: VideoPromptVariables): string {
  return `==================================================
SCENE ENGINE
==================================================

Create EXACTLY ${v.scene_count ?? 6} scenes within ${v.duration_sec ?? 10} seconds.
Each scene must have a distinct visual purpose. For every scene, define:
scene objective, environment, product placement, human interaction, camera
framing, camera movement, lighting, on-screen text, text animation,
transition, SFX, voiceover segment. Never repeat identical camera
composition in consecutive scenes. Keep visual rhythm optimized for:
${v.pacing || 'Balanced'}.
${v.scene_focus ? `Primary scene focus: ${v.scene_focus}.` : ''}

==================================================
CAMERA
==================================================

Select the best camera language automatically from: POV, handheld, macro,
extreme close-up, medium close-up, top view, over shoulder, side angle,
hero product, detail shot, slider, rack focus, controlled orbit. Available
movements: Push In, Pull Out, Slide, Pan, Tilt, Tracking, Micro Handheld,
Rack Focus, Macro Drift. Camera behavior must match: ${v.visual_quality || 'Commercial UGC'}.${
    v.camera_style ? ` Preferred camera style: ${v.camera_style}.` : ''
  }`;
}

function voiceAndTextBlock(v: VideoPromptVariables): string {
  const pace = checkScriptPace(v.script_length_words, v.duration_sec);
  return `==================================================
VOICE
==================================================

Voice: ${v.voice_gender || 'No Voice'}
Voice Style: ${v.voice_style || 'Casual'}
Language: Thai
Minimum Script: ${v.script_length_words ? `${v.script_length_words} words` : 'Auto'}${
    pace.isFastDelivery ? ` (⚠ ${pace.wordsPerSec.toFixed(1)} words/sec — this reads as fast delivery; consider fewer words or a longer duration)` : ''
  }

Voiceover must sound naturally spoken, avoid robotic delivery, communicate
quickly, remain understandable, match scene changes. Write a new script
for every generation. Never invent medical or unsupported performance
claims.

==================================================
TEXT
==================================================

Text Mode: ${v.text_mode || 'None'}
Frequency: ${v.text_frequency || 'Auto'}
Effects: ${(v.text_effects || []).join(', ') || 'Auto'}

Text must be mobile-first, immediately readable, remain concise, support
the visual, never cover important packaging, never alter product labels.
Recommended: 2-6 Thai words per visual message.`;
}

function soundAndEndingBlock(v: VideoPromptVariables): string {
  return `==================================================
SOUND DESIGN
==================================================

BGM: ${v.bgm_style || 'Auto — match Creative Mode'}
BGM Level: ${v.bgm_level || 'Balanced, under voiceover'}

Automatically create realistic synchronized SFX for product interaction,
product movement, physical contact, environment, camera movement where
appropriate, transitions, text accents. Sound effects must enhance realism
rather than overwhelm the video.

==================================================
FINAL SCENE
==================================================

Ending Type: ${v.ending_type || 'Standard CTA close'}
${
  (v.creative_mode || '').toLowerCase().includes('premium') || (v.creative_mode || '').toLowerCase().includes('social')
    ? 'Finish with a professional commercial packshot: exact product, readable packaging, controlled lighting, premium composition, elegant depth, stable closing frame.'
    : ''
}`;
}

function creativeStrategyBlock(v: VideoPromptVariables): string {
  return `==================================================
CREATIVE STRATEGY
==================================================

Creative Mode: ${v.creative_mode || 'Not specified'}
Funnel: ${v.funnel_stage || 'Not specified'}
Primary Objective: ${v.objective || 'Not specified'}
Hook Style: ${v.hook_style || 'Auto'}

Build the creative around: HOOK -> CONTEXT/PROBLEM -> PRODUCT ->
EXPERIENCE/DEMONSTRATION -> BENEFIT OR REASON -> CTA. Adapt this structure
automatically according to the selected funnel stage.${
    v.funnel_structure ? ` Funnel-specific structure for this mode: ${v.funnel_structure}.` : ''
  }${v.content_focus ? ` Content focus: ${v.content_focus}.` : ''}`;
}

// The Master Prompt Compiler. Section order follows the spec doc's
// Architecture table and the original 15-section template almost exactly —
// only reorganized where two sections shared one concern (Camera folded
// into Scene Engine, Editing folded into Sound/Final Scene) to avoid
// printing near-duplicate instructions, same "dedupe rather than stack"
// call already made for MASTER_VISUAL_QUALITY_BLOCK in banner-generator.ts.
export function buildMasterVideoPrompt(input: { product: Product | null; modelPreset: ModelPreset | null; variables: VideoPromptVariables }): string {
  const { product, modelPreset, variables: v } = input;
  const skincare = isSkincareCategory(product?.category);

  const header = `# ZANA MARKETING OS
# CUSTOM VIDEO GENERATION MASTER PROMPT — AI Video Prompt Studio (v${PROMPT_VERSION_VIDEO_PROMPT_STUDIO})

PROJECT MODE: ${v.creative_mode || 'Not specified'}
FUNNEL: ${v.funnel_stage || 'Not specified'}
VIDEO: Duration ${v.duration_sec ?? 10}s · Aspect Ratio 9:16 · Scenes ${v.scene_count ?? 6} · Pacing ${v.pacing || 'Balanced'}`;

  const sections = [
    header,
    PRODUCT_LOCK_BLOCK,
    `==================================================\nPRODUCT FACTS\n==================================================\n\n${productFactsBlock(product)}`,
    `==================================================\nCHARACTER\n==================================================\n\n${characterBlock(v, modelPreset)}`,
    creativeStrategyBlock(v),
    skincare ? skincareEngineBlock(v) : '',
    sceneAndCameraBlock(v),
    voiceAndTextBlock(v),
    soundAndEndingBlock(v),
    FINAL_QC_BLOCK
  ];

  return sections.filter(Boolean).join('\n\n');
}

// Auto Best Mode (P3) — one AI call that returns the same VideoPromptVariables
// shape the wizard itself produces, so the compiler above never needs a
// second code path (spec doc, "Presets and Auto Best Mode" section).
// Kept here (not yet wired into a route until P3) so the shape is defined
// once, next to the compiler it feeds.
export function buildAutoBestModeMessages(product: Product | null): { system: string; user: string } {
  const system = `You are a senior performance-marketing video director for a Thai DTC skincare/mother-and-baby brand. Given a product's facts, recommend a complete AI Video Prompt Studio configuration. Respond with strict JSON matching this shape: {"creative_mode":string,"funnel_stage":string,"character_mode":string,"duration_sec":number,"scene_count":number,"visual_quality":string,"hook_style":string,"ending_type":string,"reasoning":string}. Never invent unsupported product claims.`;
  const user = product
    ? `Product: ${product.product_name}\nBrand: ${product.brand}\nCategory: ${product.category || 'unspecified'}\nUSP: ${product.usp || 'none given'}\nBenefits: ${product.benefits || 'none given'}`
    : 'No product attached — recommend a safe general-purpose skincare UGC setup.';
  return { system, user };
}
