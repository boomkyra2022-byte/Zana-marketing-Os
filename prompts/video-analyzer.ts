import { CREATIVE_SCORE_RUBRIC_TEXT, SCORE_DIMENSIONS } from './creative-score';

export const PROMPT_VERSION_VIDEO_ANALYZER = 'video-analyzer-v2';

export interface VideoAnalyzerContext {
  product: { product_name: string; brand: string; usp: string | null; allowed_claims: string | null; banned_claims: string | null } | null;
  persona: { name: string; age_range: string | null; pains: string[]; desires: string[] } | null;
  objective: string | null;
  platform: string | null;
  transcript: string;
  frameTimestamps: number[];
  durationSec: number;
  originalIdea: { title: string; hook: string | null; visual_concept: string | null } | null;
  originalScript: { full_script: string | null; hook: string | null; cta: string | null } | null;
  originalStoryboard: { scenes: any[] } | null;
  knowledgeText: string;
}

export function buildVideoAnalyzerPrompt(ctx: VideoAnalyzerContext) {
  const system = `You are a senior performance-creative reviewer for Thai social-commerce short-form video ads (TikTok / Facebook Reels / Instagram Reels).
You are given a spoken transcript AND ${ctx.frameTimestamps.length} sampled frame images (in chronological order, timestamps in seconds provided below) from a real edited video (duration ~${ctx.durationSec.toFixed(1)}s). Analyze it as if you watched the whole video.

${CREATIVE_SCORE_RUBRIC_TEXT}

Relevant Knowledge Base (brand rules / content rules / winning patterns / learnings — ground your findings in these where relevant):
${ctx.knowledgeText}

Return ONE JSON object:
{
  "score_total": number (0-100, sum of the 7 weighted dimensions),
  "verdict": "REJECT"|"REVISE"|"READY TO TEST"|"PRIORITY TEST",
  "score_breakdown": {
${SCORE_DIMENSIONS.map((d) => `    "${d.key}": {"score": number (0-${d.weight}), "what_works": string|null, "what_hurts": string|null, "recommendation": string|null}`).join(',\n')}
  },
  "timeline_findings": [
    {"start_time": "MM:SS", "end_time": "MM:SS", "status": "KEEP"|"FIX"|"IMPROVE", "finding": string, "recommendation": string}
  ],
  "storyboard_comparison": ${ctx.originalStoryboard ? `[
    {"aspect": string (e.g. "Product reveal timing", "Hook", "CTA", "Pacing", "Missing scenes"), "planned": string|null, "actual": string|null, "status": "Followed"|"Changed"|"Missing", "result": string|null, "recommendation": string|null}
  ]` : 'null (no storyboard was linked for comparison)'},
  "risk_flags": string[] (compliance/claim risks found in the transcript or on-screen text — empty array if none, NEVER folded into score_total)
}

Rules:
- timeline_findings must cover the whole video in short segments, not just problems — mark good segments KEEP.
- Ground allowed/banned claims checks in the product info below; flag any banned claim usage in risk_flags.
- Creative Score is a pre-flight filter, not a performance guarantee — say so implicitly by grounding recommendations in concrete evidence from the transcript/frames, not guesses.`;

  const contextLines = [
    ctx.product ? `Product: ${ctx.product.product_name} (${ctx.product.brand}) — USP: ${ctx.product.usp ?? 'n/a'} — Allowed claims: ${ctx.product.allowed_claims ?? 'n/a'} — Banned claims: ${ctx.product.banned_claims ?? 'n/a'}` : 'Product: not specified',
    ctx.persona ? `Persona: ${ctx.persona.name} (${ctx.persona.age_range ?? 'n/a'}) — pains: ${ctx.persona.pains.join(', ')} — desires: ${ctx.persona.desires.join(', ')}` : 'Persona: not specified',
    `Objective: ${ctx.objective ?? 'not specified'}`,
    `Platform: ${ctx.platform ?? 'not specified'}`,
    ctx.originalIdea ? `Original Idea: "${ctx.originalIdea.title}" — hook: ${ctx.originalIdea.hook ?? 'n/a'} — visual concept: ${ctx.originalIdea.visual_concept ?? 'n/a'}` : null,
    ctx.originalScript ? `Original Script hook: ${ctx.originalScript.hook ?? 'n/a'} — CTA: ${ctx.originalScript.cta ?? 'n/a'}\nFull script:\n${ctx.originalScript.full_script ?? 'n/a'}` : null,
    ctx.originalStoryboard ? `Original Storyboard scenes (planned):\n${JSON.stringify(ctx.originalStoryboard.scenes, null, 2)}` : null
  ].filter(Boolean);

  const user = `${contextLines.join('\n')}

Transcript (spoken audio, in order):
"""
${ctx.transcript || '(no speech detected)'}
"""

Sampled frame timestamps (seconds), matching the images attached in order: ${ctx.frameTimestamps.map((t) => t.toFixed(1)).join(', ')}

Analyze the video now and return the JSON object described in the system prompt.`;

  return { system, user };
}
