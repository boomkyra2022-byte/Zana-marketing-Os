// Resolves the AI's word-index-based subtitle cues (see prompts/punchy-subtitle.ts)
// into real timestamps and a plain-text .srt file. Timestamps always come
// from the actual Whisper word timings passed in — the AI never invents
// times, it only picks word-index boundaries.
//
// v2: cue TEXT is always assembled here from the real transcribed words
// (never taken from the AI, which used to retype it and occasionally
// hallucinate/paraphrase — confirmed by a real CapCut import test showing
// garbled Thai). The AI may flag specific word indices for correction
// (mis-heard product/brand terms); those substitutions are applied to
// individual words before joining, everything else is verbatim Whisper
// output. "ตรวจสอบว่าเวลาต่อเนื่องครบตลอดวิดีโอก่อนส่ง" is enforced here in
// code (repairCueCoverage), not just asked of the model.

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface RawCue {
  start_word_index: number;
  end_word_index: number;
}

export interface WordCorrection {
  word_index: number;
  corrected_word: string;
}

export interface TimedCue {
  start: number;
  end: number;
  text: string;
}

// Repairs gaps/overlaps the model may have left: fills any uncovered word
// range with its own cue instead of silently dropping audio from the
// subtitle track, and clips overlaps so no word is claimed by two cues.
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
      result.push({ start_word_index: cursor, end_word_index: start - 1 });
    }
    result.push({ start_word_index: start, end_word_index: c.end_word_index });
    cursor = c.end_word_index + 1;
  }

  if (cursor < words.length) {
    result.push({ start_word_index: cursor, end_word_index: words.length - 1 });
  }

  return result;
}

const THAI_CHAR_RE = /[฀-๿]/;

// Thai has no spaces between words; Whisper's word tokens for Thai often
// aren't real linguistic words either (BPE-based), so we don't trust any
// spacing the model implies — we rebuild it: no space between two Thai
// characters, a space wherever a Latin/number run meets Thai (or another
// Latin run), matching "เว้นวรรคเฉพาะจุดพักประโยคและรอบคำภาษาอังกฤษ".
function joinWordsThai(tokens: string[]): string {
  let out = '';
  let prevChar = '';
  for (const raw of tokens) {
    const w = raw.trim();
    if (!w) continue;
    const firstChar = w[0];
    if (out.length > 0) {
      const prevIsThai = THAI_CHAR_RE.test(prevChar);
      const curIsThai = THAI_CHAR_RE.test(firstChar);
      if (!(prevIsThai && curIsThai)) out += ' ';
    }
    out += w;
    prevChar = w[w.length - 1];
  }
  return out;
}

export function resolveCueTimestamps(words: TimedWord[], cues: RawCue[], corrections: WordCorrection[] = []): TimedCue[] {
  const correctionMap = new Map<number, string>();
  for (const c of corrections) {
    if (Number.isFinite(c.word_index) && typeof c.corrected_word === 'string' && c.corrected_word.trim()) {
      correctionMap.set(c.word_index, c.corrected_word.trim());
    }
  }

  return cues
    .map((c) => {
      const slice = words.slice(c.start_word_index, c.end_word_index + 1);
      const tokens = slice.map((w, i) => correctionMap.get(c.start_word_index + i) ?? w.word);
      return {
        start: words[c.start_word_index]?.start ?? 0,
        end: words[c.end_word_index]?.end ?? 0,
        text: joinWordsThai(tokens)
      };
    })
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
