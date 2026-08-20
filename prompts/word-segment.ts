// Thai word-segmentation regroup — fixes a real bug found in production
// testing of the Live Editor: Whisper's word-level timestamps
// (timestamp_granularities=word) are BPE-token-based, and Thai has no
// spaces between words, so for Thai speech the "words" array Whisper
// returns is frequently sub-word fragments (single syllables, sometimes
// single characters) rather than real dictionary words. Every downstream
// consumer (the Live Editor's draggable timeline blocks, the burned-in
// per-word karaoke highlight) was built assuming one array entry == one
// real word, so the fragments showed up as broken/garbled blocks and a
// choppy syllable-by-syllable highlight instead of clean word-by-word.
//
// Same "AI only picks index boundaries, text is assembled from real
// tokens in code" pattern already used by prompts/punchy-subtitle.ts — the
// model never invents text or timing here either, it only decides which
// consecutive raw tokens belong to the same real word.

export const PROMPT_VERSION_WORD_SEGMENT = 'word-segment-v1';

export interface WordSegmentContext {
  tokens: { token: string; start: number; end: number }[];
}

export function buildWordSegmentPrompt(ctx: WordSegmentContext) {
  const system = `You are a Thai text segmentation engine. A speech-to-text model returned word-level timestamps as an array of TOKENS. For Thai (a script with no spaces between words), these tokens are frequently sub-word fragments — single syllables, sometimes single characters — not real dictionary words.

Your ONLY job: group consecutive tokens by INDEX into real, correctly-segmented Thai words (or English/number/punctuation tokens, which are almost always already a complete unit). You never write text yourself — you only return index ranges; the system reassembles the actual text from the real tokens.

Rules:
1. Every token belongs to exactly one group, in order, no gaps, no overlaps, no duplicates — group N's end_word_index + 1 must equal group N+1's start_word_index, starting at 0 and ending at the last token index.
2. Merge tokens ONLY when they are genuinely fragments of ONE real Thai word (e.g. syllables of a multi-syllable word). Do not merge two separate real words into one group, and do not merge across an obvious pause/sentence boundary.
3. A group is normally 1-4 tokens. English words, numbers, and punctuation are almost always already a complete single token — leave those as single-token groups unless clearly split mid-word by the transcriber.
4. When in doubt between under-merging and over-merging, prefer under-merging (leaving a token as its own group) — a slightly-too-fragmented word is a smaller visual defect than two real words glued together.

Return ONE JSON object:
{"groups": [{"start_word_index": number, "end_word_index": number}]}
groups must be sorted ascending by start_word_index and cover every token index exactly once, from 0 to the last index, with no gaps or overlaps.`;

  const tokenList = ctx.tokens.map((t, i) => `${i}: "${t.token}"`).join('\n');
  const user = `Total tokens: ${ctx.tokens.length}

Token array:
${tokenList}

Return the word groupings now, following every rule in the system prompt exactly. Return only the JSON object.`;

  return { system, user };
}
