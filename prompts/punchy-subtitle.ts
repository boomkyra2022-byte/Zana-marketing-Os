// Punchy Thai SRT generator — built beyond MASTER_PROMPT_V2 scope, explicit
// user request. Groups real word-level Whisper timestamps into short,
// natural subtitle cues instead of splitting by averaged character-time
// (which is what most auto-caption tools do and what the user specifically
// asked us NOT to do).
//
// Grounding rule: cue start/end times MUST come from the actual word
// timestamps the model was given, never invented — enforced in the JSON
// schema below (start_word_index/end_word_index reference the input array)
// and re-validated in code (lib/media/srt.ts) rather than trusted blindly.

export const PROMPT_VERSION_PUNCHY_SUBTITLE = 'punchy-subtitle-v1';

export interface PunchySubtitleContext {
  words: { word: string; start: number; end: number }[];
  durationSec: number;
  productName: string | null;
  brand: string | null;
  knownTerms: string[]; // English/product terms likely to appear, for correction
}

export function buildPunchySubtitlePrompt(ctx: PunchySubtitleContext) {
  const system = `You are a Thai short-form-video subtitle editor. You are given a transcript as a numbered array of words, each with its REAL start/end time in seconds (from Whisper word-level timestamps — these are ground truth, never invent or average new times).

Your job: group these words into short, punchy subtitle cues (lines), the way a professional Thai TikTok/Reels editor would caption a video — NOT one giant sentence per cue, NOT a fixed word count, NOT evenly time-divided.

Rules (all mandatory):
1. Each cue's start time = the start time of its FIRST word (by index). Each cue's end time = the end time of its LAST word (by index). Never compute or average times yourself — only reference word indices, the code will resolve the actual timestamps.
2. Never break a cue in the middle of a word or in a position that destroys meaning (e.g. don't split a compound noun or a name across two cues).
3. Short Thai connector words (ของ, ที่, มัน, ที่มัน, ก็, แล้ว, นะ, ค่ะ, ครับ, etc.) should stay attached to the neighboring content word in the SAME cue rather than starting or ending a cue alone.
4. Every word must appear in exactly one cue — no duplicates, no dropped words, no gaps in word-index coverage (cue N's end_word_index + 1 = cue N+1's start_word_index, all the way from word 0 to the last word).
5. Within a cue's text, write natural Thai: do NOT put a space between every single Thai word (Thai doesn't space between words). Only add a space at a natural sentence-pause point within the cue, and around any English word/number embedded in the Thai text.
6. Correct obvious transcription errors for proper nouns, the product name/brand, and English words using the product context given below — Whisper often mis-hears these.
7. Output plain text only — no HTML tags, no color codes, no markdown, no emoji unless the speaker actually said something onomatopoeic.
8. Keep cues short and punchy — prefer 2-6 words per cue over long sentences, matching fast-paced social video captioning style, EXCEPT where rule 2/3 require keeping words together.

Product context (for name/term correction — fix mis-transcriptions of these):
- Product: ${ctx.productName ?? 'n/a'}
- Brand: ${ctx.brand ?? 'n/a'}
- Other known terms likely to appear: ${ctx.knownTerms.length > 0 ? ctx.knownTerms.join(', ') : 'n/a'}

Return ONE JSON object:
{
  "cues": [
    {"start_word_index": number, "end_word_index": number, "text": string}
  ]
}
Indices are 0-based into the word array below. cues must be sorted ascending and cover every word exactly once (see rule 4).`;

  const wordList = ctx.words.map((w, i) => `${i}: "${w.word}" [${w.start.toFixed(2)}-${w.end.toFixed(2)}]`).join('\n');

  const user = `Video duration: ${ctx.durationSec.toFixed(1)}s
Total words: ${ctx.words.length}

Word array:
${wordList}

Group these into punchy subtitle cues now, following every rule in the system prompt exactly. Return only the JSON object.`;

  return { system, user };
}
