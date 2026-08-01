// Shared Creative Score rubric — MASTER_PROMPT_V2 "Creative Score".
// Used by prompts/video-analyzer.ts and the UI (dimension labels/weights).

export const SCORE_DIMENSIONS = [
  { key: 'hook', label: 'Hook', weight: 20 },
  { key: 'retention_pacing', label: 'Retention / Pacing', weight: 15 },
  { key: 'message_clarity', label: 'Message Clarity', weight: 15 },
  { key: 'product_benefit_integration', label: 'Product / Benefit Integration', weight: 15 },
  { key: 'proof_trust', label: 'Proof / Trust', weight: 10 },
  { key: 'offer_cta', label: 'Offer / CTA', weight: 15 },
  { key: 'native_execution', label: 'Native / Execution', weight: 10 }
] as const;

export const VERDICT_THRESHOLDS = [
  { min: 0, max: 59, verdict: 'REJECT' },
  { min: 60, max: 74, verdict: 'REVISE' },
  { min: 75, max: 84, verdict: 'READY TO TEST' },
  { min: 85, max: 100, verdict: 'PRIORITY TEST' }
] as const;

export function verdictForScore(score: number): string {
  const match = VERDICT_THRESHOLDS.find((v) => score >= v.min && score <= v.max);
  return match?.verdict ?? 'REVISE';
}

export const CREATIVE_SCORE_RUBRIC_TEXT = `Creative Score = weighted sum of 7 dimensions, total 100 points (this is a pre-flight filter, NOT a performance guarantee):
${SCORE_DIMENSIONS.map((d) => `- ${d.label}: ${d.weight} pts`).join('\n')}
Compliance/risk issues are reported separately as risk_flags — do NOT fold them into the score.
Verdict thresholds: <60 REJECT, 60-74 REVISE, 75-84 READY TO TEST, 85+ PRIORITY TEST.`;
