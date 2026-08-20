'use client';

// Tamsub-style Live Editor: video preview with captions overlaid live as
// you scrub, plus a scrubbable timeline (waveform + one block per word) you
// can drag to retime and click into to retype. Added per explicit user
// request — sent a screenshot of tamsub.com's own post-upload editor and
// asked for "หน้าตาเป็นแบบ Tamsub" (timeline + live preview, not just the
// style panel that already existed).
//
// Data flow: the parent (editor-client.tsx) calls POST
// /api/tools/editor/transcribe once to get real Whisper-timed cues/words,
// passes them in here as `cues`, and this component only ever mutates that
// array via `onCuesChange` — the parent owns state, this is a controlled
// component. On export, the parent sends the (possibly edited) cues back to
// POST /api/tools/editor/run, which burns them verbatim (skips
// re-transcribing, so edits made here are never silently discarded).
//
// Waveform is decoded client-side via the Web Audio API from the extracted
// .mp3 (not the original source video — arbitrary upload formats like
// .mov/.mkv aren't reliably decodable by decodeAudioData, mp3 always is).
// If decoding fails for any reason, the timeline still works (word
// blocks/dragging/seeking) — the waveform is a visual aid, not a
// dependency, and a failure is shown as a flat placeholder rather than
// blocking the feature.

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface LivePreviewWord {
  text: string;
  start: number;
  end: number;
  durationCs: number;
}

export interface LivePreviewCue {
  start: number;
  end: number;
  text: string;
  words: LivePreviewWord[];
}

interface Props {
  sourceUrl: string;
  audioUrl: string;
  durationSec: number;
  videoWidthPx: number;
  cues: LivePreviewCue[];
  onCuesChange: (cues: LivePreviewCue[]) => void;
  fontName: string;
  fontSizePx: number;
  textColor: string;
  highlightColor: string;
  verticalPositionPct: number;
}

const PX_PER_SEC = 70;
const MIN_WORD_GAP = 0.08; // seconds — smallest boundary gap allowed while dragging
const PREVIEW_VIDEO_WIDTH = 300; // fixed CSS px, used to scale fontSizePx (an actual-burned-video px value) down to preview size

interface DragState {
  cueIdx: number;
  wordIdx: number; // boundary being dragged sits just before this word
  minTime: number;
  maxTime: number;
}

export default function EditorLivePreview({
  sourceUrl,
  audioUrl,
  durationSec,
  videoWidthPx,
  cues,
  onCuesChange,
  fontName,
  fontSizePx,
  textColor,
  highlightColor,
  verticalPositionPct
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cuesRef = useRef(cues);
  const dragRef = useRef<DragState | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [waveformError, setWaveformError] = useState(false);
  const [editingWord, setEditingWord] = useState<{ cueIdx: number; wordIdx: number } | null>(null);
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);

  // Decode waveform (best-effort — see file header comment).
  useEffect(() => {
    let cancelled = false;
    async function loadWaveform() {
      try {
        const AudioCtx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) throw new Error('AudioContext unsupported');
        const ctx = new AudioCtx();
        const res = await fetch(audioUrl);
        const arrayBuffer = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        const channel = decoded.getChannelData(0);
        const buckets = Math.max(1, Math.round(durationSec * 20));
        const bucketSize = Math.max(1, Math.floor(channel.length / buckets));
        const result: number[] = [];
        for (let i = 0; i < buckets; i++) {
          let max = 0;
          const start = i * bucketSize;
          const end = Math.min(channel.length, start + bucketSize);
          for (let j = start; j < end; j++) {
            const v = Math.abs(channel[j]);
            if (v > max) max = v;
          }
          result.push(max);
        }
        if (!cancelled) setPeaks(result);
        ctx.close().catch(() => {});
      } catch {
        if (!cancelled) setWaveformError(true);
      }
    }
    loadWaveform();
    return () => {
      cancelled = true;
    };
  }, [audioUrl, durationSec]);

  const timelineWidth = Math.max(1, Math.round(durationSec * PX_PER_SEC));

  // Draw waveform (independent of `cues`, so word-drag doesn't redraw it).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const height = 48;
    canvas.width = timelineWidth;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, timelineWidth, height);
    ctx.fillStyle = '#38bdf8';
    const barWidth = timelineWidth / peaks.length;
    peaks.forEach((p, i) => {
      const h = Math.max(2, p * height);
      ctx.fillRect(i * barWidth, (height - h) / 2, Math.max(1, barWidth - 1), h);
    });
  }, [peaks, timelineWidth]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function onTimeUpdate() {
      if (video) setCurrentTime(video.currentTime);
    }
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  function seekTo(t: number) {
    const clamped = Math.max(0, Math.min(durationSec, t));
    if (videoRef.current) videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  }

  const active = useMemo(() => {
    for (let ci = 0; ci < cues.length; ci++) {
      const cue = cues[ci];
      if (currentTime >= cue.start && currentTime < cue.end) {
        let activeWordIdx = 0;
        for (let wi = 0; wi < cue.words.length; wi++) {
          if (cue.words[wi].start <= currentTime) activeWordIdx = wi;
          else break;
        }
        return { cueIdx: ci, wordIdx: activeWordIdx };
      }
    }
    return null;
  }, [cues, currentTime]);

  function handleHandlePointerDown(cueIdx: number, wordIdx: number, e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cue = cuesRef.current[cueIdx];
    const prevWord = cue.words[wordIdx - 1];
    const nextLimit = cue.words[wordIdx + 1]?.start ?? cue.end;
    const minTime = (prevWord ? prevWord.start : cue.start) + MIN_WORD_GAP;
    const maxTime = nextLimit - MIN_WORD_GAP;
    dragRef.current = { cueIdx, wordIdx, minTime, maxTime };
  }

  function handleHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const timeline = timelineRef.current;
    if (!drag || !timeline) return;
    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left + timeline.scrollLeft;
    let t = x / PX_PER_SEC;
    t = Math.max(drag.minTime, Math.min(drag.maxTime, t));

    const next = cuesRef.current.map((c, ci) => {
      if (ci !== drag.cueIdx) return c;
      const words = c.words.map((w, wi) => {
        if (wi === drag.wordIdx - 1) return { ...w, end: t };
        if (wi === drag.wordIdx) return { ...w, start: t };
        return w;
      });
      return { ...c, words };
    });
    // Update the ref synchronously, not just via the `cues` prop -> effect
    // round trip below — pointermove can fire multiple times before React
    // has committed the previous update and re-run that effect, which
    // would make the next drag step compute `next` from a stale base and
    // silently drop part of the drag. This was a real latent bug (found
    // during a user report that edits weren't reliably showing up),
    // independent of whether it was the actual cause in this case.
    cuesRef.current = next;
    onCuesChange(next);
  }

  function handleHandlePointerUp() {
    dragRef.current = null;
  }

  function startEditingWord(cueIdx: number, wordIdx: number) {
    setEditingWord({ cueIdx, wordIdx });
    setDraftText(cues[cueIdx].words[wordIdx].text.trim());
  }

  function commitWordText() {
    if (!editingWord) return;
    const { cueIdx, wordIdx } = editingWord;
    const next = cuesRef.current.map((c, ci) => {
      if (ci !== cueIdx) return c;
      const words = c.words.map((w, wi) => {
        if (wi !== wordIdx) return w;
        const hadLeadingSpace = w.text.startsWith(' ');
        const trimmed = draftText.trim();
        return { ...w, text: hadLeadingSpace ? ` ${trimmed}` : trimmed };
      });
      return { ...c, text: words.map((w) => w.text).join(''), words };
    });
    cuesRef.current = next; // same synchronous-ref reasoning as the drag handler above
    onCuesChange(next);
    setEditingWord(null);
  }

  const previewScale = videoWidthPx > 0 ? PREVIEW_VIDEO_WIDTH / videoWidthPx : 0.3;
  const previewFontSize = Math.max(10, Math.round(fontSizePx * previewScale));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative bg-black rounded-lg overflow-hidden shrink-0 mx-auto sm:mx-0" style={{ width: PREVIEW_VIDEO_WIDTH }}>
          <video ref={videoRef} src={sourceUrl} controls className="w-full h-auto block" style={{ width: PREVIEW_VIDEO_WIDTH }} />
          {active && cues[active.cueIdx] && (
            <div
              className="absolute left-0 right-0 px-3 text-center pointer-events-none"
              style={{ top: `${verticalPositionPct}%`, transform: 'translateY(-50%)' }}
            >
              <span style={{ fontFamily: fontName, fontSize: previewFontSize, fontWeight: 700, lineHeight: 1.3, textShadow: '0 1px 4px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)' }}>
                {cues[active.cueIdx].words.map((w, wi) => (
                  <span key={wi} style={{ color: wi === active.wordIdx ? highlightColor : textColor }}>
                    {w.text}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 text-xs text-gray-500 space-y-2">
          <p>
            เล่นวิดีโอหรือลากตรง timeline ด้านล่างเพื่อดูตัวอย่างซับสด — ลากขอบคำเพื่อปรับจังหวะ, ดับเบิลคลิกคำเพื่อแก้ข้อความ
            {waveformError && ' (โหลด waveform ไม่สำเร็จ — ยังลาก/แก้จังหวะได้ปกติ แค่ไม่มีกราฟเสียงให้ดู)'}
          </p>
          <p>{cues.length} ช่วงซับ · {cues.reduce((sum, c) => sum + c.words.length, 0)} คำ</p>
        </div>
      </div>

      <div ref={timelineRef} className="overflow-x-auto border border-border rounded-lg bg-navy" style={{ maxHeight: 160 }}>
        <div className="relative" style={{ width: timelineWidth, minWidth: '100%' }}>
          {/* Ruler */}
          <div className="relative h-5 border-b border-white/10" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / PX_PER_SEC);
          }}>
            {Array.from({ length: Math.ceil(durationSec) + 1 }).map((_, s) =>
              s % 2 === 0 ? (
                <span key={s} className="absolute text-[10px] text-gray-400" style={{ left: s * PX_PER_SEC + 2 }}>
                  {s}s
                </span>
              ) : null
            )}
          </div>

          {/* Waveform */}
          <div className="relative h-12 cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / PX_PER_SEC);
          }}>
            {peaks ? (
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="absolute inset-0 flex items-center px-1">
                <div className="w-full h-1 bg-white/10 rounded" />
              </div>
            )}
          </div>

          {/* Word blocks */}
          <div className="relative py-2" style={{ minHeight: 40 }}>
            {cues.map((cue, ci) =>
              cue.words.map((word, wi) => {
                const left = word.start * PX_PER_SEC;
                const nextStart = cue.words[wi + 1]?.start ?? cue.end;
                const width = Math.max(6, (nextStart - word.start) * PX_PER_SEC);
                const isEditing = editingWord?.cueIdx === ci && editingWord?.wordIdx === wi;
                return (
                  <div
                    key={`${ci}-${wi}`}
                    className="absolute top-0 h-8 group"
                    style={{ left, width }}
                  >
                    {wi > 0 && (
                      <div
                        onPointerDown={(e) => handleHandlePointerDown(ci, wi, e)}
                        onPointerMove={handleHandlePointerMove}
                        onPointerUp={handleHandlePointerUp}
                        className="absolute left-0 top-0 h-full w-2 -ml-1 cursor-col-resize z-10 flex items-center justify-center"
                      >
                        <div className="w-0.5 h-full bg-accentBlue opacity-60 group-hover:opacity-100" />
                      </div>
                    )}
                    <div
                      onDoubleClick={() => startEditingWord(ci, wi)}
                      onClick={() => seekTo(word.start)}
                      className="h-full mx-0.5 px-1 rounded text-[11px] text-white bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center overflow-hidden whitespace-nowrap cursor-pointer select-none"
                      title="ดับเบิลคลิกเพื่อแก้ข้อความ"
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          onBlur={commitWordText}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitWordText();
                            if (e.key === 'Escape') setEditingWord(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="!w-full !p-0 !text-[11px] !text-black !text-center"
                        />
                      ) : (
                        word.text.trim()
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none"
            style={{ left: currentTime * PX_PER_SEC }}
          />
        </div>
      </div>
    </div>
  );
}
