import type { CreativeContext } from '@/lib/ai/context';

export const IDEA_ANGLES = [
  'Social Anxiety', 'Visual Metaphor', 'Relatable Pain', 'Emotional Story', 'Product Demo', 'UGC', 'POV',
  'Review', 'Comparison', 'Experiment', 'Founder', 'Meme', 'News Style', 'Wanted Poster', 'Case File',
  'Receipt', 'Billboard', 'Identity', 'Routine', 'Myth/Belief Shift'
];

export const PROMPT_VERSION_IDEA = 'idea-generator-v3-zana-framework';

export interface IdeaGenInput {
  quantity: number;
  funnel?: string;
  objective?: string;
  platform?: string;
  contentStyle?: string;
  promotion?: string;
  brief?: string;
  // 'ZANA' when the user picked "ZANA Framework" in the Funnel Stage
  // dropdown. Does NOT change the required `funnel` output field (the AI
  // still infers and returns a canonical Awareness/Consideration/
  // Conversion/Retention stage) — it only switches the copywriting
  // structure used to build the idea and unlocks the extra
  // agitate/bridge/product_reason output fields.
  framework?: 'STANDARD' | 'ZANA';
}

const ZANA_FRAMEWORK_BLOCK = `
ZANA FRAMEWORK MODE IS ON. Build every idea around ZANA's internal creative structure —
this is NOT the marketing-funnel stage, it's a copywriting skeleton:
Hook -> Problem -> Agitate -> Bridge -> Solution -> Proof/Product Reason -> CTA.

- Hook: open with a situation, question, observation, or ironic moment the audience immediately
  recognizes as "this is me." NEVER open by selling the product directly (no "ZANA สินค้าคุณภาพ...").
  Goal: stop the scroll.
- Problem (-> pain_point field): the real, specific pain this persona faces. No fear-mongering,
  no body-shaming, no exaggeration.
- Agitate (-> agitate field): make the pain concrete — when/where/what situation it happens, and
  how it costs them emotionally, in time, in money, or in hassle. Keep it real, not invented drama.
- Bridge (-> bridge field): one natural connecting line from the pain into the solution
  ("เพราะแบบนี้...", "นี่เลยเป็นเหตุผลที่...", "หลายคนเลยเริ่มมองหาตัวช่วย...", or an original variant —
  don't reuse the same bridge line every time).
- Solution (-> reflected in product_role/visual_concept): bring the product in only after the pain
  is understood, answering specifically how it solves THIS problem. Don't dump every feature.
- Proof/Product Reason (-> product_reason field): the concrete reason to believe the solution
  works — sourced only from this product's USP / allowed_claims / ingredients / verified facts /
  real promotion. NEVER invent a claim, NEVER use a banned claim.
- CTA: must match the actual funnel stage you infer for this idea (see funnel field rules below).

When framework is ZANA, always fill pain_point, agitate, bridge, and product_reason with real
content (not null/empty) — they carry this framework's Problem/Agitate/Bridge/Proof beats.`;

export function buildIdeaGeneratorPrompt(input: IdeaGenInput, ctx: CreativeContext) {
  const isZana = input.framework === 'ZANA';

  const system = `You are a senior direct-response creative strategist for Thai social-commerce short-form video (TikTok / Facebook Reels / Instagram Reels / Marketplace).
Generate exactly ${input.quantity} DISTINCT video content ideas as JSON: {"ideas": [...]}.
Each idea must follow this exact shape:
{
  "title": string,
  "funnel": "Awareness"|"Consideration"|"Conversion"|"Retention" (ALWAYS one of these four, even in ZANA Framework mode — see rule below),
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
  "angle": one of [${IDEA_ANGLES.map((a) => `"${a}"`).join(', ')}],
  "framework": "STANDARD"|"ZANA",
  "agitate": string|null (ZANA framework only — see below, otherwise null),
  "bridge": string|null (ZANA framework only — see below, otherwise null),
  "product_reason": string|null (ZANA framework only — see below, otherwise null)
}
Rules:
- Spread ideas across DIFFERENT angles — do not repeat the same angle more than ceil(quantity/6) times.
- Write hook/title/visual_concept in Thai. Ground every idea in the Knowledge Base and Winners/Learnings below.
- Never invent claims that contradict banned_claims for the product.
- potential_score is a rough pre-flight estimate only, never a performance guarantee.
- "funnel" is always a real funnel-stage judgment call — it is never literally "ZANA Framework".
  ZANA Framework is a copywriting structure (set via the separate "framework" field), not a funnel
  stage; you must still evaluate what this specific idea actually is (Awareness/Consideration/
  Conversion/Retention) and write that.
${isZana ? ZANA_FRAMEWORK_BLOCK : '- "framework" should be "STANDARD" for every idea, with agitate/bridge/product_reason left null.'}

Knowledge Base (priority: product truth > brand rules > persona insight > content rules > winner patterns > learnings):
${ctx.knowledgeText}

Winners / Learnings so far:
${ctx.winnersText}`;

  const user = `Product: ${ctx.product.product_name} (brand: ${ctx.product.brand}, category: ${ctx.product.category ?? 'n/a'})
USP: ${ctx.product.usp ?? 'n/a'}
Allowed claims: ${ctx.product.allowed_claims ?? 'n/a'}
Banned claims: ${ctx.product.banned_claims ?? 'n/a'}
Persona: ${ctx.persona ? `${ctx.persona.name} (${ctx.persona.age_range ?? 'n/a'}, pains: ${(ctx.persona.pains || []).join(', ')}, desires: ${(ctx.persona.desires || []).join(', ')})` : 'not specified — generate broadly appealing ideas'}
Funnel: ${isZana ? 'ZANA Framework selected — infer the real funnel stage per-idea, see system rules' : (input.funnel ?? 'mix of Awareness/Consideration/Conversion')}
Objective: ${input.objective ?? 'general awareness + conversion mix'}
Platform: ${input.platform ?? 'TikTok'}
Content Style / Creative Format preference: ${input.contentStyle ?? 'any'}
Promotion / Offer: ${input.promotion ?? 'none specified'}
Optional brief: ${input.brief ?? 'none'}
Generate exactly ${input.quantity} ideas now.`;

  return { system, user };
}
