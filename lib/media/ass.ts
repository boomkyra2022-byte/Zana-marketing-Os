// Styled subtitle (.ass) generator — added per explicit user request to
// replicate tamsub.com's own subtitle-styling editor (font picker w/
// preview, size slider, words-per-line, text color, highlight color) inside
// our own Editor tool, so Punchy SRT can burn styled captions straight onto
// the video instead of only exporting a plain .srt for manual CapCut import.
//
// Approach: for each cue, emit one Dialogue line PER WORD, each spanning
// that word's own real Whisper timing window, showing the FULL cue text
// every time but with only the currently-spoken word wrapped in the
// highlight color (\c override) and every other word left in the style's
// default (base) color. This gives the classic "current word pops in an
// accent color while the rest of the line stays readable" caption look,
// and is more predictable than ASS's native \k karaoke-color semantics
// (which persist the "already sung" color rather than isolating just the
// active word).
//
// Timestamps/word text come from lib/media/srt.ts's
// resolveCueTimestampsWithWords() — same real-Whisper-timing grounding as
// the plain-SRT path, never invented.

import type { TimedCueWithWords } from './srt';

export interface KaraokeStyle {
  fontName: string;
  fontSizePx: number;
  textColorHex: string; // e.g. "#FFFFFF"
  highlightColorHex: string; // e.g. "#FACC15"
  videoWidth: number;
  videoHeight: number;
}

function hexToAssColor(hex: string): string {
  const clean = hex.replace('#', '').padStart(6, '0');
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  // ASS colors are &H00BBGGRR (alpha=00 opaque, then blue/green/red reversed from typical hex).
  return `&H00${b}${g}${r}`.toUpperCase();
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\n/g, '\\N');
}

function formatAssTimestamp(seconds: number): string {
  const totalCs = Math.max(0, Math.round(seconds * 100));
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

export function buildKaraokeAss(cues: TimedCueWithWords[], style: KaraokeStyle): string {
  const fontSize = Math.max(12, Math.round(style.fontSizePx));
  const baseColor = hexToAssColor(style.textColorHex);
  const highlightColor = hexToAssColor(style.highlightColorHex);
  const outlineColor = '&H00000000';
  const backColor = '&H80000000';
  const marginV = Math.round(style.videoHeight * 0.12);
  const marginLR = Math.round(style.videoWidth * 0.06);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${style.videoWidth}
PlayResY: ${style.videoHeight}
WrapStyle: 1
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${fontSize},${baseColor},${baseColor},${outlineColor},${backColor},-1,0,0,0,100,100,0,0,1,3,0,2,${marginLR},${marginLR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const lines: string[] = [];

  for (const cue of cues) {
    if (cue.words.length === 0) continue;

    // One event per word so exactly one word is highlighted at a time;
    // together they cover the cue's full [start, end] range with no gaps
    // (each word's window is extended to the start of the next word so
    // natural micro-pauses between words don't create a blank frame).
    for (let i = 0; i < cue.words.length; i++) {
      const word = cue.words[i];
      const eventStart = word.start;
      const eventEnd = i < cue.words.length - 1 ? cue.words[i + 1].start : cue.end;
      if (eventEnd <= eventStart) continue;

      const text = cue.words
        .map((w, idx) => {
          const escaped = escapeAssText(w.text);
          return idx === i ? `{\\c${highlightColor}}${escaped}{\\c${baseColor}}` : escaped;
        })
        .join('');

      lines.push(`Dialogue: 0,${formatAssTimestamp(eventStart)},${formatAssTimestamp(eventEnd)},Default,,0,0,0,,${text}`);
    }
  }

  return `${header}\n${lines.join('\n')}\n`;
}
