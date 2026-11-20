'use client';

import { useState } from 'react';
import type { CreativeInfo } from '@/lib/meta/ads-report';
import { shortDate } from '@/lib/meta/ads-metrics';

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function Section({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-base">{title}</h3>
          {hint ? <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const TONE: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
  muted: 'bg-stone-100 text-stone-600 border-stone-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200'
};

export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap text-xs px-2 py-0.5 rounded-full border ${TONE[tone] ?? TONE.muted}`}>{children}</span>;
}

export function Thumb({ creative, size = 48 }: { creative: CreativeInfo | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!creative?.thumbnailUrl || broken) {
    return <div className="rounded bg-stone-100 shrink-0" style={{ width: size, height: size }} aria-hidden />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={creative.thumbnailUrl}
      alt=""
      width={size}
      height={size}
      className="rounded object-cover shrink-0 bg-stone-100"
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
      referrerPolicy="no-referrer"
    />
  );
}

// Bars (left axis) + one line (right axis), plain SVG so no chart lib is
// needed. Hover shows the day's values.
export function BarLineChart({
  data,
  bar,
  line,
  barLabel,
  lineLabel,
  fmtBar,
  fmtLine
}: {
  data: { date: string }[];
  bar: (d: any) => number;
  line: (d: any) => number | null;
  barLabel: string;
  lineLabel: string;
  fmtBar: (v: number) => string;
  fmtLine: (v: number | null) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const n = data.length;
  if (n === 0) return <p className="text-sm text-[var(--text-muted)]">ไม่มีข้อมูล</p>;
  const bars = data.map(bar);
  const lines = data.map(line);
  const maxBar = Math.max(...bars, 0) || 1;
  const lineVals = lines.filter((v): v is number => v !== null);
  const maxLine = Math.max(...lineVals, 0) || 1;
  const slot = (W - pad.l - pad.r) / n;
  const x = (i: number) => pad.l + slot * i + slot / 2;
  const yBar = (v: number) => H - pad.b - (v / maxBar) * (H - pad.t - pad.b);
  const yLine = (v: number) => H - pad.b - (v / maxLine) * (H - pad.t - pad.b);
  const path = lines
    .map((v, i) => (v === null ? null : `${x(i)},${yLine(v)}`))
    .filter(Boolean)
    .join(' L ');
  const labelEvery = Math.ceil(n / 8);
  const h = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)] mb-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--accent-terracotta-tint)', border: '1px solid var(--accent-terracotta)' }} />
          {barLabel}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ background: 'var(--accent-analytics)' }} />
          {lineLabel}
        </span>
        {h ? (
          <span className="ml-auto text-[var(--text-main)] tabular-nums">
            {shortDate(h.date)} · {barLabel} {fmtBar(bars[hover!])} · {lineLabel} {fmtLine(lines[hover!])}
          </span>
        ) : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)} role="img" aria-label={`${barLabel} และ ${lineLabel} รายวัน`}>
        {data.map((d, i) => (
          <g key={d.date} onMouseEnter={() => setHover(i)}>
            <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} fill={hover === i ? 'rgba(0,0,0,0.04)' : 'transparent'} />
            <rect
              x={x(i) - Math.min(slot * 0.32, 14)}
              y={yBar(bars[i])}
              width={Math.min(slot * 0.64, 28)}
              height={Math.max(H - pad.b - yBar(bars[i]), 0)}
              rx={2}
              fill="var(--accent-terracotta-tint)"
              stroke="var(--accent-terracotta)"
              strokeWidth={0.8}
            />
            {i % labelEvery === 0 ? (
              <text x={x(i)} y={H - 6} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
                {shortDate(d.date)}
              </text>
            ) : null}
          </g>
        ))}
        {path ? <path d={`M ${path}`} fill="none" stroke="var(--accent-analytics)" strokeWidth={2} pointerEvents="none" /> : null}
        {lines.map((v, i) =>
          v === null ? null : <circle key={i} cx={x(i)} cy={yLine(v)} r={hover === i ? 3.5 : 2} fill="var(--accent-analytics)" pointerEvents="none" />
        )}
      </svg>
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 32, stroke = 'var(--accent-analytics)' }: { values: (number | null)[]; width?: number; height?: number; stroke?: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="text-xs text-[var(--text-muted)]">—</span>;
  const max = Math.max(...pts.map((p) => p.v));
  const min = Math.min(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(values.length - 1, 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

export interface AiInsight {
  headline?: string;
  key_insights?: string[];
  actions?: { priority?: string; target?: string; action?: string; why?: string }[];
  watch_out?: string;
}

export function InsightPanel({ onRun, state }: { onRun: () => void; state: { loading: boolean; error: string | null; insight: AiInsight | null; model?: string } }) {
  return (
    <section className="card p-4 sm:p-5 border-[var(--accent-analytics)]" style={{ background: 'var(--accent-analytics-tint)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">AI Key Insight</h3>
          <p className="text-xs text-[var(--text-muted)]">ให้ AI อ่านตัวเลขในแท็บนี้แล้วสรุปสิ่งที่ควรทำ (ใช้ตัวเลขชุดเดียวกับที่เห็นบนจอ)</p>
        </div>
        <button type="button" className="btn-primary" onClick={onRun} disabled={state.loading}>
          {state.loading ? 'AI กำลังวิเคราะห์…' : state.insight ? 'วิเคราะห์ใหม่' : 'สรุปด้วย AI'}
        </button>
      </div>
      {state.error ? <p className="text-sm text-red-700 mt-3">{state.error}</p> : null}
      {state.insight ? (
        <div className="mt-4 space-y-3 text-sm">
          {state.insight.headline ? <p className="font-semibold text-base">{state.insight.headline}</p> : null}
          {state.insight.key_insights?.length ? (
            <ul className="list-disc pl-5 space-y-1">
              {state.insight.key_insights.map((k, i) => (
                <li key={i}>{k}</li>
              ))}
            </ul>
          ) : null}
          {state.insight.actions?.length ? (
            <div className="space-y-2">
              {state.insight.actions.map((a, i) => (
                <div key={i} className="bg-white/70 rounded-lg p-3 border border-[var(--border)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={a.priority === 'สูง' ? 'bad' : a.priority === 'กลาง' ? 'warn' : 'muted'}>{a.priority ?? '—'}</Badge>
                    <span className="font-medium">{a.target}</span>
                  </div>
                  <p className="mt-1">{a.action}</p>
                  {a.why ? <p className="text-xs text-[var(--text-muted)] mt-0.5">{a.why}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {state.insight.watch_out ? <p className="text-xs text-[var(--text-muted)]">⚠ {state.insight.watch_out}</p> : null}
          {state.model ? <p className="text-[11px] text-[var(--text-muted)]">model: {state.model}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
