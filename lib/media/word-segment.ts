// Orchestrates the Thai word-segmentation regroup (see
// prompts/word-segment.ts for the why). Called once, right after
// transcribeAudioWithTimestamps(), before any cue-grouping or rendering
// code sees the "words" array — every downstream consumer (punchy-subtitle
// cue grouping, the Live Editor timeline, the ASS karaoke burn-in) then
// naturally gets real words for free, no changes needed on their end.

import { callOpenAIJSON, AIProviderError } from '@/lib/ai/openai';
import { buildWordSegmentPrompt } from '@/prompts/word-segment';
import { repairCueCoverage, type RawCue, type TimedWord } from './srt';

const THAI_CHAR_RE = /[฀-๿]/;

export async function regroupWhisperWordsThai(words: TimedWord[]): Promise<TimedWord[]> {
  if (words.length === 0) return words;

  // Skip the extra AI round-trip when there's no Thai in the transcript at
  // all — Whisper's tokens for space-delimited languages (English, etc.)
  // are already real words, so regrouping would be pure cost with no benefit.
  const hasThaiChar = words.some((w) => THAI_CHAR_RE.test(w.word));
  if (!hasThaiChar) return words;

  const { system, user } = buildWordSegmentPrompt({
    tokens: words.map((w) => ({ token: w.word, start: w.start, end: w.end }))
  });

  let aiText: string;
  try {
    const res = await callOpenAIJSON({ system, user, temperature: 0, timeoutMs: 60000 });
    aiText = res.text;
  } catch {
    // Word-segmentation is a quality improvement, not a hard requirement —
    // if the AI call itself fails (timeout, provider error), fall back to
    // the raw Whisper tokens rather than failing the whole transcribe/run.
    return words;
  }

  let rawGroups: RawCue[];
  try {
    const parsed = JSON.parse(aiText);
    rawGroups = Array.isArray(parsed?.groups) ? parsed.groups : [];
  } catch {
    return words; // same fallback reasoning as above
  }

  const repaired = repairCueCoverage(words, rawGroups);

  const merged = repaired
    .map((g): TimedWord | null => {
      const slice = words.slice(g.start_word_index, g.end_word_index + 1);
      if (slice.length === 0) return null;
      return {
        word: slice.map((w) => w.word.trim()).join(''),
        start: slice[0].start,
        end: slice[slice.length - 1].end
      };
    })
    .filter((w): w is TimedWord => !!w && w.word.length > 0 && w.end > w.start);

  // Sanity check: if the regroup somehow produced nothing usable, fall back
  // rather than breaking the pipeline over a quality-only feature.
  return merged.length > 0 ? merged : words;
}

// Re-exported for callers that want to surface AI errors distinctly if they
// choose not to use the built-in fallback-on-failure behavior above.
export { AIProviderError };
