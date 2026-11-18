'use client';

// ZANA Nail Studio (ร้านทำเล็บจำลอง) — the Content Studio pipeline drawn as
// a nail salon. Each real step of making a piece of content is one
// department with its own ZANA agent:
//
//   1 เคาน์เตอร์ต้อนรับ  รับ brief (รูปแบบ / Funnel / หัวข้อ / จำนวน), อ่านข้อมูลดิบตอน autofill
//   2 ตู้ Brand Card     โหลด Brand Card ของลูกค้า (server) · AI กรอก / บันทึก Brand Card
//   3 มุมหาเทรนด์        Trend Scout: ค้นเว็บจริงหาเทรนด์ + วันสำคัญพร้อมลิงก์ (server; เฉพาะรูปแบบวางแผน)
//   4 โต๊ะออกแบบลาย      ดึงงานที่อนุมัติแล้วรูปแบบเดียวกันมาเป็นตัวอย่างสไตล์ (server)
//   5 โต๊ะทำเล็บ         OpenAI เขียนคอนเทนต์ (server)
//   6 มุมถ่ายรูป·ตรวจงาน  ตรวจ JSON + คะแนนดึงคนดูจนจบของแต่ละชิ้น (server)
//   7 ตู้โชว์ผลงาน        เก็บชิ้นที่เลือกเข้าคลัง (POST /api/content-studio/posts)
//
// Steps 2–6 follow the NDJSON stage lines streamed by
// /api/content-studio/ai (mode generate, stream: true), so the agent that is
// moving is the step the server is actually on. Same original anime-action
// agents and --cc- tokens as the Creative Office / Warehouse views; pure
// SVG + CSS, light/dark, phone width, reduced motion respected.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Agent, starburst } from '@/components/creative-warehouse';
import { clip, visLen } from '@/components/creative-office';
import './creative-city.css';

export type StationId = 'reception' | 'brand' | 'scout' | 'design' | 'nail' | 'qc' | 'showcase';
export type SalonKind = 'generate' | 'autofill' | 'card' | 'save';

export interface SalonLog {
  station: StationId;
  text: string;
  at: number;
}
export interface SalonRun {
  id: number;
  kind: SalonKind;
  steps: StationId[];
  stage: StationId;
  status: 'running' | 'done' | 'error';
  log: SalonLog[];
  error?: string;
  startedAt: number;
  endedAt?: number;
}
export interface SalonInfo {
  clientName: string | null;
  clientCount: number;
  cardFilled: number;
  cardTotal: number;
  positioning: string | null;
  formatName: string;
  funnelName: string;
  topic: string;
  count: number;
  examples: number;
  libTotal: number;
  libApproved: number;
  libUsed: number;
  unsaved: number;
  avgScore: number | null;
  research: boolean; // the selected format runs the Trend Scout
  week: SalonWeek;
}

// The weekly managed-account loop, read from the client's library:
// Monday news run → Creative Brief → ideas → waiting for real work →
// real work received → posted.
export interface SalonWeek {
  startLabel: string; // e.g. "จ. 16 พ.ย."
  isMonday: boolean;
  due: boolean; // no Creative Brief yet this week
  briefTitle: string | null;
  ideas: number;
  waiting: number;
  received: number;
  posted: number;
}

const INK = 'var(--cc-ink)';
const W = 190;
const MIN_STAGE_MS = 750;
const TOKEN_MS = 900;
const OPEN_KEY = 'cs-salon-open';

interface StationDef {
  id: StationId;
  badge: string;
  name: string;
  agent: string;
  job: string;
  r: 1 | 2 | 3 | 4;
}

export const STATIONS: StationDef[] = [
  { id: 'reception', badge: '1', name: 'เคาน์เตอร์ต้อนรับ', agent: 'น้องรับงาน', r: 2,
    job: 'รับ brief: รูปแบบ ขั้น Funnel หัวข้อ และจำนวนชิ้น · ตอนเพิ่มลูกค้าใหม่จะอ่านข้อมูลดิบที่วางไว้' },
  { id: 'brand', badge: '2', name: 'ตู้ Brand Card', agent: 'น้องคุมโทน', r: 1,
    job: 'เปิด Brand Card ของลูกค้า (จุดยืน น้ำเสียง โปร ข้อห้าม) ให้ทุกชิ้นไปทางเดียวกัน · ให้ AI กรอกและบันทึก Brand Card' },
  { id: 'scout', badge: '3', name: 'มุมหาเทรนด์', agent: 'น้องสายข่าว', r: 3,
    job: 'AI ตัวแรกที่ออกไปหาข้อมูล: ค้นเว็บจริงหาเทรนด์เล็บ/ความงามและวันสำคัญที่กำลังจะมาถึง ทุกข้อมีลิงก์และวันที่ และกันธีมซ้ำกับ 7 วันล่าสุด (ทำงานเฉพาะ Creative Brief หน้าร้าน และแผน 30 วัน)' },
  { id: 'design', badge: '4', name: 'โต๊ะออกแบบลาย', agent: 'น้องดีไซน์', r: 4,
    job: 'ดึงงานที่อนุมัติแล้วในรูปแบบเดียวกัน (สูงสุด 3 ชิ้น) มาเป็นลายตัวอย่างสไตล์ แล้ววางโครงคำสั่ง' },
  { id: 'nail', badge: '5', name: 'โต๊ะทำเล็บ', agent: 'น้องช่างเขียน', r: 3,
    job: 'AI เขียนคอนเทนต์ตาม Brand Card ลายตัวอย่าง และหัวข้อวันนี้ (ขั้นที่ใช้เวลานานสุด)' },
  { id: 'qc', badge: '6', name: 'มุมถ่ายรูป · ตรวจงาน', agent: 'น้องตรวจงาน', r: 2,
    job: 'ตรวจว่าคำตอบครบ แล้วดูคะแนนดึงคนดูจนจบ 6 ข้อของแต่ละชิ้น ข้อไหนไม่ผ่านบอกวิธีแก้' },
  { id: 'showcase', badge: '7', name: 'ตู้โชว์ผลงาน', agent: 'น้องดูแลคลัง', r: 1,
    job: 'เก็บชิ้นที่เลือกเข้าคลังของลูกค้า (ร่าง หรือ อนุมัติ) · งานที่อนุมัติจะกลับไปเป็นลายตัวอย่างรอบหน้า' }
];
const ORDER = STATIONS.map((s) => s.id);

// ---------- run state (paced so every real step stays on screen ≥ MIN_STAGE_MS) ----------

type Action =
  | { type: 'start'; kind: SalonKind; steps: StationId[]; text: string }
  | { type: 'step'; stage: StationId; text: string }
  | { type: 'finish'; text: string }
  | { type: 'fail'; error: string };

function reduce(r: SalonRun | null, a: Action, at: number): SalonRun | null {
  if (a.type === 'start') {
    return { id: (r?.id ?? 0) + 1, kind: a.kind, steps: a.steps, stage: a.steps[0], status: 'running', log: [{ station: a.steps[0], text: a.text, at }], startedAt: at };
  }
  if (!r || r.status !== 'running') return r;
  if (a.type === 'step') return { ...r, stage: a.stage, log: [...r.log, { station: a.stage, text: a.text, at }] };
  if (a.type === 'finish') return { ...r, status: 'done', endedAt: at, log: [...r.log, { station: r.stage, text: a.text, at }] };
  return { ...r, status: 'error', error: a.error, endedAt: at, log: [...r.log, { station: r.stage, text: a.error, at }] };
}

export function useSalonRun() {
  const [run, setRun] = useState<SalonRun | null>(null);
  const queue = useRef<Action[]>([]);
  const timer = useRef<number | null>(null);
  const last = useRef(0);

  const drain = useCallback(function drain() {
    if (timer.current !== null) return;
    const a = queue.current[0];
    if (!a) return;
    const wait = a.type === 'start' ? 0 : Math.max(0, last.current + MIN_STAGE_MS - Date.now());
    timer.current = window.setTimeout(() => {
      timer.current = null;
      queue.current.shift();
      last.current = Date.now();
      setRun((r) => reduce(r, a, last.current));
      drain();
    }, wait);
  }, []);

  const push = useCallback(
    (a: Action) => {
      if (a.type === 'start') {
        queue.current = [];
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
      }
      queue.current.push(a);
      drain();
    },
    [drain]
  );

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return useMemo(
    () => ({
      run,
      start: (kind: SalonKind, steps: StationId[], text: string) => push({ type: 'start', kind, steps, text }),
      step: (stage: StationId, text: string) => push({ type: 'step', stage, text }),
      finish: (text: string) => push({ type: 'finish', text }),
      fail: (error: string) => push({ type: 'fail', error })
    }),
    [run, push]
  );
}

// ---------- layout ----------

type StState = 'idle' | 'waiting' | 'working' | 'done' | 'error' | 'due';
const STATE_LABEL: Record<StState, string> = {
  due: 'ถึงรอบหาข่าวประจำสัปดาห์',
  idle: 'พร้อมรับงาน',
  waiting: 'รอคิว',
  working: 'กำลังทำงาน',
  done: 'เสร็จแล้ว',
  error: 'ทำไม่สำเร็จ'
};

interface Layout {
  w: number;
  h: number;
  pos: Record<StationId, [number, number]>;
  lane: [number, number][];
  // distance along the lane where each station's work token parks
  at: Record<StationId, number>;
}

function polyLen(pts: [number, number][]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}
function pointAt(pts: [number, number][], cum: number[], d: number): [number, number] {
  for (let i = 1; i < pts.length; i++) {
    if (d <= cum[i] || i === pts.length - 1) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
  }
  return pts[0];
}
function nearest(pts: [number, number][], cum: number[], p: [number, number]) {
  let best = 0;
  let bd = Infinity;
  const total = cum[cum.length - 1];
  for (let d = 0; d <= total; d += 2) {
    const q = pointAt(pts, cum, d);
    const dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best;
}

// rows: station ids in walking order; the lane snakes under each row.
function makeLayout(w: number, cols: number[], rowsY: number[], rows: StationId[][], h: number): Layout {
  const pos = {} as Record<StationId, [number, number]>;
  const lane: [number, number][] = [];
  const left = 14;
  const right = w - 14;
  rows.forEach((row, ri) => {
    const ltr = ri % 2 === 0;
    const y = rowsY[ri] + 26;
    row.forEach((id, ci) => {
      pos[id] = [ltr ? cols[ci] : cols[cols.length - 1 - ci], rowsY[ri]];
    });
    if (ri === 0) lane.push([ltr ? left + 30 : right, y]);
    lane.push([ltr ? right : left, y]);
    if (ri < rows.length - 1) lane.push([ltr ? right : left, rowsY[ri + 1] + 26]);
  });
  const cum = polyLen(lane);
  const at = {} as Record<StationId, number>;
  for (const id of ORDER) at[id] = nearest(lane, cum, [pos[id][0], pos[id][1] + 26]);
  return { w, h, pos, lane, at };
}

const WIDE_COLS = [115, 322, 529, 736];
const WIDE = makeLayout(850, WIDE_COLS, [250, 476], [['reception', 'brand', 'scout', 'design'], ['nail', 'qc', 'showcase']], 540);
const TALL = makeLayout(440, [115, 325], [250, 486, 722, 958], [['reception', 'brand'], ['scout', 'design'], ['nail', 'qc'], ['showcase']], 1016);

// ---------- drawing ----------

function Bubble({ x, y, text, vw, tone = 'surface' }: { x: number; y: number; text: string; vw: number; tone?: 'surface' | 'err' | 'ok' }) {
  const t = clip(text, 24);
  const w = Math.round(visLen(t) * 6.9 + 22);
  const h = 26;
  const bx = Math.min(Math.max(x - w / 2, 6), vw - w - 6);
  const top = y - h - 9;
  const fill = tone === 'err' ? 'var(--cc-w2)' : tone === 'ok' ? 'var(--cc-w4)' : 'var(--cc-surface)';
  const stroke = tone === 'err' ? 'var(--cc-accent)' : INK;
  return (
    <g className="co-bubble" aria-hidden="true">
      <polygon points={`${x - 7},${top + h - 2} ${x},${y} ${x + 6},${top + h - 2}`} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      <rect x={bx} y={top} width={w} height={h} rx={13} fill={fill} stroke={stroke} strokeWidth={2} />
      <rect x={x - 5} y={top + h - 3} width={10} height={4} fill={fill} />
      <text x={bx + w / 2} y={top + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="var(--cc-fg)">
        {t}
      </text>
    </g>
  );
}

function StateMark({ s, x, y }: { s: StState; x: number; y: number }) {
  if (s === 'working') return <circle className="sl-pulse" cx={x} cy={y} r={7} fill="var(--cc-ok)" stroke={INK} strokeWidth={1.5} />;
  if (s === 'done')
    return (
      <g>
        <circle cx={x} cy={y} r={8} fill="var(--cc-ok)" stroke={INK} strokeWidth={1.5} />
        <path d={`M${x - 4},${y} L${x - 1},${y + 3} L${x + 4},${y - 3}`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  if (s === 'error')
    return (
      <g>
        <circle cx={x} cy={y} r={8} fill="var(--cc-accent)" stroke={INK} strokeWidth={1.5} />
        <path d={`M${x - 3.5},${y - 3.5} L${x + 3.5},${y + 3.5} M${x + 3.5},${y - 3.5} L${x - 3.5},${y + 3.5}`} stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      </g>
    );
  if (s === 'waiting') return <circle cx={x} cy={y} r={6} fill="none" stroke="var(--cc-muted)" strokeWidth={2.5} strokeDasharray="3 2.5" />;
  if (s === 'due') return <circle className="sl-pulse" cx={x} cy={y} r={7} fill="var(--cc-todo)" stroke={INK} strokeWidth={1.5} />;
  return <circle cx={x} cy={y} r={6} fill="var(--cc-muted)" stroke={INK} strokeWidth={1.5} />;
}

const S = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const POLISH = ['var(--cc-r2)', 'var(--cc-r1)', 'var(--cc-r4)', 'var(--cc-accent)', 'var(--cc-r3)'];

function Bottle({ x, y, c, s = 1 }: { x: number; y: number; c: string; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <rect x={-2.5} y={-17} width={5} height={7} rx={1} fill={INK} />
      <rect x={-6} y={-11} width={12} height={11} rx={3} fill={c} stroke={INK} strokeWidth={1.8} />
      <rect x={-3.5} y={-9} width={2.5} height={6} rx={1} fill="#fff" opacity={0.55} />
    </g>
  );
}

// Things drawn BEHIND the agent (shelves, cabinets, ring light).
function Backdrop({ id, cx, fy, info }: { id: StationId; cx: number; fy: number; info: SalonInfo }) {
  switch (id) {
    case 'reception':
      return (
        <g>
          <rect x={cx + 14} y={fy - 156} width={70} height={46} rx={4} fill="var(--cc-w2)" stroke={INK} strokeWidth={2.5} />
          <text x={cx + 49} y={fy - 138} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} fill="var(--cc-fg)">BRIEF</text>
          <path d={`M${cx + 24},${fy - 124} H${cx + 74} M${cx + 24},${fy - 117} H${cx + 60}`} stroke={INK} strokeWidth={1.6} opacity={0.5} strokeLinecap="round" />
        </g>
      );
    case 'brand': {
      const L = cx + 8;
      return (
        <g>
          <rect x={L} y={fy - 156} width={78} height={112} rx={4} fill="var(--cc-w3)" stroke={INK} strokeWidth={2.5} />
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect x={L + 4} y={fy - 118 + row * 34} width={70} height={4} fill={INK} opacity={0.6} />
              {[0, 1, 2, 3].map((k) => (
                <Bottle key={k} x={L + 14 + k * 17} y={fy - 118 + row * 34} c={POLISH[(row + k) % POLISH.length]} s={0.9} />
              ))}
            </g>
          ))}
          <text x={L + 39} y={fy - 146} textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={600} fill="var(--cc-fg)">
            {info.cardFilled}/{info.cardTotal} ช่อง
          </text>
        </g>
      );
    }
    case 'scout':
      return (
        <g>
          {/* news / trend board */}
          <rect x={cx + 6} y={fy - 158} width={82} height={70} rx={4} fill="var(--cc-trunk)" fillOpacity={0.35} stroke={INK} strokeWidth={2.5} />
          <text x={cx + 47} y={fy - 147} textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill="var(--cc-fg)" letterSpacing={1}>TREND</text>
          {[
            [cx + 12, fy - 138, 'var(--cc-w1)', -4],
            [cx + 40, fy - 136, 'var(--cc-w4)', 5],
            [cx + 64, fy - 139, 'var(--cc-w2)', -3]
          ].map(([x, y, c, r], k) => (
            <g key={k} transform={`rotate(${r} ${Number(x) + 10} ${Number(y) + 12})`}>
              <rect x={Number(x)} y={Number(y)} width={20} height={24} fill={String(c)} stroke={INK} strokeWidth={1.5} />
              <path d={`M${Number(x) + 3},${Number(y) + 9} H${Number(x) + 17} M${Number(x) + 3},${Number(y) + 14} H${Number(x) + 13}`} stroke={INK} strokeWidth={1.3} strokeLinecap="round" opacity={0.6} />
              <circle cx={Number(x) + 10} cy={Number(y) + 2} r={2.5} fill="var(--cc-accent)" stroke={INK} strokeWidth={1} />
            </g>
          ))}
          <path d={`M${cx + 22},${fy - 112} L${cx + 50},${fy - 110} L${cx + 74},${fy - 113}`} fill="none" stroke="var(--cc-accent)" strokeWidth={1.5} strokeDasharray="3 2" />
        </g>
      );
    case 'design':
      return (
        <g>
          <path d={`M${cx + 70},${fy - 50} L${cx + 70},${fy - 148} L${cx + 30},${fy - 160}`} fill="none" {...S} />
          <path d={`M${cx + 18},${fy - 150} L${cx + 42},${fy - 168} L${cx + 50},${fy - 150} Z`} fill="var(--cc-r4)" {...S} />
          <path d={`M${cx + 22},${fy - 148} L${cx + 6},${fy - 112} L${cx + 56},${fy - 112} L${cx + 48},${fy - 148} Z`} fill="var(--cc-w4)" opacity={0.45} />
        </g>
      );
    case 'qc':
      return (
        <g>
          <line x1={cx + 50} y1={fy - 104} x2={cx + 50} y2={fy - 10} {...S} />
          <path d={`M${cx + 34},${fy - 10} L${cx + 50},${fy - 34} L${cx + 66},${fy - 10}`} fill="none" {...S} />
          <circle cx={cx + 50} cy={fy - 130} r={30} fill="var(--cc-w4)" opacity={0.35} />
          <circle cx={cx + 50} cy={fy - 130} r={24} fill="none" stroke={INK} strokeWidth={9} />
          <circle cx={cx + 50} cy={fy - 130} r={24} fill="none" stroke="var(--cc-w1)" strokeWidth={5} />
          <rect x={cx + 42} y={fy - 138} width={16} height={26} rx={3} fill="var(--cc-r3)" stroke={INK} strokeWidth={2} />
          <rect x={cx + 45} y={fy - 135} width={10} height={17} rx={1.5} fill="var(--cc-win)" />
        </g>
      );
    case 'showcase': {
      const L = cx + 2;
      const n = Math.min(9, info.libTotal);
      return (
        <g>
          <rect x={L} y={fy - 160} width={86} height={150} rx={5} fill="var(--cc-win)" fillOpacity={0.35} stroke={INK} strokeWidth={2.5} />
          {[0, 1, 2].map((row) => (
            <rect key={row} x={L + 3} y={fy - 116 + row * 42} width={80} height={4} fill={INK} opacity={0.55} />
          ))}
          {Array.from({ length: n }).map((_, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            return (
              <g key={i}>
                <rect x={L + 8 + col * 26} y={fy - 140 + row * 42} width={20} height={24} rx={2} fill="var(--cc-w1)" stroke={INK} strokeWidth={1.6} />
                <rect x={L + 11 + col * 26} y={fy - 136 + row * 42} width={14} height={9} fill={POLISH[i % POLISH.length]} />
              </g>
            );
          })}
          <path d={`M${L + 10},${fy - 150} L${L + 30},${fy - 120}`} stroke="var(--cc-w1)" strokeWidth={4} opacity={0.6} strokeLinecap="round" />
          <text x={L + 43} y={fy - 4} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--cc-muted)" dy={-2}>
            {info.libTotal} ชิ้น
          </text>
        </g>
      );
    }
    default:
      return null;
  }
}

// Things drawn IN FRONT of the agent (counters, tables) — hide its legs.
function Furniture({ id, cx, fy, working, info }: { id: StationId; cx: number; fy: number; working: boolean; info: SalonInfo }) {
  switch (id) {
    case 'reception':
      return (
        <g>
          <rect x={cx - 86} y={fy - 66} width={128} height={12} rx={3} fill="var(--cc-r2)" {...S} />
          <rect x={cx - 80} y={fy - 54} width={116} height={50} rx={3} fill="var(--cc-w1)" {...S} />
          <text x={cx - 22} y={fy - 30} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} fill="var(--cc-fg)">ต้อนรับ</text>
          <path d={`M${cx + 14},${fy - 66} A9,9 0 0 1 ${cx + 32},${fy - 66} Z`} fill="var(--cc-r4)" {...S} />
          <circle cx={cx + 23} cy={fy - 77} r={2.5} fill={INK} />
        </g>
      );
    case 'brand':
      return (
        <g>
          <rect x={cx - 82} y={fy - 52} width={96} height={10} rx={3} fill="var(--cc-w3)" {...S} />
          <rect x={cx - 76} y={fy - 42} width={84} height={38} rx={3} fill="var(--cc-w1)" {...S} />
          <g transform={`translate(${cx - 46},${fy - 52}) rotate(-8)`}>
            <rect x={-16} y={-26} width={34} height={24} rx={2} fill="var(--cc-surface)" {...S} />
            <rect x={-12} y={-22} width={10} height={8} fill="var(--cc-accent)" />
            <path d="M1,-21 H13 M1,-16 H10 M-12,-9 H12" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          </g>
        </g>
      );
    case 'design':
      return (
        <g>
          <polygon points={`${cx - 86},${fy - 44} ${cx + 30},${fy - 44} ${cx + 22},${fy - 70} ${cx - 78},${fy - 70}`} fill="var(--cc-w4)" {...S} />
          <rect x={cx - 80} y={fy - 44} width={104} height={40} rx={3} fill="var(--cc-w1)" {...S} />
          {[0, 1, 2, 3, 4].map((k) => (
            <ellipse
              key={k}
              className={working ? 'sl-paint' : undefined}
              style={working ? { animationDelay: `${k * 0.18}s` } : undefined}
              cx={cx - 62 + k * 18}
              cy={fy - 57}
              rx={5.5}
              ry={8}
              fill={POLISH[k]}
              stroke={INK}
              strokeWidth={1.6}
            />
          ))}
          <text x={cx - 28} y={fy - 24} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--cc-muted)">
            ลาย {Math.min(3, info.examples)}
          </text>
        </g>
      );
    case 'scout':
      return (
        <g>
          <rect x={cx - 86} y={fy - 52} width={140} height={10} rx={3} fill="var(--cc-r3)" {...S} />
          <rect x={cx - 80} y={fy - 42} width={128} height={38} rx={3} fill="var(--cc-w1)" {...S} />
          {/* laptop with a rising trend line */}
          <path d={`M${cx - 6},${fy - 52} L${cx + 2},${fy - 86} L${cx + 46},${fy - 86} L${cx + 50},${fy - 52} Z`} fill="var(--cc-r3)" {...S} />
          <rect x={cx + 6} y={fy - 82} width={38} height={24} rx={2} fill="var(--cc-win)" />
          <path
            className={working ? 'sl-paint' : undefined}
            d={`M${cx + 9},${fy - 62} L${cx + 18},${fy - 68} L${cx + 26},${fy - 65} L${cx + 40},${fy - 78}`}
            fill="none"
            stroke="var(--cc-accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* globe = web search */}
          <g transform={`translate(${cx - 56},${fy - 64})`}>
            <circle r={11} fill="var(--cc-w3)" stroke={INK} strokeWidth={2} />
            <ellipse rx={5} ry={11} fill="none" stroke={INK} strokeWidth={1.4} />
            <path d="M-11,0 H11 M-9,-6 H9 M-9,6 H9" stroke={INK} strokeWidth={1.2} />
          </g>
          <text x={cx - 18} y={fy - 23} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--cc-muted)">
            {info.research ? 'ค้นเว็บ' : 'พัก'}
          </text>
        </g>
      );
    case 'nail':
      return (
        <g>
          <rect x={cx - 88} y={fy - 54} width={150} height={12} rx={3} fill="var(--cc-r3)" {...S} />
          <rect x={cx - 82} y={fy - 42} width={138} height={38} rx={3} fill="var(--cc-w1)" {...S} />
          {/* hand on a cushion */}
          <ellipse cx={cx + 14} cy={fy - 58} rx={26} ry={7} fill="var(--cc-w2)" {...S} />
          <ellipse cx={cx + 10} cy={fy - 64} rx={11} ry={6} fill="var(--cc-skin)" stroke={INK} strokeWidth={2} />
          {[0, 1, 2, 3].map((k) => (
            <g key={k}>
              <rect x={cx + 18 + k * 6} y={fy - 76 + Math.abs(k - 1.5) * 2} width={5} height={13} rx={2.5} fill="var(--cc-skin)" stroke={INK} strokeWidth={1.6} />
              <rect
                className={working ? 'sl-paint' : undefined}
                style={working ? { animationDelay: `${k * 0.22}s` } : undefined}
                x={cx + 18.8 + k * 6}
                y={fy - 75 + Math.abs(k - 1.5) * 2}
                width={3.4}
                height={4.5}
                rx={1.5}
                fill="var(--cc-accent)"
              />
            </g>
          ))}
          {/* UV lamp */}
          <path d={`M${cx + 40},${fy - 54} A16,15 0 0 1 ${cx + 72},${fy - 54}`} fill="var(--cc-w3)" {...S} />
          <path className={working ? 'sl-glow' : undefined} d={`M${cx + 45},${fy - 55} A11,9 0 0 1 ${cx + 67},${fy - 55}`} fill="none" stroke="var(--cc-visor)" strokeWidth={3} />
          <Bottle x={cx - 62} y={fy - 54} c="var(--cc-accent)" />
          <Bottle x={cx - 46} y={fy - 54} c="var(--cc-r1)" />
          <text x={cx - 18} y={fy - 23} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--cc-muted)">
            {info.count} ชิ้น
          </text>
        </g>
      );
    case 'qc':
      return (
        <g>
          <rect x={cx - 84} y={fy - 48} width={96} height={10} rx={3} fill="var(--cc-w3)" {...S} />
          <rect x={cx - 78} y={fy - 38} width={84} height={34} rx={3} fill="var(--cc-w1)" {...S} />
          <text x={cx - 36} y={fy - 21} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} fill="var(--cc-fg)">
            {info.avgScore === null ? '—/10' : `${info.avgScore}/10`}
          </text>
          {/* magnifier */}
          <g transform={`translate(${cx - 4},${fy - 58})`}>
            <circle r={8} fill="var(--cc-win)" fillOpacity={0.6} stroke={INK} strokeWidth={2.5} />
            <path d="M6,6 L13,13" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
          </g>
        </g>
      );
    case 'showcase':
      return (
        <g>
          <rect x={cx - 80} y={fy - 44} width={70} height={40} rx={3} fill="var(--cc-w1)" {...S} />
          <rect x={cx - 86} y={fy - 54} width={82} height={10} rx={3} fill="var(--cc-r1)" {...S} />
          <rect x={cx - 66} y={fy - 80} width={34} height={26} rx={2} fill="var(--cc-w4)" {...S} />
          <path d={`M${cx - 66},${fy - 70} H${cx - 32}`} stroke={INK} strokeWidth={2} />
          <text x={cx - 45} y={fy - 24} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="var(--cc-muted)">
            คลัง
          </text>
        </g>
      );
  }
}

function Token({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} aria-hidden="true">
      <ellipse cx={0} cy={3} rx={14} ry={4} fill={INK} opacity={0.18} />
      <rect x={-13} y={-10} width={26} height={12} rx={3} fill="var(--cc-w1)" stroke={INK} strokeWidth={2} />
      <Bottle x={-4} y={-9} c="var(--cc-accent)" s={0.85} />
      <path d="M4,-6 H10 M4,-2 H9" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

function keyHandler(id: StationId, onSelect: (id: StationId) => void) {
  return (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
}

function stationState(run: SalonRun | null, id: StationId): StState {
  if (!run) return 'idle';
  const i = run.steps.indexOf(id);
  if (i < 0) return 'idle';
  const cur = run.steps.indexOf(run.stage);
  if (i < cur) return 'done';
  if (i > cur) return run.status === 'running' ? 'waiting' : 'idle';
  return run.status === 'running' ? 'working' : run.status === 'error' ? 'error' : 'done';
}

function idleLines(id: StationId, info: SalonInfo): string[] {
  switch (id) {
    case 'reception':
      return info.week.due
        ? [`รอบสัปดาห์ ${info.week.startLabel} เริ่มแล้ว`, 'ส่งต่อให้มุมหาเทรนด์ไปหาข่าว', info.clientName ? `ลูกค้า: ${info.clientName}` : 'ยังไม่ได้เลือกลูกค้า']
        : [`สัปดาห์นี้บรีฟแล้ว: ${info.week.briefTitle ?? ''}`, `แตกเป็นไอเดีย ${info.week.ideas} ชิ้น`, `รอผลงานจริงจากร้าน ${info.week.waiting} ชิ้น`];
    case 'brand':
      return [`Brand Card ครบ ${info.cardFilled}/${info.cardTotal} ช่อง`, info.positioning ? `จุดยืน: ${info.positioning}` : 'ยังไม่มีจุดยืนคอนเทนต์', 'โทนสีแบรนด์พร้อมแล้ว'];
    case 'scout':
      if (info.week.due)
        return [info.week.isMonday ? 'วันจันทร์! ออกไปหาข่าวประจำสัปดาห์' : 'สัปดาห์นี้ยังไม่ได้หาข่าว', 'ข่าวมู วันสำคัญ กระแสสี', 'กดเริ่มรอบสัปดาห์นี้ได้เลย'];
      return info.research
        ? ['รอบนี้ออกไปหาเทรนด์ให้', 'หาวันสำคัญที่กำลังมาถึง', 'ทุกข้อต้องมีลิงก์']
        : ['ได้ข่าวประจำสัปดาห์แล้ว', 'รอบหน้า: วันจันทร์', 'ตามข่าวมูไว้รอแล้ว'];
    case 'design':
      return [info.examples ? `มีลายตัวอย่าง ${Math.min(3, info.examples)} ชิ้น` : 'ยังไม่มีลายที่อนุมัติ', `รูปแบบ: ${info.formatName}`, `ขั้น: ${info.funnelName}`];
    case 'nail':
      return [`รอเขียน ${info.formatName}`, `${info.count} ชิ้นต่อรอบ`, info.topic ? `หัวข้อ: ${info.topic}` : 'หัวข้อ: ให้ AI เลือกเอง'];
    case 'qc':
      return [info.avgScore === null ? 'รอตรวจงานชิ้นแรก' : `รอบล่าสุดเฉลี่ย ${info.avgScore}/10`, 'เช็กดึงคนดูจนจบ 6 ข้อ', 'ข้อไหนไม่ผ่านบอกวิธีแก้'];
    case 'showcase':
      return [
        `รอผลงานจริง ${info.week.waiting} · ได้แล้ว ${info.week.received}`,
        `สัปดาห์นี้โพสต์แล้ว ${info.week.posted} ชิ้น`,
        info.unsaved ? `รอเก็บ ${info.unsaved} ชิ้น` : `คลังมี ${info.libTotal} ชิ้น`
      ];
  }
}

function secs(ms: number) {
  return `${(Math.max(0, ms) / 1000).toFixed(ms < 10000 ? 1 : 0)} วิ`;
}

// ---------- section ----------

export default function ContentStudioSalon({
  run,
  info,
  onShowResults,
  onStartWeek
}: {
  run: SalonRun | null;
  info: SalonInfo;
  onShowResults?: () => void;
  onStartWeek?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [animate, setAnimate] = useState(false);
  const [tall, setTall] = useState(false);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<StationId>('reception');
  const boxRef = useRef<HTMLDivElement>(null);
  const L = tall ? TALL : WIDE;
  const laneCum = useMemo(() => polyLen(L.lane), [L]);

  useEffect(() => {
    setNow(Date.now());
    try {
      if (window.localStorage.getItem(OPEN_KEY) === '0') setOpen(false);
    } catch {
      // storage blocked — default open
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setAnimate(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mq.removeEventListener('change', sync);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setTall(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Follow the step that is running.
  useEffect(() => {
    if (run) setSelected(run.stage);
  }, [run?.id, run?.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Work token: glides along the lane to the station of the current step.
  const target = L.at[run?.stage ?? 'reception'];
  const [tokenD, setTokenD] = useState(target);
  const tokenRef = useRef(target);
  useEffect(() => {
    const from = tokenRef.current;
    if (!animate || Math.abs(from - target) < 1) {
      tokenRef.current = target;
      setTokenD(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / TOKEN_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const d = from + (target - from) * e;
      tokenRef.current = d;
      setTokenD(d);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, animate]);

  function toggle() {
    setOpen((o) => {
      try {
        window.localStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        // ignore
      }
      return !o;
    });
  }

  const busy = run?.status === 'running';
  const states = Object.fromEntries(ORDER.map((id) => [id, stationState(run, id)])) as Record<StationId, StState>;
  // Nothing running and no brief yet this week → the Trend Scout is due.
  if (info.week.due && run?.status !== 'running' && states.scout === 'idle') states.scout = 'due';
  const tick = Math.floor(now / 3200);
  const lastText = (id: StationId) => [...(run?.log ?? [])].reverse().find((l) => l.station === id)?.text ?? '';
  const stageStartedAt = run ? [...run.log].reverse().find((l) => l.station === run.stage)?.at ?? run.startedAt : 0;
  const waitingShowcase = run?.kind === 'generate' && run.status === 'done' && info.unsaved > 0;

  function bubbleFor(id: StationId, i: number): { text: string; tone?: 'err' | 'ok'; key?: string } | null {
    const s = states[id];
    if (s === 'working') {
      const t = lastText(id);
      // stable key so the ticking timer doesn't re-pop the bubble every second
      return { key: `w${run?.id}-${run?.log.length}`, text: id === 'nail' && run ? `${t.replace(/…$/, '')} ${secs(now - stageStartedAt)}` : t };
    }
    if (s === 'error') return { text: run?.error ?? 'ทำไม่สำเร็จ', tone: 'err' };
    if (run && run.status === 'done' && run.stage === id && now - (run.endedAt ?? 0) < 9000) return { text: lastText(id), tone: 'ok' };
    if (id === 'showcase' && waitingShowcase) return { text: `รอคุณกดเก็บ ${info.unsaved} ชิ้น` };
    if (s === 'due') return { text: idleLines('scout', info)[0] };
    if (run?.status === 'running') return null;
    if ((tick + i) % 3 !== 0) return null;
    const lines = idleLines(id, info);
    return { text: lines[tick % lines.length] };
  }

  const sel = STATIONS.find((s) => s.id === selected)!;
  const selState = states[selected];
  const [tx, ty] = pointAt(L.lane, laneCum, tokenD);
  const lanePath = 'M' + L.lane.map((p) => p.join(',')).join(' L');
  const total = run ? (run.endedAt ?? now) - run.startedAt : 0;

  return (
    <section className="cc sl" aria-label="ร้านทำเล็บจำลอง Content Studio">
      <div className="sl-wrap">
        <header className="sl-head">
          <div className="min-w-0">
            <span className="cc-eyebrow">Content Studio · ร้านทำเล็บจำลอง</span>
            <h2 className="sl-title">ZANA Nail Studio {busy ? '· กำลังทำงาน' : run?.status === 'error' ? '· ทำไม่สำเร็จ' : ''}</h2>
          </div>
          <button type="button" className="sl-toggle" aria-expanded={open} onClick={toggle}>
            {open ? 'ซ่อนร้าน' : 'แสดงร้าน'}
          </button>
        </header>

        {/* weekly workflow — read from the library, always visible */}
        <div className="sl-week" aria-label="Workflow รอบสัปดาห์นี้">
          <span className="sl-week-h">รอบสัปดาห์นี้ (เริ่ม {info.week.startLabel})</span>
          <ol className="sl-steps">
            {(
              [
                ['หาข่าวประจำสัปดาห์', !info.week.due, info.week.due ? (info.week.isMonday ? 'วันนี้' : 'ค้างอยู่') : '✓'],
                ['Creative Brief', !info.week.due, info.week.due ? '—' : '✓'],
                ['แตกเป็นไอเดีย', info.week.ideas > 0, String(info.week.ideas)],
                ['รอผลงานจริง', info.week.waiting > 0, String(info.week.waiting)],
                ['ได้ผลงานแล้ว', info.week.received > 0, String(info.week.received)],
                ['โพสต์แล้ว', info.week.posted > 0, String(info.week.posted)]
              ] as [string, boolean, string][]
            ).map(([label, on, n], i) => (
              <li key={label} className={`sl-step ${on ? 'done' : i === 0 && info.week.due ? 'due' : 'waiting'}`}>
                <span className="sl-step-n">{n}</span>
                {label}
              </li>
            ))}
          </ol>
          {info.week.due && onStartWeek && !busy && (
            <button type="button" className="cc-next sl-start" onClick={onStartWeek}>
              ✦ เริ่มรอบสัปดาห์นี้: หาข่าว + ทำ Creative Brief
            </button>
          )}
        </div>

        {/* step strip — always visible, even when the scene is collapsed */}
        <ol className="sl-steps" aria-label="ขั้นตอนรอบล่าสุด">
          {(run?.steps ?? (info.research ? ['reception', 'brand', 'scout', 'design', 'nail', 'qc'] : ['reception', 'brand', 'design', 'nail', 'qc'])).map((id) => {
            const st = STATIONS.find((s) => s.id === id)!;
            const s = states[id];
            return (
              <li key={id} className={`sl-step ${s}`}>
                <span className="sl-step-n">{s === 'done' ? '✓' : s === 'error' ? '✗' : st.badge}</span>
                {st.name}
              </li>
            );
          })}
          {run && (
            <li className="sl-step-time" aria-live="polite">
              {run.status === 'running' ? `ใช้เวลา ${secs(total)}` : run.status === 'done' ? `เสร็จใน ${secs(total)}` : 'หยุดที่ขั้นนี้'}
            </li>
          )}
        </ol>

        {open && (
          <div className="sl-grid">
            <div className="cc-mapbox" ref={boxRef}>
              <svg className="cc-city" viewBox={`0 0 ${L.w} ${L.h}`} role="group" aria-label="ร้านทำเล็บจำลอง: พนักงาน AI ประจำแต่ละแผนก ทำงานตามขั้นตอนสร้างคอนเทนต์">
                <defs>
                  <pattern id="sl-tile" width={40} height={40} patternUnits="userSpaceOnUse">
                    <rect width={40} height={40} fill="var(--cc-floor)" />
                    <path d="M40,0 H0 V40" fill="none" stroke="var(--cc-floor2)" strokeWidth={2} />
                    <circle cx={20} cy={20} r={2} fill="var(--cc-floor2)" />
                  </pattern>
                </defs>
                <rect width={L.w} height={L.h} rx={14} fill="url(#sl-tile)" />

                {/* back wall */}
                <rect width={L.w} height={100} rx={14} fill="var(--cc-w2)" />
                <rect y={92} width={L.w} height={10} fill="var(--cc-r2)" stroke={INK} strokeWidth={2.5} />
                <polygon points={`${L.w / 2 - 150},16 ${L.w / 2 + 150},16 ${L.w / 2 + 142},56 ${L.w / 2 - 158},56`} fill="var(--cc-surface)" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
                <text x={L.w / 2 - 4} y={30} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} letterSpacing={2} fill="var(--cc-fg)">ZANA NAIL STUDIO</text>
                <text x={L.w / 2 - 4} y={46} textAnchor="middle" dominantBaseline="central" fontSize={11} fill="var(--cc-muted)">ร้านทำเล็บคอนเทนต์ · {info.clientName ? clip(info.clientName, 18) : 'Content Studio'}</text>
                {!tall &&
                  [18, L.w - 108].map((wx) => (
                    <g key={wx}>
                      <rect x={wx} y={14} width={90} height={38} rx={6} fill="var(--cc-win)" stroke={INK} strokeWidth={3} />
                      <path d={`M${wx + 10},46 L${wx + 24},22 M${wx + 26},47 L${wx + 40},23`} stroke="var(--cc-w1)" strokeWidth={4} strokeLinecap="round" opacity={0.6} />
                    </g>
                  ))}
                {/* hanging lamps */}
                {(tall ? [60, L.w - 60] : []).map((lx) => (
                  <g key={lx}>
                    <line x1={lx} y1={0} x2={lx} y2={70} stroke={INK} strokeWidth={2} />
                    <path d={`M${lx - 14},82 A14,12 0 0 1 ${lx + 14},82 Z`} fill="var(--cc-r4)" stroke={INK} strokeWidth={2.5} />
                  </g>
                ))}

                {/* carpet lane: the work ticket travels along it */}
                <path d={lanePath} fill="none" stroke="var(--cc-beltline)" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
                <path d={lanePath} fill="none" stroke="var(--cc-belt)" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
                <path d={lanePath} fill="none" stroke="var(--cc-beltline)" strokeWidth={2} strokeDasharray="2 12" strokeLinecap="round" />

                {STATIONS.map((st, i) => {
                  const [cx, fy] = L.pos[st.id];
                  const s = states[st.id];
                  const left = cx - W / 2;
                  const working = s === 'working';
                  const b = bubbleFor(st.id, i);
                  return (
                    <g key={st.id}>
                      <g
                        className={`cc-bay${selected === st.id ? ' sel' : ''}${s === 'waiting' ? ' sl-dim' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selected === st.id}
                        aria-label={`แผนก ${st.badge} ${st.name} สถานะ ${STATE_LABEL[s]}`}
                        onClick={() => setSelected(st.id)}
                        onKeyDown={keyHandler(st.id, setSelected)}
                      >
                        <rect className="cc-bay-halo" x={left - 4} y={fy - 196} width={W + 8} height={210} rx={12} fill="var(--cc-accent)" fillOpacity={0.12} stroke="var(--cc-accent)" strokeWidth={3} />
                        <rect x={left + 4} y={fy - 8} width={W - 8} height={14} rx={3} fill={`var(--cc-r${st.r})`} fillOpacity={working ? 0.6 : 0.3} stroke={INK} strokeWidth={2} />
                        <polygon points={`${left + 10},${fy - 190} ${left + W - 2},${fy - 190} ${left + W - 10},${fy - 164} ${left + 2},${fy - 164}`} fill="var(--cc-surface)" stroke={INK} strokeWidth={3} strokeLinejoin="round" className="cc-plate" />
                        <polygon points={starburst(left + 14, fy - 177, 15, 11)} fill={working ? 'var(--cc-accent)' : 'var(--cc-accent2)'} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
                        <text x={left + 14} y={fy - 177} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fill="#fff">{st.badge}</text>
                        <text x={left + 33} y={fy - 177} dominantBaseline="central" fontSize={visLen(st.name) > 14 ? 11.5 : 13.5} fontWeight={600} fill="var(--cc-fg)">{st.name}</text>
                        <StateMark s={s} x={left + W - 18} y={fy - 177} />
                        <Backdrop id={st.id} cx={cx} fy={fy} info={info} />
                      </g>
                      <g aria-hidden="true" className={s === 'waiting' ? 'sl-dim' : undefined}>
                        <g className={(working || s === 'due') && animate ? 'co-typing' : undefined}>
                          <Agent x={cx - 40} y={fy - 48} look="ai" aura={working} color={`var(--cc-r${st.r})`} scale={0.95} />
                        </g>
                        {working && animate && (
                          <g className="sl-spark" style={{ transformOrigin: `${cx - 12}px ${fy - 96}px` }}>
                            <polygon points={starburst(cx - 12, fy - 96, 7, 3, 4)} fill="var(--cc-w4)" stroke={INK} strokeWidth={1.4} />
                          </g>
                        )}
                        {st.id === 'reception' && <Agent x={cx + 70} y={fy - 4} look="human" scale={0.9} />}
                      </g>
                      <g onClick={() => setSelected(st.id)} className="cc-bay" aria-hidden="true">
                        <Furniture id={st.id} cx={cx} fy={fy} working={working && animate} info={info} />
                      </g>
                      {b && <Bubble key={`${st.id}-${b.key ?? b.text}`} x={cx - 40} y={fy - 112} text={b.text} vw={L.w} tone={b.tone} />}
                    </g>
                  );
                })}

                {!tall && (
                  <g aria-hidden="true">
                    {/* waiting corner in the free slot of the second row */}
                    <rect x={WIDE_COLS[0] - 70} y={476 - 46} width={110} height={30} rx={10} fill="var(--cc-r2)" fillOpacity={0.55} stroke={INK} strokeWidth={2.5} />
                    <rect x={WIDE_COLS[0] - 76} y={476 - 22} width={122} height={16} rx={6} fill="var(--cc-r2)" stroke={INK} strokeWidth={2.5} />
                    <rect x={WIDE_COLS[0] + 54} y={476 - 34} width={24} height={28} rx={3} fill="var(--cc-trunk)" stroke={INK} strokeWidth={2.5} />
                    <circle cx={WIDE_COLS[0] + 66} cy={476 - 52} r={17} fill="var(--cc-tree)" stroke={INK} strokeWidth={2.5} />
                    <text x={WIDE_COLS[0] - 15} y={476 - 66} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--cc-muted)">มุมรอคิว</text>
                  </g>
                )}
                {run && <Token x={tx} y={ty} />}
              </svg>
              <div className="cc-legend">
                <span><span className="cc-lg-aura" /> ออร่า = แผนกที่กำลังทำงานจริง</span>
                <span><span className="cc-mark ok" /> เสร็จ</span>
                <span><span className="co-mark demo" /> รอคิว</span>
                <span><span className="cc-lg-belt" /> ทางเดินใบงาน</span>
              </div>
            </div>

            <div className="cc-side">
              <section className="cc-panel" aria-live="polite">
                <span className="cc-num">แผนก {sel.badge} · {sel.agent}</span>
                <h3 className="sl-h">{sel.name}</h3>
                <div className={`cc-state sl-${selState}`}>
                  <strong>{STATE_LABEL[selState]}</strong>
                  {selState === 'working' && selected === run?.stage && <span>· {secs(now - stageStartedAt)}</span>}
                </div>
                <dl>
                  <dt>หน้าที่ (ขั้นตอนจริง)</dt>
                  <dd>{sel.job}</dd>
                  <dt>{run && run.steps.includes(selected) ? 'รอบล่าสุด' : 'ตอนนี้'}</dt>
                  <dd>
                    {selState === 'error' && run?.error ? (
                      <span className="sl-err">{run.error}</span>
                    ) : (
                      <ul className="co-recent">
                        {(run && run.log.some((l) => l.station === selected) ? run.log.filter((l) => l.station === selected).map((l) => l.text) : idleLines(selected, info)).map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </dl>
                {selected === 'showcase' && waitingShowcase && onShowResults && (
                  <button type="button" className="cc-next" onClick={onShowResults}>
                    ดูผลลัพธ์แล้วกดเก็บ ↓
                  </button>
                )}
              </section>

              {run && (
                <section className="cc-panel">
                  <h3 className="cc-h3">บันทึกการทำงานรอบนี้</h3>
                  <ul className="co-log">
                    {run.log.map((l, i) => {
                      const st = STATIONS.find((s) => s.id === l.station)!;
                      const bad = run.status === 'error' && i === run.log.length - 1;
                      return (
                        <li key={i}>
                          <span className={`co-hop${bad ? ' bad' : ''}`}>{st.badge} · {st.name}</span>
                          <span className="co-log-t">{l.text}</span>
                          <span className="co-log-at">+{secs(l.at - run.startedAt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {run.status === 'done' && run.kind === 'generate' && onShowResults && (
                    <button type="button" className="cc-next" onClick={onShowResults}>
                      ดูผลลัพธ์ ↓
                    </button>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
