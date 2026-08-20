// Fixes Thai word/syllable fragmentation from Whisper's word-level
// timestamps. See prompts/word-segment.ts (kept for reference/possible
// future use) for the *first* attempt at this — using GPT to regroup
// fragments by choosing index ranges. That approach is NOT used anymore:
// a real user screenshot after deploying it showed garbled results
// (fragments merged in the wrong order/combination, in some spots worse
// than the original un-regrouped tokens) — GPT-4o-mini's own merge
// decisions weren't reliable enough for this, and its coverage-repair
// fallback (for any indices it left ungrouped) dumped raw leftover tokens
// verbatim with zero orthographic awareness, which is exactly the kind of
// invalid-looking chunk seen in that screenshot.
//
// Replaced with a purely rule-based, deterministic repair instead. This is
// slower to reach full "one block per real word" (Whisper's native token
// granularity for Thai is often at the syllable level, so blocks may still
// be per-syllable rather than per-word after this — a real limitation,
// not hidden), but it can never produce an orthographically-invalid
// result, unlike the AI approach. Two rules, both unconditionally true in
// Thai script (not guesses):
//   1. A token that is NOTHING BUT a leading vowel (เ แ โ ใ ไ) is always a
//      fragment — Thai leading vowels are written before the consonant
//      they're pronounced after, so it always belongs to the following
//      token. Merge forward.
//   2. A token that STARTS with a non-spacing combining mark (tone marks,
//      above/below vowels) or one of the two spacing marks that always
//      attach to the preceding consonant (ะ, ำ) can never legitimately
//      start a token/word. Merge backward into the previous token.

import type { TimedWord } from './srt';

const THAI_LEADING_VOWEL_RE = /^[เแโใไ]$/; // เ แ โ ใ ไ, alone
const THAI_BACKWARD_ATTACH_RE = /^[ะัำ-ฺ็-๎]/; // ะ ั ำ ิ ี ึ ื ุ ู ฺ ์ ็ ่ ้ ๊ ๋ ํ ๎ as the first char

export function repairThaiTokenFragments(words: TimedWord[]): TimedWord[] {
  if (words.length === 0) return words;

  // Pass 1: a bare leading-vowel token always merges forward into the next token.
  const step1: TimedWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const trimmed = w.word.trim();
    if (THAI_LEADING_VOWEL_RE.test(trimmed) && i + 1 < words.length) {
      const next = words[i + 1];
      step1.push({ word: trimmed + next.word.trim(), start: w.start, end: next.end });
      i++; // the next token was consumed into this merge
    } else {
      step1.push({ word: trimmed, start: w.start, end: w.end });
    }
  }

  // Pass 2: a token starting with a backward-attaching mark always merges
  // into the previous token.
  const step2: TimedWord[] = [];
  for (const w of step1) {
    if (step2.length > 0 && w.word.length > 0 && THAI_BACKWARD_ATTACH_RE.test(w.word)) {
      const prev = step2[step2.length - 1];
      prev.word = prev.word + w.word;
      prev.end = w.end;
    } else {
      step2.push({ ...w });
    }
  }

  return step2.filter((w) => w.word.length > 0 && w.end >= w.start);
}

// Kept as the exported name every call site already uses
// (app/api/tools/editor/transcribe/route.ts, app/api/tools/editor/run/route.ts)
// so no changes were needed there when this was rewritten from the AI
// approach to the deterministic one above.
export async function regroupWhisperWordsThai(words: TimedWord[]): Promise<TimedWord[]> {
  return repairThaiTokenFragments(words);
}
