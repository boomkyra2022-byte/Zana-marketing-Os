// Fixes Thai word/syllable fragmentation from Whisper's word-level
// timestamps.
//
// History (kept for context, do not repeat these mistakes):
// 1. First attempt (see prompts/word-segment.ts, unused now) used GPT to
//    regroup fragments by choosing index ranges. A real user screenshot
//    after deploying it showed WORSE results than doing nothing — GPT's
//    merge decisions weren't reliable and its fallback for leftover indices
//    dumped raw fragments verbatim.
// 2. Second attempt (the previous version of this file) was a deterministic
//    Unicode-rule repair: merge bare leading-vowel tokens forward, merge
//    tokens starting with a combining mark backward. This can never produce
//    an orthographically-invalid result, but it only repairs BROKEN
//    characters — it has no idea where real Thai word boundaries are, so
//    output was still frequently at the syllable/fragment level, not the
//    word level. Real user feedback: "ตัวหนังสือยังไม่ลงกันมักจะเป็นพวกตัวสระ".
//
// This version (3) does real Thai word segmentation:
//   1. Whisper's raw per-token timestamps are expanded to a per-CHARACTER
//      timestamp by linear interpolation across each token's [start, end]
//      window (standard "time-proportional to character count" estimate —
//      not phoneme-accurate, but a solid approximation and the same
//      technique most auto-caption tools use for sub-word timing).
//   2. Consecutive Thai-script tokens are concatenated back into a plain
//      running Thai string (Thai has no spaces, so this exactly
//      reconstructs what was actually said) and re-segmented using
//      `wordcut` — a real dictionary-based Thai word breaker — instead of
//      trusting Whisper's own (BPE, not linguistic) token boundaries.
//   3. Each real word `wordcut` finds is mapped back to a start/end time by
//      reading the first and last character's interpolated timestamps.
//   4. Non-Thai tokens (English words, numbers, product codes) are left
//      completely untouched — Whisper's own segmentation for Latin script
//      is already reliable, and re-running them through a Thai-specific
//      dictionary breaker would only add risk for zero benefit.
//
// This is NOT 100% perfect — Thai itself has genuinely ambiguous word
// boundaries that even human readers split differently (e.g. ตากลม can be
// ตา-กลม or ตาก-ลม) — but dictionary-based segmentation is the correct class
// of tool for this problem, unlike step 2's Unicode-only patch. If `wordcut`
// throws for any input, this falls back to the step-2 Unicode repair for
// that run rather than crashing the transcription pipeline.

import wordcut from 'wordcut';
import type { TimedWord } from './srt';

const THAI_CHAR_RE = /[฀-๿]/;

function isThaiToken(s: string): boolean {
  return THAI_CHAR_RE.test(s);
}

let wordcutReady = false;
function getWordcut() {
  if (!wordcutReady) {
    // Synchronous, loads the bundled dictionary once per warm serverless
    // instance (module-level flag survives across invocations on the same
    // instance, so this only pays its cost on true cold starts).
    wordcut.init();
    wordcutReady = true;
  }
  return wordcut;
}

const THAI_LEADING_VOWEL_RE = /^[เแโใไ]$/; // เ แ โ ใ ไ, alone
const THAI_BACKWARD_ATTACH_RE = /^[ะัำ-ฺ็-๎]/; // ะ ั ำ ิ ี ึ ื ุ ู ฺ ์ ็ ่ ้ ๊ ๋ ํ ๎ as the first char

// Kept as the safety-net fallback if `wordcut` ever throws on a given run —
// never produces an orthographically-invalid result even though it doesn't
// find real word boundaries. See file header, history item 2.
function repairThaiTokenFragments(words: TimedWord[]): TimedWord[] {
  if (words.length === 0) return words;

  const step1: TimedWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const trimmed = w.word.trim();
    if (THAI_LEADING_VOWEL_RE.test(trimmed) && i + 1 < words.length) {
      const next = words[i + 1];
      step1.push({ word: trimmed + next.word.trim(), start: w.start, end: next.end });
      i++;
    } else {
      step1.push({ word: trimmed, start: w.start, end: w.end });
    }
  }

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

interface CharTime {
  ch: string;
  start: number;
  end: number;
}

// Distributes each token's real [start, end] duration evenly across its
// characters. Concatenating tokens in order gives a monotonic per-character
// timeline for the whole run.
function expandToChars(words: TimedWord[]): CharTime[] {
  const chars: CharTime[] = [];
  for (const w of words) {
    const n = w.word.length;
    if (n === 0) continue;
    const span = Math.max(0, w.end - w.start);
    for (let i = 0; i < n; i++) {
      const s = w.start + (span * i) / n;
      const e = w.start + (span * (i + 1)) / n;
      chars.push({ ch: w.word[i], start: s, end: Math.max(e, s) });
    }
  }
  return chars;
}

// Re-segments one run of consecutive Thai-script tokens into real
// dictionary-backed words with interpolated timestamps.
function resegmentThaiRun(runWords: TimedWord[]): TimedWord[] {
  const trimmed = runWords.map((w) => ({ word: w.word.trim(), start: w.start, end: w.end })).filter((w) => w.word.length > 0);
  if (trimmed.length === 0) return [];

  const chars = expandToChars(trimmed);
  const text = chars.map((c) => c.ch).join('');
  if (text.length === 0) return [];

  try {
    const wc = getWordcut();
    const ranges = wc.cutIntoRanges(text, true);
    const out: TimedWord[] = [];
    for (const r of ranges) {
      if (!Number.isFinite(r.s) || !Number.isFinite(r.e) || r.e <= r.s) continue;
      const s = Math.max(0, r.s);
      const e = Math.min(chars.length, r.e);
      if (e <= s) continue;
      const word = text.slice(s, e);
      const start = chars[s].start;
      const end = chars[e - 1].end;
      out.push({ word, start, end: Math.max(end, start) });
    }
    return out.length > 0 ? out : repairThaiTokenFragments(trimmed);
  } catch {
    // A dictionary/library failure must never break transcription —
    // degrade to the Unicode-rule repair instead of throwing.
    return repairThaiTokenFragments(trimmed);
  }
}

// Main entry point. Splits the word stream into alternating Thai/non-Thai
// runs, re-segments only the Thai runs (via wordcut), and leaves everything
// else exactly as Whisper produced it.
export function repairThaiTokenFragments_v3(words: TimedWord[]): TimedWord[] {
  if (words.length === 0) return words;

  const out: TimedWord[] = [];
  let i = 0;
  while (i < words.length) {
    const trimmed = words[i].word.trim();
    if (trimmed.length === 0) {
      i++;
      continue;
    }

    if (isThaiToken(trimmed)) {
      const run: TimedWord[] = [];
      while (i < words.length) {
        const cur = words[i].word.trim();
        if (cur.length === 0) {
          i++;
          continue;
        }
        if (!isThaiToken(cur)) break;
        run.push({ word: cur, start: words[i].start, end: words[i].end });
        i++;
      }
      out.push(...resegmentThaiRun(run));
    } else {
      out.push({ word: trimmed, start: words[i].start, end: words[i].end });
      i++;
    }
  }

  return out.filter((w) => w.word.length > 0 && w.end >= w.start);
}

// Kept as the exported name every call site already uses
// (app/api/tools/editor/transcribe/route.ts, app/api/tools/editor/run/route.ts)
// so no changes were needed there when this was rewritten.
export async function regroupWhisperWordsThai(words: TimedWord[]): Promise<TimedWord[]> {
  return repairThaiTokenFragments_v3(words);
}
