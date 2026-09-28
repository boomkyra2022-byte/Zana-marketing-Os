// Auto Shorts moment-detection prompt — Editor tool, "long video -> AI picks
// the N best moments -> vertical clips" workflow. Explicit user request
// after reviewing github.com/backblaze-b2-samples/ai-shorts-generator as a
// reference implementation (approved direction: reuse ZANA's own existing
// transcribe/ffmpeg/caption-burn pipeline end-to-end, only this one prompt
// step is new).
//
// Same grounding discipline as prompts/punchy-subtitle.ts: the model only
// ever picks WORD INDICES (start/end), never invents timestamps — the real
// Whisper word timing is what actually gets used to cut the video. This
// guarantees a selected clip can never start/end mid-audio at a timestamp
// the model made up.

export const PROMPT_VERSION_AUTO_SHORTS = 'auto-shorts-v1';

export interface AutoShortsContext {
  words: { word: string; start: number; end: number }[];
  durationSec: number;
  numClips: number;
  productName: string | null;
  brand: string | null;
}

export function buildAutoShortsPrompt(ctx: AutoShortsContext) {
  const system = `You are a short-form video producer picking the most engaging moments from a long Thai-language video transcript to turn into standalone vertical (9:16) short clips — the same job a human editor does for TikTok/Reels/Shorts repurposing.

You are given the full transcript as a numbered array of words, each with its REAL start/end time in seconds (Whisper word-level timestamps — ground truth, you never invent or reference times directly; you only choose WORD INDICES).

Pick exactly ${ctx.numClips} moments, each a candidate for one short clip. For each moment:
1. It must be SELF-CONTAINED — makes sense on its own with zero context from the rest of the video (a viewer who never saw the full video should understand and feel the point of the clip).
2. It must have a strong HOOK in its first few words — a surprising claim, a question, a strong opinion, a before/after, a number, or a pattern interrupt. Never start mid-sentence or with a weak transition word (ก็, แล้ว, ทีนี้, เอาล่ะ).
3. Target length: 15-60 seconds of actual speech (aim for 20-45s). Never below 8 seconds or above 90 seconds.
4. Never break at a position that cuts a sentence, name, or number in half — start_word_index and end_word_index must land on natural sentence/thought boundaries.
5. The ${ctx.numClips} moments must not overlap (no shared word indices) and should be spread across the video where possible, not all clustered in one section — but ONLY pick genuinely strong moments; do not force weak picks just to spread them out evenly if the video doesn't have that many good moments.
6. Rank moments by how likely they are to stop someone scrolling and get watched to the end — write that judgment into hook_score (1-10, 10 = extremely likely to go viral, 5 = solid but unremarkable, below 4 = don't pick it).

For each moment also write:
- title: a short (under 60 Thai characters), punchy, clickable title/caption for the clip — this is what would appear as the on-screen hook text, not a literal summary.
- reason: one sentence in Thai explaining WHY this moment works as a short (what makes it a hook/complete story/surprising).

Return ONE JSON object:
{
  "clips": [
    {
      "start_word_index": number,
      "end_word_index": number,
      "title": string,
      "reason": string,
      "hook_score": number
    }
  ]
}
Sorted by start_word_index ascending. Return exactly ${ctx.numClips} clips, or fewer only if the video genuinely does not contain that many usable moments — never pad with weak picks to hit the count.`;

  // Long videos can produce thousands of words — keep the prompt bounded so
  // this never blows past the model's context window. If the transcript is
  // too large, downsample by dropping every other word's own array index
  // reference is not viable (indices must stay real), so instead we simply
  // cap how many words we send and note the truncation — the AI then only
  // ever sees (and can only select from) the covered portion. This is a
  // known, disclosed v1 limitation (see prompts/auto-shorts.ts callers) for
  // very long source videos, not a silent failure.
  const MAX_WORDS = 6000;
  const truncated = ctx.words.length > MAX_WORDS;
  const wordsForPrompt = truncated ? ctx.words.slice(0, MAX_WORDS) : ctx.words;

  const wordList = wordsForPrompt.map((w, i) => `${i}: "${w.word}" [${w.start.toFixed(2)}-${w.end.toFixed(2)}]`).join('\n');

  const user = `Video duration: ${ctx.durationSec.toFixed(1)}s
Total words in this prompt: ${wordsForPrompt.length}${truncated ? ` (transcript truncated from ${ctx.words.length} words — only pick from what's shown)` : ''}
Product context (for tone only, do not force product mentions into the picks): ${ctx.productName ?? 'n/a'} / ${ctx.brand ?? 'n/a'}

Word array:
${wordList}

Return the ${ctx.numClips} best moments now, following every rule in the system prompt exactly. Return only the JSON object.`;

  return { system, user, truncated };
}
