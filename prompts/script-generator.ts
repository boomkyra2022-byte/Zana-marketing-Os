export const PROMPT_VERSION_SCRIPT = 'script-generator-v3-zana-framework';

export interface ScriptGenIdeaPayload {
  idea_index: number;
  idea_id: string;
  variation_index: number; // 0-based within this idea's requested quantity
  title: string;
  hook: string | null;
  pain_point: string | null;
  emotional_trigger: string | null;
  visual_concept: string | null;
  cta: string | null;
  product: { name: string; brand: string; usp: string | null; allowed_claims: string | null; banned_claims: string | null } | null;
  persona: { name: string; age_range: string | null; pains: string[]; desires: string[] } | null;
  // Deterministic — taken from the source idea's own `framework` column,
  // never guessed from the title. 'STANDARD' (default) or 'ZANA'. A single
  // batch can freely mix both; each entry is scripted with its own
  // framework's structure.
  framework: 'STANDARD' | 'ZANA';
  // ZANA-framework-only context carried over from the idea, so the script
  // stays grounded in what the idea already decided for Agitate/Bridge/Proof.
  agitate?: string | null;
  bridge?: string | null;
  product_reason?: string | null;
}

const CAPTION_RULES = `
Caption writing rules (apply to every script, both frameworks):
- Never sound like a robot/ad copy. Ban these openers: "คุณกำลังประสบปัญหา...", "ขอแนะนำ...",
  "ผลิตภัณฑ์ของเราคือ...", "ทางเลือกที่ดีที่สุด...".
- Open from real life / a situation / an observation, not from the product.
- Rough proportion: ~60-70% situation/problem/customer-context, ~20-30% solution/product reason,
  ~10% CTA/offer. Not a strict word count, just the feel of it.
- Caption must read as one continuous, natural piece of writing ready to post as-is on
  Facebook/TikTok/Reels. NEVER print structural labels like "Hook:", "Problem:", "Agitate:" inside
  the caption text itself, unless the user explicitly asked for labels.
- hashtags: lowercase-friendly Thai/English tags relevant to the product and platform, no # symbol.`;

export function buildScriptGeneratorPrompt(payload: ScriptGenIdeaPayload[]) {
  const hasZana = payload.some((p) => p.framework === 'ZANA');
  const hasStandard = payload.some((p) => p.framework !== 'ZANA');

  const system = `You are a senior TikTok/social-commerce scriptwriter for Thai DTC brands.
Each input entry carries its own "framework" field — use the matching structure for that entry:
${hasStandard ? '- framework "STANDARD": HOOK -> BELIEF -> STORY -> PROOF -> TURNING POINT -> OFFER -> CTA. Fill belief/story/turning_point/offer; leave problem/agitate/bridge/solution null.\n' : ''}${hasZana ? '- framework "ZANA": HOOK -> PROBLEM -> AGITATE -> BRIDGE -> SOLUTION -> PROOF/PRODUCT REASON -> CTA. Fill problem/agitate/bridge/solution; leave belief/story/turning_point/offer null. Ground Problem/Agitate/Bridge in the entry\'s own pain_point/agitate/bridge context when provided, and Proof/Product Reason (-> proof field) in the entry\'s product_reason / product.usp / product.allowed_claims — never invent or use a banned claim. Hook must NOT open by selling the product directly.\n' : ''}Both frameworks always fill hook, proof (or the ZANA Proof/Product Reason), cta, caption, hashtags, full_script.
If multiple entries share the same idea_id (variation_index > 0), make each variation genuinely different (different hook angle, different proof type, or different offer framing) — never near-duplicates.
${CAPTION_RULES}
Return JSON: {"scripts": [...]} with exactly one entry per input entry, in the same order:
{
  "idea_index": number (matches input idea_index),
  "title": string (short script title, Thai),
  "hook": string (Thai, literal opening line 0-3s),
  "belief": string|null,
  "story": string|null,
  "proof": string|null,
  "turning_point": string|null,
  "offer": string|null,
  "problem": string|null (ZANA framework only, otherwise null),
  "agitate": string|null (ZANA framework only, otherwise null),
  "bridge": string|null (ZANA framework only, otherwise null),
  "solution": string|null (ZANA framework only, otherwise null),
  "cta": string|null,
  "full_script": string (Thai, complete readable script combining all sections in order),
  "voice_over": string|null,
  "on_screen_text": string|null,
  "estimated_duration_sec": number,
  "shot_list": string[] (each item one shot description),
  "caption": string|null (Thai social post caption, see caption rules above),
  "hashtags": string[] (without # symbol),
  "risks": string|null (compliance/risk note — flag anything that might violate banned claims),
  "score": number (0-100 self-assessed script quality, honest not inflated)
}
Ground everything in the product's allowed/banned claims — NEVER use banned claims.`;

  const user = `Write scripts for these ${payload.length} entries:\n${JSON.stringify(payload, null, 2)}`;

  return { system, user };
}
