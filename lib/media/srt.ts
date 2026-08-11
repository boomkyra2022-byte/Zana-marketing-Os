// Resolves the AI's word-index-based subtitle cues (see prompts/punchy-subtitle.ts)
// into real timestamps and a plain-text .srt file. Timestamps always come
// from the actual Whisper word timings passed in — the AI never invents
// times, it only picks word-index boundaries; this module is what turns
// those into MM:SS,mmm and guarantees full, non-overlapping coverage of the
// video before the file goes out the door ("ตรวจสอบว่าเวลาต่อเนื่องครบตลอด
// วิดีโอก่อนส่ง" — checked here in code, not just asked of the model).

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface RawCue {
  start_word_index: number;
  end_word_index: number;
  text: string;
}

export interface TimedCue {
  start: number;
  end: number;
  text: string;
}

// Repairs gaps/overlaps the model may have left: fills any uncovered word
// range with a plain fallback cue (joined words, no fancy spacing) instead
// of silently dropping audio from the subtitle track, and clips overlaps so
// no word is claimed by two cues.
export function repairCueCoverage(words: TimedWord[], rawCues: RawCue[]): RawCue[] {
  const sorted = rawCues
    .filter((c) => Number.isFinite(c.start_word_index) && Number.isFinite(c.end_word_index) && c.end_word_index >= c.start_word_index && c.start_word_index >= 0 && c.end_word_index < words.length)
    .sort((a, b) => a.start_word_index - b.start_word_index);

  const result: RawCue[] = [];
  let cursor = 0;

  for (const c of sorted) {
    const start = Math.max(c.start_word_index, cursor);
    if (start > c.end_word_index) continue; // fully consumed by a previous cue already

    if (start > cursor) {
      const gapWords = words.slice(cursor, start).map((w) => w.word.trim()).filter(Boolean);
      if (gapWords.length > 0) {
        result.push({ start_word_index: cursor, end_word_index: start - 1, text: gapWords.join('') });
      }
    }
    result.push({ start_word_index: start, end_word_index: c.end_word_index, text: c.text });
    cursor = c.end_word_index + 1;
  }

  if (cursor < words.length) {
    const gapWords = words.slice(cursor).map((w) => w.word.trim()).filter(Boolean);
    if (gapWords.length > 0) {
      result.push({ start_word_index: cursor, end_word_index: words.length - 1, text: gapWords.join('') });
    }
  }

  return result;
}

export function resolveCueTimestamps(words: TimedWord[], cues: RawCue[]): TimedCue[] {
  return cues
    .map((c) => ({
      start: words[c.start_word_index]?.start ?? 0,
      end: words[c.end_word_index]?.end ?? 0,
      text: c.text.trim()
    }))
    .filter((c) => c.text.length > 0 && c.end > c.start)
    .sort((a, b) => a.start - b.start);
}

function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

// Plain-text SRT, no HTML/color/effect tags — CapCut and every other editor
// reads this cleanly.
export function cuesToSrt(cues: TimedCue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${formatSrtTimestamp(c.start)} --> ${formatSrtTimestamp(c.end)}\n${c.text}\n`)
    .join('\n');
}
