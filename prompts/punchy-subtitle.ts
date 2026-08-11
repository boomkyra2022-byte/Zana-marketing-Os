// Punchy Thai SRT generator — built beyond MASTER_PROMPT_V2 scope, explicit
// user request. Groups real word-level Whisper timestamps into short,
// natural subtitle cues instead of splitting by averaged character-time
// (which is what most auto-caption tools do and what the user specifically
// asked us NOT to do).
//
// IMPORTANT (v2, after real-world test found garbled Thai text on import
// into CapCut): the model does NOT get to write cue text freely anymore.
// v1 let it retype each cue's text, which decoupled the displayed words
// from what Whisper actually heard — the model would occasionally
// paraphrase/hallucinate, producing text that didn't match the audio at
// all. Now the model ONLY chooses word-index boundaries (grounded,
// re-validated in code) and may optionally flag specific word indices for
// correction (e.g. a mis-heard product name) — the actual cue text is
// always assembled in code directly from the real transcribed words
// (see lib/media/srt.ts), with corrections applied only where explicitly
// flagged. This guarantees the .srt always reflects real speech.

export const PROMPT_VERSION_PUNCHY_SUBTITLE = 'punchy-subtitle-v2';

export interface PunchySubtitleContext {
  words: { word: string; start: number; end: number }[];
  durationSec: number;
  productName: string | null;
  brand: string | null;
  knownTerms: string[]; // English/product terms likely to appear, for correction
}

export function buildPunchySubtitlePrompt(ctx: PunchySubtitleContext) {
  const system = `You are a Thai short-form-video subtitle editor. You are given a transcript as a numbered array of words, each with its REAL start/end time in seconds (from Whisper word-level timestamps — ground truth, you never invent or reference times directly).

Your ONLY two jobs:

JOB 1 — Group words into short, punchy subtitle cues by WORD INDEX ONLY (you never write cue text — the system assembles it from the actual words for you, so there is zero risk of your output drifting from what was really said):
1. Every word must belong to exactly one cue — no duplicates, no dropped words, no gaps: cue N's end_word_index + 1 must equal cue N+1's start_word_index, starting at word 0 and ending at the last word index.
2. Never break a cue in a position that destroys meaning (e.g. never split a compound noun or a name across two cues).
3. Short Thai connector words (ของ, ที่, มัน, ที่มัน, ก็, แล้ว, นะ, ค่ะ, ครับ, etc.) must stay in the SAME cue as the neighboring content word — never alone at the start/end of a cue.
4. Prefer short, punchy groupings (roughly 2-6 words per cue) over long sentences — this is fast-paced social video captioning — EXCEPT where rules 2/3 require keeping words together.

JOB 2 — Flag ONLY obvious mis-transcriptions of the specific product name, brand, or English/technical terms listed below (Whisper commonly mis-hears these). For each word index that is clearly a mangled version of one of these known terms, return a correction. Do NOT "correct" anything else — no general rewriting, no fixing filler words, no rephrasing. If nothing needs correction, return an empty corrections array.

Known terms to check for (fix mis-transcriptions of these ONLY):
- Product: ${ctx.productName ?? 'n/a'}
- Brand: ${ctx.brand ?? 'n/a'}
- Other: ${ctx.knownTerms.length > 0 ? ctx.knownTerms.join(', ') : 'n/a'}

Return ONE JSON object:
{
  "cues": [{"start_word_index": number, "end_word_index": number}],
  "corrections": [{"word_index": number, "corrected_word": string}]
}
cues must be sorted ascending by start_word_index and cover every word index exactly once, from 0 to the last index, with no gaps or overlaps.`;

  const wordList = ctx.words.map((w, i) => `${i}: "${w.word}" [${w.start.toFixed(2)}-${w.end.toFixed(2)}]`).join('\n');

  const user = `Video duration: ${ctx.durationSec.toFixed(1)}s
Total words: ${ctx.words.length}

Word array:
${wordList}

Return the cue groupings and any term corrections now, following every rule in the system prompt exactly. Return only the JSON object.`;

  return { system, user };
}
