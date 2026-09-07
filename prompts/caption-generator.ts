import type { CreativeContext } from '@/lib/ai/context';

// Standalone Caption Generator — explicit user request: a quick "คิดแคปชั่น"
// tool as its own tab next to Idea→Script→Storyboard and the Banner/Ads
// Image Generator, for when someone just wants caption options without
// running the full pipeline. Reuses the same product/persona/knowledge-base
// grounding (getRelevantCreativeContext) and the same Caption Writing Rules
// as the Script Generator (prompts/script-generator.ts) so captions from
// either tool sound consistent — duplicated here rather than imported since
// this is a standalone tool that should keep working even if the script
// generator's prompt changes shape later.

export const PROMPT_VERSION_CAPTION = 'caption-generator-v1';

export interface CaptionGenInput {
  quantity: number;
  framework: 'STANDARD' | 'ZANA';
  objective?: string;
  platform?: string;
  promotion?: string;
  brief?: string;
}

const CAPTION_RULES = `
Caption writing rules:
- Never sound like a robot/ad copy. Ban these openers: "คุณกำลังประสบปัญหา...", "ขอแนะนำ...",
  "ผลิตภัณฑ์ของเราคือ...", "ทางเลือกที่ดีที่สุด...".
- Open from real life / a situation / an observation, not from the product.
- Rough proportion: ~60-70% situation/problem/customer-context, ~20-30% solution/product reason,
  ~10% CTA/offer. Not a strict word count, just the feel of it.
- Caption must read as one continuous, natural piece of writing ready to post as-is on
  Facebook/TikTok/Reels. NEVER print structural labels like "Hook:", "Problem:", "Agitate:" inside
  the caption text itself.
- hashtags: relevant Thai/English tags for the product and platform, no # symbol.`;

const ZANA_CAPTION_BLOCK = `
ZANA FRAMEWORK MODE IS ON — internally structure each caption's flow as
Hook -> Problem -> Agitate -> Bridge -> Solution -> Proof/Product Reason -> CTA
(a copywriting skeleton, not something printed as labels — see caption rules above),
grounded only in this product's own USP / allowed_claims — never invent or use a banned claim.`;

export function buildCaptionGeneratorPrompt(input: CaptionGenInput, ctx: CreativeContext) {
  const isZana = input.framework === 'ZANA';

  const system = `You are a senior Thai social-commerce copywriter writing standalone social captions (not full video scripts) for TikTok / Facebook / Instagram.
Generate exactly ${input.quantity} DISTINCT caption options as JSON: {"captions": [...]}.
Each option must follow this exact shape:
{
  "hook": string (Thai, the literal opening line of the caption),
  "caption": string (Thai, the full ready-to-post caption),
  "hashtags": string[] (without # symbol),
  "angle": string|null (short label for what makes this option different from the others, e.g. "ถามคำถามเปิด", "เล่าเหตุการณ์จริง", "เปรียบเทียบก่อน-หลัง")
}
Rules:
- Make the ${input.quantity} options genuinely different from each other (different angle/hook), never near-duplicates.
- Ground everything in the product's allowed_claims — NEVER use banned_claims or invent a claim.
${CAPTION_RULES}
${isZana ? ZANA_CAPTION_BLOCK : ''}

Knowledge Base (priority: product truth > brand rules > persona insight > content rules > winner patterns > learnings):
${ctx.knowledgeText}

Winners / Learnings so far:
${ctx.winnersText}`;

  const user = `Product: ${ctx.product.product_name} (brand: ${ctx.product.brand}, category: ${ctx.product.category ?? 'n/a'})
USP: ${ctx.product.usp ?? 'n/a'}
Allowed claims: ${ctx.product.allowed_claims ?? 'n/a'}
Banned claims: ${ctx.product.banned_claims ?? 'n/a'}
Persona: ${ctx.persona ? `${ctx.persona.name} (${ctx.persona.age_range ?? 'n/a'}, pains: ${(ctx.persona.pains || []).join(', ')}, desires: ${(ctx.persona.desires || []).join(', ')})` : 'not specified — write broadly appealing captions'}
Framework: ${isZana ? 'ZANA Framework (Hook->Problem->Agitate->Bridge->Solution->Proof->CTA)' : 'Standard, open style'}
Objective: ${input.objective ?? 'general engagement + conversion'}
Platform: ${input.platform ?? 'TikTok/Facebook/Instagram'}
Promotion / Offer: ${input.promotion ?? 'none specified'}
Optional brief: ${input.brief ?? 'none'}
Generate exactly ${input.quantity} caption options now.`;

  return { system, user };
}
