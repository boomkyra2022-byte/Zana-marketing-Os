import type { CreativeContext } from '@/lib/ai/context';

export const IDEA_ANGLES = [
  'Social Anxiety', 'Visual Metaphor', 'Relatable Pain', 'Emotional Story', 'Product Demo', 'UGC', 'POV',
  'Review', 'Comparison', 'Experiment', 'Founder', 'Meme', 'News Style', 'Wanted Poster', 'Case File',
  'Receipt', 'Billboard', 'Identity', 'Routine', 'Myth/Belief Shift'
];

export const PROMPT_VERSION_IDEA = 'idea-generator-v2';

export interface IdeaGenInput {
  quantity: number;
  funnel?: string;
  objective?: string;
  platform?: string;
  contentStyle?: string;
  promotion?: string;
  brief?: string;
}

export function buildIdeaGeneratorPrompt(input: IdeaGenInput, ctx: CreativeContext) {
  const system = `You are a senior direct-response creative strategist for Thai social-commerce short-form video (TikTok / Facebook Reels / Instagram Reels / Marketplace).
Generate exactly ${input.quantity} DISTINCT video content ideas as JSON: {"ideas": [...]}.
Each idea must follow this exact shape:
{
  "title": string,
  "funnel": "Awareness"|"Consideration"|"Conversion"|"Retention",
  "creative_format": string,
  "pain_point": string|null,
  "emotional_trigger": string|null,
  "hook": string (Thai, the literal opening line/visual),
  "visual_concept": string|null,
  "product_role": string|null,
  "mood_tone": string|null,
  "cta": string|null,
  "organic_or_ads": "organic"|"ads"|"both",
  "potential_score": number (1-10, honest pre-flight estimate, not inflated),
  "stop_scroll_reason": string|null,
  "risks": string|null,
  "angle": one of [${IDEA_ANGLES.map((a) => `"${a}"`).join(', ')}]
}
Rules:
- Spread ideas across DIFFERENT angles — do not repeat the same angle more than ceil(quantity/6) times.
- Write hook/title/visual_concept in Thai. Ground every idea in the Knowledge Base and Winners/Learnings below.
- Never invent claims that contradict banned_claims for the product.
- potential_score is a rough pre-flight estimate only, never a performance guarantee.

Knowledge Base (priority: product truth > brand rules > persona insight > content rules > winner patterns > learnings):
${ctx.knowledgeText}

Winners / Learnings so far:
${ctx.winnersText}`;

  const user = `Product: ${ctx.product.product_name} (brand: ${ctx.product.brand}, category: ${ctx.product.category ?? 'n/a'})
USP: ${ctx.product.usp ?? 'n/a'}
Allowed claims: ${ctx.product.allowed_claims ?? 'n/a'}
Banned claims: ${ctx.product.banned_claims ?? 'n/a'}
Persona: ${ctx.persona ? `${ctx.persona.name} (${ctx.persona.age_range ?? 'n/a'}, pains: ${(ctx.persona.pains || []).join(', ')}, desires: ${(ctx.persona.desires || []).join(', ')})` : 'not specified — generate broadly appealing ideas'}
Funnel: ${input.funnel ?? 'mix of Awareness/Consideration/Conversion'}
Objective: ${input.objective ?? 'general awareness + conversion mix'}
Platform: ${input.platform ?? 'TikTok'}
Content Style / Creative Format preference: ${input.contentStyle ?? 'any'}
Promotion / Offer: ${input.promotion ?? 'none specified'}
Optional brief: ${input.brief ?? 'none'}
Generate exactly ${input.quantity} ideas now.`;

  return { system, user };
}
