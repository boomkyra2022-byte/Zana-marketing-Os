// No official TypeScript types exist for the `wordcut` npm package (plain
// CommonJS module, `module.exports = Wordcut` — a singleton object created
// via Object.create, not a class). Minimal ambient declaration covering only
// the methods this project actually calls
// (see lib/media/word-segment.ts). Verified against the real source at
// https://github.com/veer66/wordcut/blob/master/lib/wordcut_core.js.
declare module 'wordcut' {
  interface WordcutRange {
    s: number;
    e: number;
    text?: string;
  }

  interface WordcutInstance {
    // dictPath: array of glob patterns to additional dictionary files (or
    // undefined for the bundled default). withDefault: also load the
    // bundled default dictionary alongside any custom one.
    init(dictPath?: string[] | null, withDefault?: boolean, additionalWords?: string[]): void;
    cut(text: string, delimiter?: string): string;
    cutIntoArray(text: string): string[];
    // noText=true skips attaching `.text` on each range (we slice the
    // source string ourselves using s/e, so we always pass true).
    cutIntoRanges(text: string, noText?: boolean): WordcutRange[];
  }

  const wordcut: WordcutInstance;
  export = wordcut;
}
