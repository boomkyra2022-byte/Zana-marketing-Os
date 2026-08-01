export const PROMPT_VERSION_V2_REWRITE = 'v2-rewrite-v2';

export interface V2RewriteContext {
  product: { product_name: string; brand: string; usp: string | null; allowed_claims: string | null; banned_claims: string | null } | null;
  persona: { name: string; age_range: string | null; pains: string[]; desires: string[] } | null;
  transcript: string;
  scoreTotal: number;
  verdict: string;
  scoreBreakdown: Record<string, { score: number; what_works: string | null; what_hurts: string | null; recommendation: string | null }>;
  timelineFindings: { start_time: string; end_time: string; status: string; finding: string; recommendation: string }[];
  storyboardComparison: any[] | null;
  riskFlags: string[];
  originalHook: string | null;
  originalCta: string | null;
}

export function buildV2RewritePrompt(ctx: V2RewriteContext) {
  const system = `You are a senior direct-response scriptwriter/editor for Thai social-commerce short-form video ads.
You are given the Creative Score analysis of an already-edited video (score ${ctx.scoreTotal}/100, verdict ${ctx.verdict}). Produce a concrete V2 revision plan.

Return JSON:
{
  "priority_fixes": string[] (1 to 5 items, ordered by impact, each a specific actionable fix — not vague advice),
  "revised_script": {
    "title": string (Thai, short),
    "hook": string (Thai, literal opening line 0-3s, fixes the biggest hook issue found),
    "belief": string|null,
    "story": string|null,
    "proof": string|null,
    "turning_point": string|null,
    "offer": string|null,
    "cta": string|null,
    "full_script": string (Thai, complete readable script using HOOK->BELIEF->STORY->PROOF->TURNING POINT->OFFER->CTA structure),
    "voice_over": string|null,
    "on_screen_text": string|null,
    "estimated_duration_sec": number,
    "shot_list": string[],
    "caption": string|null,
    "hashtags": string[] (no # symbol),
    "risks": string|null,
    "score": number (0-100 self-assessed script quality, honest not inflated)
  },
  "revised_edit_plan": string (Thai, concrete editing instructions: what to cut, reorder, re-shoot, or add — reference specific timestamps from the timeline findings)
}
Ground every fix in the analysis data given — never invent generic advice unrelated to the actual findings. Never use banned claims.`;

  const user = `Product: ${ctx.product ? `${ctx.product.product_name} (${ctx.product.brand}) — Allowed: ${ctx.product.allowed_claims ?? 'n/a'} — Banned: ${ctx.product.banned_claims ?? 'n/a'}` : 'not specified'}
Persona: ${ctx.persona ? `${ctx.persona.name} — pains: ${ctx.persona.pains.join(', ')} — desires: ${ctx.persona.desires.join(', ')}` : 'not specified'}
Original hook: ${ctx.originalHook ?? 'n/a'} | Original CTA: ${ctx.originalCta ?? 'n/a'}

Transcript of the analyzed video:
"""
${ctx.transcript || '(no speech detected)'}
"""

Score breakdown:
${JSON.stringify(ctx.scoreBreakdown, null, 2)}

Timeline findings:
${JSON.stringify(ctx.timelineFindings, null, 2)}

Storyboard comparison (if any):
${ctx.storyboardComparison ? JSON.stringify(ctx.storyboardComparison, null, 2) : 'none'}

Risk flags: ${ctx.riskFlags.length > 0 ? ctx.riskFlags.join('; ') : 'none'}

Produce the V2 revision plan now.`;

  return { system, user };
}
