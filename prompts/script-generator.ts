export const PROMPT_VERSION_SCRIPT = 'script-generator-v2';

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
}

export function buildScriptGeneratorPrompt(payload: ScriptGenIdeaPayload[]) {
  const system = `You are a senior TikTok/social-commerce scriptwriter for Thai DTC brands.
For EACH entry provided, write a full video script using this exact structure: HOOK -> BELIEF -> STORY -> PROOF -> TURNING POINT -> OFFER -> CTA.
If multiple entries share the same idea_id (variation_index > 0), make each variation genuinely different (different hook angle, different proof type, or different offer framing) — never near-duplicates.
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
  "cta": string|null,
  "full_script": string (Thai, complete readable script combining all sections),
  "voice_over": string|null,
  "on_screen_text": string|null,
  "estimated_duration_sec": number,
  "shot_list": string[] (each item one shot description),
  "caption": string|null (Thai social post caption),
  "hashtags": string[] (without # symbol),
  "risks": string|null (compliance/risk note — flag anything that might violate banned claims),
  "score": number (0-100 self-assessed script quality, honest not inflated)
}
Ground everything in the product's allowed/banned claims — NEVER use banned claims.`;

  const user = `Write scripts for these ${payload.length} entries:\n${JSON.stringify(payload, null, 2)}`;

  return { system, user };
}
