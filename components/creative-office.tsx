'use client';

// ZANA Creative Office (ห้องทำงานจำลอง) — the Creative Generator tools
// drawn as an office: every tool is one ZANA agent at a desk, showing what
// it is working on, how far along it is, a speech bubble of what it is
// saying, and a meeting table where the team gathers to report. Same
// original anime-action style and --cc- tokens as the Creative Warehouse
// (components/creative-warehouse.tsx); pure SVG + CSS, no extra deps.
//
// Desks read real data where the tool stores any (ideas / scripts /
// storyboards / visual_ideas + generation_logs / banner_generator_jobs /
// activity_logs for captions). A desk with no rows yet shows a clearly
// tagged DEMO state; modes that are not built yet (E-Commerce Image,
// Reels / Video Prompt) show a ghost agent on a hazard pad.

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Agent, starburst } from '@/components/creative-warehouse';
import './creative-city.css';

export type OfficeTab = 'pipeline' | 'visual_hook_banner' | 'banner' | 'ecommerce_image' | 'reels_video' | 'caption';

type Row = { id: string; created_at: string };
export interface OfficeData {
  ideas: (Row & { title?: string | null; hook?: string | null; potential_score?: number | null })[];
  scripts: (Row & { idea_id?: string | null; title?: string | null; hook?: string | null; estimated_duration_sec?: number | null })[];
  storyboards: (Row & {
    script_id?: string | null;
    title?: string | null;
    scene_count?: number | null;
    scenes?: unknown;
    style?: string | null;
    key_message?: string | null;
    total_duration_sec?: number | null;
  })[];
  bannerJobs: (Row & { product_name: string; template: string; image_count: number; result_paths?: string[] | null })[];
  visualIdeas: (Row & { title: string })[];
  visualGenerations: (Row & { status: string; image_count: number; error?: string | null })[];
  captionRuns: (Row & { new_value?: { count?: number } | null; reason?: string | null })[];
}

const INK = 'var(--cc-ink)';
const VB_W = 720;
const VB_H = 920;
const TICK_MS = 3200;
const WORK_TICKS = 7;
const MOVE_MS = 2400;
const DAY = 24 * 60 * 60 * 1000;

type DeskId = 'idea' | 'script' | 'storyboard' | 'reels' | 'hook' | 'banner' | 'ecom' | 'caption';
type DeskState = 'active' | 'idle' | 'demo' | 'todo';
type PropKind = 'bulb' | 'pen' | 'film' | 'camera' | 'target' | 'image' | 'bag' | 'chat';
type Mode = 'auto' | 'work' | 'meeting';

interface DeskDef {
  id: DeskId;
  badge: string;
  name: string;
  role: string;
  tab: OfficeTab;
  x: number;
  fy: number;
  r: 1 | 2 | 3 | 4;
  prop: PropKind;
  seat?: [number, number];
  todo?: boolean;
  demoLines: string[];
}

const ROW1 = 330;
const ROW3 = 840;
const DESKS: DeskDef[] = [
  { id: 'idea', badge: '1A', name: 'Idea', role: 'Content & Video · คิดไอเดีย', tab: 'pipeline', x: 95, fy: ROW1, r: 1, prop: 'bulb', seat: [270, 500],
    demoLines: ['ระดมไอเดีย Hook ใหม่', 'มุมนี้น่าหยุดนิ้วนะ', 'เดี๋ยวส่งให้ Script'] },
  { id: 'script', badge: '1B', name: 'Script', role: 'Content & Video · เขียนบท', tab: 'pipeline', x: 270, fy: ROW1, r: 2, prop: 'pen', seat: [360, 500],
    demoLines: ['รอรับไอเดียจาก Idea', 'Hook 3 วิแรกต้องแรง', 'ใส่ CTA ท้ายคลิป'] },
  { id: 'storyboard', badge: '1C', name: 'Storyboard', role: 'Content & Video · แตกฉาก', tab: 'pipeline', x: 445, fy: ROW1, r: 3, prop: 'film', seat: [450, 500],
    demoLines: ['แตกบทเป็นฉาก', 'ฉาก 1 ต้องเห็นสินค้า', 'วางมุมกล้องให้แล้ว'] },
  { id: 'reels', badge: '5', name: 'Reels', role: 'Reels / Video Prompt', tab: 'reels_video', x: 620, fy: ROW1, r: 4, prop: 'camera', todo: true,
    demoLines: ['โหมดนี้ยังไม่เปิดใช้', 'รอสร้างในเฟสถัดไป'] },
  { id: 'hook', badge: '2', name: 'Visual Hook', role: 'Visual Hook Banner', tab: 'visual_hook_banner', x: 95, fy: ROW3, r: 2, prop: 'target', seat: [270, 618],
    demoLines: ['ร่าง Creative Brief', 'ภาพต้องหยุดสายตา', 'ส่งเข้า Prompt Studio'] },
  { id: 'banner', badge: '3', name: 'Ads Banner', role: 'Ads Banner', tab: 'banner', x: 270, fy: ROW3, r: 1, prop: 'image', seat: [360, 618],
    demoLines: ['เลือกเทมเพลตแบนเนอร์', 'ใส่ราคาโปรให้เด่น', 'เจนภาพ 4 แบบ'] },
  { id: 'ecom', badge: '4', name: 'E-Commerce', role: 'E-Commerce Image', tab: 'ecommerce_image', x: 445, fy: ROW3, r: 4, prop: 'bag', todo: true,
    demoLines: ['โหมดนี้ยังไม่เปิดใช้', 'รอสร้างในเฟสถัดไป'] },
  { id: 'caption', badge: '6', name: 'แคปชั่น', role: 'คิดแคปชั่น', tab: 'caption', x: 620, fy: ROW3, r: 3, prop: 'chat', seat: [450, 618],
    demoLines: ['คิดแคปชั่นปิดการขาย', 'แฮชแท็กครบไหม', 'ขอคำเรียกร้องท้ายโพสต์'] }
];

const LEAD_POS: [number, number] = [165, 590];
const TABLE = { cx: 360, cy: 540, rx: 165, ry: 50 };
const HANDOFF_PATH = 'M95,352 L445,352';

const STATE_LABEL: Record<DeskState, string> = {
  active: 'กำลังทำงาน',
  idle: 'ว่าง · รองานใหม่',
  demo: 'DEMO · ยังไม่มีข้อมูลจริง',
  todo: 'รอสร้าง'
};

interface DeskView extends DeskDef {
  state: DeskState;
  progress: number;
  progressLabel: string;
  task: string;
  lastAt: string | null;
  lines: string[];
  meetingLine: string;
  recent: string[];
  steps?: { label: string; done: boolean }[];
}

interface Handoff {
  key: string;
  from: string;
  to: string;
  title: string;
  at: string;
  ok: boolean;
}

// ---------- text helpers ----------

const THAI_MARK = /[ัิ-ฺ็-๎]/;
export function visLen(s: string) {
  let n = 0;
  for (const ch of s) if (!THAI_MARK.test(ch)) n++;
  return n;
}
export function clip(s: string, max: number) {
  if (visLen(s) <= max) return s;
  let out = '';
  let n = 0;
  for (const ch of s) {
    if (!THAI_MARK.test(ch)) {
      if (n >= max - 1) break;
      n++;
    }
    out += ch;
  }
  return `${out}…`;
}
function q(s: string | null | undefined, max = 18) {
  return `“${clip((s ?? '').trim() || 'ไม่มีชื่อ', max)}”`;
}
export function timeAgo(iso: string | null, now: number | null) {
  if (!iso || now === null) return '';
  const diff = Math.max(0, now - Date.parse(iso));
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${m} นาทีก่อน`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชม.ก่อน`;
  return `${Math.floor(h / 24)} วันก่อน`;
}

// Rows created within a few minutes of the newest one = one generate run.
function latestBatch<T extends Row>(rows: T[]): T[] {
  if (!rows.length) return [];
  const top = Date.parse(rows[0].created_at);
  return rows.filter((r) => top - Date.parse(r.created_at) <= 3 * 60 * 1000);
}
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

// ---------- data → desks ----------

type DeskData = Omit<DeskView, keyof DeskDef | 'state'>;

function buildDesks(d: OfficeData, now: number | null, tick: number): DeskView[] {
  const scriptedIdea = new Set(d.scripts.map((s) => s.idea_id).filter(Boolean));
  const boardedScript = new Set(d.storyboards.map((s) => s.script_id).filter(Boolean));

  const real: Record<DeskId, DeskData | null> = {
    idea: null, script: null, storyboard: null, reels: null, hook: null, banner: null, ecom: null, caption: null
  };

  if (d.ideas.length) {
    const b = latestBatch(d.ideas);
    const handed = b.filter((i) => scriptedIdea.has(i.id)).length;
    const best = Math.max(0, ...b.map((i) => i.potential_score ?? 0));
    real.idea = {
      progress: pct(handed, b.length),
      progressLabel: `ส่งต่อ ${handed}/${b.length}`,
      task: `ไอเดียรอบล่าสุด ${b.length} ชิ้น — ${b[0].title ?? ''}`,
      lastAt: d.ideas[0].created_at,
      lines: [
        `คิดได้ ${b.length} ไอเดียรอบนี้`,
        `Hook: ${q(b[0].hook || b[0].title, 16)}`,
        handed ? `ส่งให้ Script แล้ว ${handed} ชิ้น` : 'รอเลือกไอเดียไปเขียนบท',
        ...(best ? [`คะแนนสูงสุด ${best}`] : [])
      ],
      meetingLine: `ไอเดียใหม่ ${b.length} ชิ้น ส่งต่อแล้ว ${handed}`,
      recent: d.ideas.slice(0, 3).map((i) => i.title ?? 'ไม่มีชื่อ')
    };
  }

  if (d.scripts.length) {
    const b = latestBatch(d.scripts);
    const handed = b.filter((s) => boardedScript.has(s.id)).length;
    const src = d.ideas.find((i) => i.id === b[0].idea_id);
    real.script = {
      progress: pct(handed, b.length),
      progressLabel: `ส่งต่อ ${handed}/${b.length}`,
      task: `บท ${b[0].title ?? 'ไม่มีชื่อ'}${src ? ` (จากไอเดีย ${src.title ?? ''})` : ''}`,
      lastAt: d.scripts[0].created_at,
      lines: [
        `เขียนบท ${q(b[0].title)}`,
        ...(b[0].estimated_duration_sec ? [`ความยาว ~${b[0].estimated_duration_sec} วิ`] : []),
        src ? `รับไอเดียมาจาก Idea แล้ว` : 'บทนี้เขียนเองไม่ผ่าน Idea',
        handed ? `ส่ง Storyboard แล้ว ${handed}/${b.length}` : 'รอแตกเป็นสตอรี่บอร์ด'
      ],
      meetingLine: `บทใหม่ ${b.length} ชิ้น แตกฉากแล้ว ${handed}`,
      recent: d.scripts.slice(0, 3).map((s) => s.title ?? 'สคริปต์ไม่มีชื่อ')
    };
  }

  if (d.storyboards.length) {
    const sb = d.storyboards[0];
    const scenes = Array.isArray(sb.scenes) ? sb.scenes.length : 0;
    const target = sb.scene_count || scenes;
    real.storyboard = {
      progress: target ? pct(scenes, target) : 100,
      progressLabel: `${scenes}/${target} ฉาก`,
      task: `สตอรี่บอร์ด ${sb.title ?? 'ไม่มีชื่อ'}`,
      lastAt: sb.created_at,
      lines: [
        `วาง ${scenes} ฉาก${sb.total_duration_sec ? ` ${sb.total_duration_sec} วิ` : ''}`,
        ...(sb.style ? [`สไตล์ ${clip(sb.style, 16)}`] : []),
        ...(sb.key_message ? [`Key: ${q(sb.key_message, 16)}`] : []),
        'พร้อมส่งให้ทีมถ่าย/ตัดต่อ'
      ],
      meetingLine: `สตอรี่บอร์ดล่าสุด ${scenes} ฉาก พร้อมถ่าย`,
      recent: d.storyboards.slice(0, 3).map((s) => s.title ?? 'สตอรี่บอร์ดไม่มีชื่อ')
    };
  }

  if (d.visualIdeas.length || d.visualGenerations.length) {
    const vi = latestBatch(d.visualIdeas);
    const gen = d.visualGenerations[0];
    const genNewer = gen && (!vi[0] || Date.parse(gen.created_at) >= Date.parse(vi[0].created_at));
    const genOk = genNewer && gen.status === 'success';
    const progress = genNewer ? (gen.status === 'success' ? 100 : gen.status === 'partial' ? 80 : 60) : 50;
    const lastAt = [vi[0]?.created_at, gen?.created_at].filter(Boolean).sort().reverse()[0] ?? null;
    real.hook = {
      progress,
      progressLabel: genNewer ? (genOk ? 'เจนภาพแล้ว' : 'เจนภาพติดปัญหา') : 'รอเจนภาพ',
      task: vi[0] ? `ไอเดียภาพ ${vi[0].title}` : 'เจนภาพ Visual Hook',
      lastAt,
      lines: [
        ...(vi[0] ? [`ไอเดียภาพ ${q(vi[0].title)}`, `ได้ ${vi.length} visual ideas`] : []),
        genNewer ? (genOk ? `เจนภาพสำเร็จ ${gen.image_count} รูป` : 'เจนภาพไม่ผ่าน ขอลองใหม่') : 'รอเข้า Prompt Studio'
      ],
      meetingLine: genNewer ? (genOk ? `ภาพ Visual Hook เสร็จ ${gen.image_count} รูป` : 'เจนภาพล่าสุดไม่ผ่าน กำลังแก้') : `มีไอเดียภาพ ${vi.length} แบบ รอเจน`,
      recent: d.visualIdeas.slice(0, 3).map((v) => v.title),
      steps: [
        { label: 'Brief', done: true },
        { label: 'Ideas', done: vi.length > 0 || !!genNewer },
        { label: 'Prompt', done: !!genNewer },
        { label: 'Generate', done: !!genOk }
      ]
    };
  }

  if (d.bannerJobs.length) {
    const j = d.bannerJobs[0];
    const done = j.result_paths?.length ?? 0;
    real.banner = {
      progress: pct(done, j.image_count),
      progressLabel: `${done}/${j.image_count} รูป`,
      task: `แบนเนอร์ ${j.product_name} · ${j.template}`,
      lastAt: j.created_at,
      lines: [`ทำแบนเนอร์ ${q(j.product_name, 16)}`, `เทมเพลต ${clip(j.template, 16)}`, `ได้ภาพ ${done}/${j.image_count} รูป`],
      meetingLine: `แบนเนอร์ ${clip(j.product_name, 12)} ได้ ${done}/${j.image_count} รูป`,
      recent: d.bannerJobs.slice(0, 3).map((b) => `${b.product_name} · ${b.template}`)
    };
  }

  if (d.captionRuns.length) {
    const c = d.captionRuns[0];
    const n = c.new_value?.count ?? 0;
    real.caption = {
      progress: 100,
      progressLabel: `${n} แคปชั่น`,
      task: c.reason ?? `เขียนแคปชั่น ${n} แบบ`,
      lastAt: c.created_at,
      lines: [`เขียนแคปชั่น ${n} แบบ`, 'แฮชแท็กครบแล้ว', 'พร้อมให้เลือกโพสต์'],
      meetingLine: `แคปชั่นรอบล่าสุด ${n} แบบ ให้เลือกแล้ว`,
      recent: d.captionRuns.slice(0, 3).map((r) => r.reason ?? `แคปชั่น ${r.new_value?.count ?? ''} แบบ`)
    };
  }

  return DESKS.map((def, i) => {
    if (def.todo) {
      return { ...def, state: 'todo', progress: 0, progressLabel: 'รอสร้าง', task: 'โหมดนี้ยังไม่เปิดใช้งาน — อยู่ในแผนเฟสถัดไป', lastAt: null, lines: def.demoLines, meetingLine: '', recent: [] };
    }
    const r = real[def.id];
    if (!r) {
      return {
        ...def,
        state: 'demo',
        progress: ((tick * 9 + i * 23) % 90) + 10,
        progressLabel: 'DEMO',
        task: 'ตัวอย่าง — ยังไม่มีงานจริงในระบบ',
        lastAt: null,
        lines: def.demoLines,
        meetingLine: 'ยังไม่มีงานจริง ขอโชว์ DEMO ไปก่อน',
        recent: []
      };
    }
    const fresh = now !== null && r.lastAt !== null && now - Date.parse(r.lastAt) < DAY;
    return { ...def, ...r, state: fresh ? 'active' : 'idle' };
  });
}

function buildHandoffs(d: OfficeData): Handoff[] {
  const out: Handoff[] = [];
  for (const s of d.scripts) {
    const idea = d.ideas.find((i) => i.id === s.idea_id);
    if (idea) out.push({ key: `s${s.id}`, from: 'Idea', to: 'Script', title: `${idea.title ?? 'ไอเดีย'} → ${s.title ?? 'บท'}`, at: s.created_at, ok: true });
  }
  for (const b of d.storyboards) {
    const s = d.scripts.find((x) => x.id === b.script_id);
    if (s) out.push({ key: `b${b.id}`, from: 'Script', to: 'Storyboard', title: `${s.title ?? 'บท'} → ${b.title ?? 'สตอรี่บอร์ด'}`, at: b.created_at, ok: true });
  }
  for (const g of d.visualGenerations) {
    out.push({ key: `g${g.id}`, from: 'Visual Hook', to: 'เจนภาพ', title: g.status === 'success' ? `ได้ภาพ ${g.image_count} รูป` : 'เจนภาพไม่ผ่าน', at: g.created_at, ok: g.status === 'success' });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 6);
}

// ---------- drawing ----------

function Prop({ kind, x, y }: { kind: PropKind; x: number; y: number }) {
  const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const t = `translate(${x},${y})`;
  switch (kind) {
    case 'bulb':
      return (
        <g transform={t}>
          <rect x={-4} y={-7} width={8} height={7} rx={1.5} fill="var(--cc-r3)" {...s} />
          <circle cx={0} cy={-15} r={8} fill="var(--cc-r4)" {...s} />
          <path d="M-12,-25 L-9,-22 M12,-25 L9,-22 M0,-30 L0,-26" fill="none" {...s} />
        </g>
      );
    case 'pen':
      return (
        <g transform={t}>
          <rect x={-10} y={-18} width={18} height={18} rx={1.5} fill="var(--cc-w1)" {...s} />
          <path d="M-6,-12 L4,-12 M-6,-7 L2,-7" {...s} />
          <path d="M6,-2 L14,-22 L18,-20 L10,0 Z" fill="var(--cc-r2)" {...s} />
        </g>
      );
    case 'film':
      return (
        <g transform={t}>
          <rect x={-12} y={-20} width={24} height={20} rx={2} fill="var(--cc-r3)" {...s} />
          <rect x={-7} y={-16} width={6} height={6} fill="var(--cc-w1)" />
          <rect x={2} y={-16} width={6} height={6} fill="var(--cc-w1)" />
          <rect x={-7} y={-8} width={15} height={5} fill="var(--cc-w4)" />
        </g>
      );
    case 'camera':
      return (
        <g transform={t}>
          <rect x={-12} y={-16} width={20} height={14} rx={2} fill="var(--cc-r3)" {...s} />
          <path d="M8,-12 L15,-16 L15,-2 L8,-6 Z" fill="var(--cc-r3)" {...s} />
          <circle cx={-6} cy={-21} r={4} fill="var(--cc-w3)" {...s} />
          <circle cx={3} cy={-21} r={4} fill="var(--cc-w3)" {...s} />
        </g>
      );
    case 'target':
      return (
        <g transform={t}>
          <circle cx={0} cy={-13} r={12} fill="var(--cc-w1)" {...s} />
          <circle cx={0} cy={-13} r={7} fill="var(--cc-r2)" {...s} />
          <circle cx={0} cy={-13} r={2.5} fill="var(--cc-w1)" />
        </g>
      );
    case 'image':
      return (
        <g transform={t}>
          <rect x={-13} y={-22} width={26} height={20} rx={2} fill="var(--cc-win)" {...s} />
          <path d="M-11,-4 L-3,-13 L3,-7 L7,-11 L11,-4 Z" fill="var(--cc-ok)" />
          <circle cx={6} cy={-17} r={2.5} fill="var(--cc-r4)" />
        </g>
      );
    case 'bag':
      return (
        <g transform={t}>
          <rect x={-11} y={-17} width={22} height={17} rx={2} fill="var(--cc-r4)" {...s} />
          <path d="M-5,-17 C-5,-26 5,-26 5,-17" fill="none" {...s} />
        </g>
      );
    case 'chat':
      return (
        <g transform={t}>
          <path d="M-13,-24 H11 V-8 H-3 L-9,-2 V-8 H-13 Z" fill="var(--cc-w1)" {...s} />
          <path d="M-8,-18 H6 M-8,-13 H2" {...s} />
        </g>
      );
  }
}

function Mark({ state, x, y }: { state: DeskState; x: number; y: number }) {
  if (state === 'active') return <circle cx={x} cy={y} r={6.5} fill="var(--cc-ok)" stroke={INK} strokeWidth={1.5} />;
  if (state === 'idle') return <circle cx={x} cy={y} r={6} fill="var(--cc-muted)" stroke={INK} strokeWidth={1.5} />;
  if (state === 'demo') return <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--cc-accent)" strokeWidth={3} strokeDasharray="3 2.5" />;
  return <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--cc-todo)" strokeWidth={3.5} />;
}

function keyHandler(id: string, onSelect: (id: string) => void) {
  return (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
}

const W = 140;

// Back half of a desk: halo, floor pad, sign plate, chair. The agent is
// drawn after this and the desk front after the agent, so the desk hides
// the agent's legs.
function DeskBack({ d, selected, onSelect }: { d: DeskView; selected: boolean; onSelect: (id: string) => void }) {
  const L = d.x - W / 2;
  const R = d.x + W / 2;
  const { fy } = d;
  return (
    <g
      className={`cc-bay${selected ? ' sel' : ''}`}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`โต๊ะ ${d.badge} ${d.name} สถานะ ${STATE_LABEL[d.state]} ความคืบหน้า ${d.progress}%`}
      onClick={() => onSelect(d.id)}
      onKeyDown={keyHandler(d.id, onSelect)}
    >
      <rect className="cc-bay-halo" x={L - 7} y={fy - 186} width={W + 14} height={198} rx={12} fill="var(--cc-accent)" fillOpacity={0.14} stroke="var(--cc-accent)" strokeWidth={3} />
      <rect x={L + 2} y={fy - 8} width={W - 4} height={14} rx={3} fill={d.state === 'todo' ? 'url(#co-hz)' : `var(--cc-r${d.r})`} fillOpacity={d.state === 'todo' ? 1 : 0.35} stroke={INK} strokeWidth={2} />
      {/* sign plate */}
      <polygon points={`${L + 10},${fy - 178} ${R + 2},${fy - 178} ${R - 6},${fy - 150} ${L + 2},${fy - 150}`} fill="var(--cc-surface)" stroke={INK} strokeWidth={3} strokeLinejoin="round" className="cc-plate" />
      <polygon points={starburst(L + 12, fy - 164, 17, 12)} fill="var(--cc-accent2)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <text x={L + 12} y={fy - 164} textAnchor="middle" dominantBaseline="central" fontSize={d.badge.length > 1 ? 11 : 14} fontWeight={600} fill="#fff">
        {d.badge}
      </text>
      <text x={L + 32} y={fy - 164} dominantBaseline="central" fontSize={d.name.length > 8 ? 13 : 15.5} fontWeight={600} fill="var(--cc-fg)">
        {d.name}
      </text>
      <Mark state={d.state} x={R - 12} y={fy - 164} />
      {d.state === 'demo' && (
        <g>
          <rect x={R - 46} y={fy - 146} width={40} height={16} rx={8} fill="var(--cc-accent)" stroke={INK} strokeWidth={1.5} />
          <text x={R - 26} y={fy - 138} textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill="#fff" letterSpacing={1}>DEMO</text>
        </g>
      )}
      {/* chair back */}
      <rect x={d.x - 36} y={fy - 80} width={28} height={44} rx={7} fill={`var(--cc-r${d.r})`} stroke={INK} strokeWidth={2.5} />
    </g>
  );
}

function DeskFront({ d, onSelect, typing }: { d: DeskView; onSelect: (id: string) => void; typing: boolean }) {
  const L = d.x - W / 2;
  const { fy } = d;
  const barW = W - 48;
  const empty = d.state === 'todo';
  return (
    <g className="cc-bay" onClick={() => onSelect(d.id)} aria-hidden="true">
      {/* monitor */}
      <rect x={d.x + 8} y={fy - 90} width={46} height={34} rx={4} fill="var(--cc-r3)" stroke={INK} strokeWidth={2.5} />
      <rect x={d.x + 12} y={fy - 86} width={38} height={26} rx={2} fill={empty ? 'var(--cc-floor2)' : 'var(--cc-win)'} />
      {!empty && (
        <g className={typing ? 'co-screen' : undefined}>
          <rect x={d.x + 15} y={fy - 82} width={24} height={3} rx={1.5} fill={INK} opacity={0.55} />
          <rect x={d.x + 15} y={fy - 76} width={30} height={3} rx={1.5} fill={INK} opacity={0.35} />
          <rect className="co-line3" x={d.x + 15} y={fy - 70} width={18} height={3} rx={1.5} fill={INK} opacity={0.35} />
        </g>
      )}
      <rect x={d.x + 27} y={fy - 56} width={8} height={7} fill={INK} />
      {/* desk */}
      <rect x={L + 8} y={fy - 50} width={W - 16} height={10} rx={3} fill="var(--cc-w3)" stroke={INK} strokeWidth={2.5} />
      <rect x={L + 14} y={fy - 40} width={W - 28} height={36} rx={3} fill="var(--cc-w1)" stroke={INK} strokeWidth={2.5} />
      <Prop kind={d.prop} x={L + 22} y={fy - 50} />
      {/* progress */}
      <text x={L + 24} y={fy - 30} dominantBaseline="central" fontSize={11} fontWeight={600} fill="var(--cc-fg)">
        {empty ? '—' : `${d.progress}%`}
      </text>
      <text x={L + 24 + barW} y={fy - 30} textAnchor="end" dominantBaseline="central" fontSize={9.5} fill="var(--cc-muted)">
        {clip(d.progressLabel, 12)}
      </text>
      <rect x={L + 24} y={fy - 22} width={barW} height={9} rx={4.5} fill="var(--cc-floor2)" stroke={INK} strokeWidth={1.5} />
      {!empty && d.progress > 0 && (
        <rect className="co-fill" x={L + 24} y={fy - 22} width={Math.max(9, (barW * d.progress) / 100)} height={9} rx={4.5} fill={d.state === 'demo' ? 'var(--cc-accent)' : `var(--cc-r${d.r})`} stroke={INK} strokeWidth={1.5} />
      )}
    </g>
  );
}

function Bubble({ x, y, text, tone = 'surface' }: { x: number; y: number; text: string; tone?: 'surface' | 'lead' }) {
  const t = clip(text, 26);
  const w = Math.round(visLen(t) * 6.9 + 22);
  const h = 26;
  const bx = Math.min(Math.max(x - w / 2, 6), VB_W - w - 6);
  const top = y - h - 9;
  const fill = tone === 'lead' ? 'var(--cc-w4)' : 'var(--cc-surface)';
  return (
    <g className="co-bubble">
      <polygon points={`${x - 7},${top + h - 2} ${x},${y} ${x + 6},${top + h - 2}`} fill={fill} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <rect x={bx} y={top} width={w} height={h} rx={13} fill={fill} stroke={INK} strokeWidth={2} />
      <rect x={x - 5} y={top + h - 3} width={10} height={4} fill={fill} />
      <text x={bx + w / 2} y={top + h / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="var(--cc-fg)">
        {t}
      </text>
    </g>
  );
}

function Paper() {
  return (
    <g transform="translate(-8,-26)">
      <path d="M0,0 H11 L16,5 V20 H0 Z" fill="var(--cc-w1)" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M3,8 H12 M3,12 H12 M3,16 H9" stroke="var(--cc-r1)" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  );
}

function OfficeMap({
  desks, selected, onSelect, phase, speaker, animate, moving, workTick, clock
}: {
  desks: DeskView[];
  selected: DeskId;
  onSelect: (id: DeskId) => void;
  phase: 'work' | 'meeting';
  speaker: { who: DeskId | 'lead'; text: string } | null;
  animate: boolean;
  moving: boolean;
  workTick: number;
  clock: { h: number; m: number };
}) {
  const sel = (id: string) => onSelect(id as DeskId);
  const posOf = (d: DeskView): [number, number] => (phase === 'meeting' && d.seat && d.state !== 'todo' ? d.seat : [d.x - 22, d.fy - 38]);
  const real = desks.filter((d) => d.state !== 'todo');
  // Agents walk between desk and meeting seat via a CSS transform transition.
  // Each agent stays in one layer for both positions so it never remounts
  // mid-walk.
  const agentLayer = (list: DeskView[]) => (
    <g aria-hidden="true">
      {list.map((d) => {
        const [px, py] = posOf(d);
        const working = d.state === 'active' || d.state === 'demo';
        return (
          <g
            key={d.id}
            className={`co-agent${moving ? ' cc-walker' : ''}`}
            style={{ transform: `translate(${px}px, ${py}px)`, transition: animate ? `transform ${MOVE_MS}ms ease-in-out` : 'none' }}
          >
            <g className={working && phase === 'work' && !moving ? 'co-typing' : undefined}>
              <Agent x={0} y={0} look={d.state === 'todo' ? 'ghost' : 'ai'} aura={d.state === 'active'} color={`var(--cc-r${d.r})`} scale={0.95} />
            </g>
          </g>
        );
      })}
    </g>
  );
  const hourA = ((clock.h % 12) + clock.m / 60) * 30;
  const minA = clock.m * 6;

  return (
    <svg className="cc-city" viewBox={`0 0 ${VB_W} ${VB_H}`} role="group" aria-label="ห้องทำงานจำลอง Creative Generator: พนักงาน AI ทำงานที่โต๊ะ ส่งต่องาน และประชุมรวมกัน">
      <defs>
        <pattern id="co-tile" width={48} height={48} patternUnits="userSpaceOnUse">
          <rect width={48} height={48} fill="var(--cc-floor)" />
          <path d="M48,0 H0 V48" fill="none" stroke="var(--cc-floor2)" strokeWidth={2} />
        </pattern>
        <pattern id="co-hz" width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={12} height={12} fill="var(--cc-hazard)" />
          <rect width={6} height={12} fill="var(--cc-ink)" />
        </pattern>
      </defs>

      <rect x={0} y={0} width={VB_W} height={VB_H} rx={14} fill="url(#co-tile)" />

      {/* back wall */}
      <rect x={0} y={0} width={VB_W} height={118} rx={14} fill="var(--cc-w2)" />
      <rect x={0} y={108} width={VB_W} height={12} fill="var(--cc-r3)" stroke={INK} strokeWidth={2.5} />
      {[40, 520].map((wx) => (
        <g key={wx}>
          <rect x={wx} y={22} width={150} height={70} rx={6} fill="var(--cc-win)" stroke={INK} strokeWidth={3} />
          <line x1={wx + 75} y1={22} x2={wx + 75} y2={92} stroke={INK} strokeWidth={3} />
          <path d={`M${wx + 12},80 L${wx + 40},40 M${wx + 30},84 L${wx + 58},44`} stroke="var(--cc-w1)" strokeWidth={5} strokeLinecap="round" opacity={0.6} />
        </g>
      ))}
      <polygon points="232,30 470,30 462,72 224,72" fill="var(--cc-surface)" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <text x={347} y={45} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} letterSpacing={2} fill="var(--cc-fg)">ZANA CREATIVE OFFICE</text>
      <text x={347} y={62} textAnchor="middle" dominantBaseline="central" fontSize={11.5} fill="var(--cc-muted)">ห้องทำงานจำลอง · Creative Generator</text>
      {/* clock */}
      <g transform="translate(492,52)">
        <circle r={17} fill="var(--cc-w1)" stroke={INK} strokeWidth={3} />
        <line x1={0} y1={0} x2={0} y2={-9} stroke={INK} strokeWidth={3} strokeLinecap="round" transform={`rotate(${hourA})`} />
        <line x1={0} y1={0} x2={0} y2={-13} stroke="var(--cc-accent)" strokeWidth={2} strokeLinecap="round" transform={`rotate(${minA})`} />
        <circle r={2.5} fill={INK} />
      </g>

      {/* handoff lane Idea → Script → Storyboard, then dashed to Reels (not built) */}
      <path d={HANDOFF_PATH} fill="none" stroke="var(--cc-beltline)" strokeWidth={16} strokeLinecap="round" />
      <path d={HANDOFF_PATH} fill="none" stroke="var(--cc-belt)" strokeWidth={11} strokeLinecap="round" />
      <path d="M445,352 L620,352" fill="none" stroke="var(--cc-beltline)" strokeWidth={3} strokeDasharray="6 7" strokeLinecap="round" />
      {[182, 357].map((x) => (
        <path key={x} d="M-6,-7 L4,0 L-6,7" transform={`translate(${x},352)`} fill="none" stroke="var(--cc-accent2)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <text x={532} y={368} textAnchor="middle" fontSize={10.5} fill="var(--cc-muted)">รอเชื่อม Reels</text>

      {/* meeting corner: whiteboard + rug */}
      <ellipse cx={TABLE.cx} cy={TABLE.cy + 6} rx={TABLE.rx + 60} ry={TABLE.ry + 62} fill="var(--cc-r1)" opacity={0.12} />
      <g>
        <rect x={34} y={430} width={104} height={86} rx={4} fill="var(--cc-w1)" stroke={INK} strokeWidth={3} />
        <line x1={52} y1={516} x2={46} y2={560} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <line x1={120} y1={516} x2={126} y2={560} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <text x={86} y={446} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} fill="var(--cc-fg)">สรุปงาน</text>
        {real.map((d, i) => {
          const h = Math.max(3, (d.progress / 100) * 48);
          return <rect key={d.id} x={44 + i * 15} y={508 - h} width={10} height={h} fill={d.state === 'demo' ? 'var(--cc-accent)' : `var(--cc-r${d.r})`} stroke={INK} strokeWidth={1.2} />;
        })}
      </g>
      {/* water cooler + plant */}
      <g>
        <rect x={622} y={500} width={34} height={56} rx={4} fill="var(--cc-w3)" stroke={INK} strokeWidth={2.5} />
        <rect x={626} y={470} width={26} height={32} rx={8} fill="var(--cc-win)" stroke={INK} strokeWidth={2.5} />
        <rect x={672} y={530} width={26} height={26} rx={3} fill="var(--cc-trunk)" stroke={INK} strokeWidth={2.5} />
        <circle cx={685} cy={516} r={18} fill="var(--cc-tree)" stroke={INK} strokeWidth={2.5} />
      </g>

      {desks.map((d) => (
        <DeskBack key={d.id} d={d} selected={selected === d.id} onSelect={sel} />
      ))}

      {/* papers moving along the handoff lane */}
      {animate && phase === 'work' && (
        <g aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <animateMotion dur="9s" repeatCount="indefinite" begin={`-${i * 3}s`} path={HANDOFF_PATH} />
              <Paper />
            </g>
          ))}
        </g>
      )}

      {/* the lead (a person) by the whiteboard */}
      <Agent x={LEAD_POS[0]} y={LEAD_POS[1]} look="human" scale={1.05} />

      {/* back-row agents (top desks) — the table is drawn over their legs */}
      {agentLayer(desks.filter((d) => d.fy === ROW1))}

      {/* meeting table drawn over the back-row agents' legs */}
      <ellipse cx={TABLE.cx} cy={TABLE.cy + 8} rx={TABLE.rx} ry={TABLE.ry} fill={INK} opacity={0.18} />
      <ellipse cx={TABLE.cx} cy={TABLE.cy} rx={TABLE.rx} ry={TABLE.ry} fill="var(--cc-w4)" stroke={INK} strokeWidth={3} />
      <ellipse cx={TABLE.cx} cy={TABLE.cy - 4} rx={TABLE.rx - 18} ry={TABLE.ry - 14} fill="none" stroke={INK} strokeWidth={1.5} opacity={0.25} />
      <text x={TABLE.cx} y={TABLE.cy} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600} fill="var(--cc-muted)" letterSpacing={1}>
        {phase === 'meeting' ? 'กำลังประชุม' : 'โต๊ะประชุม'}
      </text>

      {/* front-row agents (bottom desks) sit in front of the table */}
      {agentLayer(desks.filter((d) => d.fy !== ROW1))}

      {desks.map((d) => (
        <DeskFront key={d.id} d={d} onSelect={sel} typing={phase === 'work' && (d.state === 'active' || d.state === 'demo')} />
      ))}

      {/* speech bubbles on top */}
      {!moving && phase === 'work' &&
        desks.map((d, i) =>
          (workTick + i) % 3 === 0 ? (
            <Bubble key={`${d.id}-${workTick}`} x={d.x - 22} y={d.fy - 100} text={d.lines[workTick % d.lines.length] ?? ''} />
          ) : null
        )}
      {!moving && phase === 'meeting' && speaker && (() => {
        if (speaker.who === 'lead') return <Bubble key={speaker.text} x={LEAD_POS[0]} y={LEAD_POS[1] - 66} text={speaker.text} tone="lead" />;
        const d = desks.find((x) => x.id === speaker.who);
        if (!d?.seat) return null;
        return <Bubble key={speaker.text} x={d.seat[0]} y={d.seat[1] - 60} text={speaker.text} />;
      })()}

      <rect x={60} y={872} width={600} height={34} rx={8} fill="var(--cc-floor2)" stroke={INK} strokeWidth={2.5} strokeDasharray="8 6" />
      <text x={360} y={889} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} letterSpacing={3} fill="var(--cc-muted)">
        ZANA CREATIVE OFFICE
      </text>
    </svg>
  );
}

// ---------- page section ----------

export default function CreativeOffice({ data, onOpenTab }: { data: OfficeData; onOpenTab: (tab: OfficeTab) => void }) {
  const [now, setNow] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<Mode>('auto');
  const [animate, setAnimate] = useState(false);
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState<DeskId>('idea');

  useEffect(() => {
    setNow(Date.now());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setAnimate(!mq.matches);
      if (mq.matches) setMode((m) => (m === 'auto' ? 'work' : m));
    };
    sync();
    mq.addEventListener('change', sync);
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      mq.removeEventListener('change', sync);
      window.clearInterval(id);
    };
  }, []);

  const desks = useMemo(() => buildDesks(data, now, tick), [data, now, tick]);
  const handoffs = useMemo(() => buildHandoffs(data), [data]);

  const meetingLines = useMemo(() => {
    const lines: { who: DeskId | 'lead'; text: string }[] = [{ who: 'lead', text: 'สรุปงานรอบนี้กันหน่อยครับ' }];
    for (const d of desks) if (d.state !== 'todo' && d.meetingLine) lines.push({ who: d.id, text: d.meetingLine });
    lines.push({ who: 'lead', text: 'E-Com กับ Reels รอเปิดเฟสหน้า' });
    lines.push({ who: 'lead', text: 'โอเค แยกย้ายกลับโต๊ะ!' });
    return lines;
  }, [desks]);

  // Auto mode: WORK_TICKS of desk work, then one tick walking to the table
  // and one tick per meeting line.
  const cycle = WORK_TICKS + 1 + meetingLines.length;
  const pos = tick % cycle;
  const phase: 'work' | 'meeting' = mode === 'auto' ? (pos < WORK_TICKS ? 'work' : 'meeting') : mode;
  const speaker =
    phase !== 'meeting'
      ? null
      : mode === 'auto'
        ? pos > WORK_TICKS
          ? meetingLines[pos - WORK_TICKS - 1]
          : null
        : meetingLines[tick % meetingLines.length];

  useEffect(() => {
    if (!animate) return;
    setMoving(true);
    const id = window.setTimeout(() => setMoving(false), MOVE_MS);
    return () => window.clearTimeout(id);
  }, [phase, animate]);

  const d = desks.find((x) => x.id === selected)!;
  const counts = desks.reduce<Record<DeskState, number>>((c, x) => ({ ...c, [x.state]: c[x.state] + 1 }), { active: 0, idle: 0, demo: 0, todo: 0 });
  const clockDate = now === null ? null : new Date(now);
  const clock = clockDate ? { h: clockDate.getHours(), m: clockDate.getMinutes() } : { h: 10, m: 10 };

  return (
    <div className="cc">
      <div className="cc-wrap">
        <header className="cc-header">
          <span className="cc-eyebrow">Creative Generator · ห้องทำงานจำลอง</span>
          <h1>ทีม AI กำลังทำอะไรอยู่</h1>
          <p className="cc-lead">
            เครื่องมือแต่ละตัวคือพนักงาน 1 คนที่โต๊ะ — ดูงานที่ทำอยู่ ความคืบหน้า สิ่งที่คุยกัน และการส่งต่องาน Idea → Script → Storyboard
            ตัวเลขมาจากงานจริงในระบบ ส่วนโต๊ะที่ยังไม่มีข้อมูลจะติดป้าย DEMO
          </p>
          <div className="cc-counts" aria-label="สรุปสถานะโต๊ะ">
            <span><span className="cc-mark ok" /> <b>{counts.active}</b> กำลังทำงาน</span>
            <span><span className="co-mark idle" /> <b>{counts.idle}</b> ว่าง</span>
            <span><span className="co-mark demo" /> <b>{counts.demo}</b> DEMO</span>
            <span><span className="cc-mark todo" /> <b>{counts.todo}</b> รอสร้าง</span>
          </div>
          <div className="cc-views" role="group" aria-label="ฉาก">
            {(
              [
                ['auto', 'อัตโนมัติ'],
                ['work', 'ทำงานที่โต๊ะ'],
                ['meeting', 'เรียกประชุม']
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="cc-grid">
          <div className="cc-mapbox">
            <OfficeMap
              desks={desks}
              selected={selected}
              onSelect={setSelected}
              phase={phase}
              speaker={speaker}
              animate={animate}
              moving={moving}
              workTick={tick}
              clock={clock}
            />
            <div className="cc-legend">
              <span><span className="cc-lg-aura" /> ออร่า = มีงานใน 24 ชม.</span>
              <span><span className="co-mark demo" /> DEMO = ยังไม่มีข้อมูลจริง</span>
              <span><span className="cc-lg-ghost" /> รอสร้าง</span>
              <span><span className="cc-lg-belt" /> สายส่งต่องาน</span>
            </div>
          </div>

          <div className="cc-side">
            <section className="cc-panel" aria-live="polite">
              <span className="cc-num">โต๊ะ {d.badge} · {d.role}</span>
              <h2>{d.name}</h2>
              <div className={`cc-state co-${d.state}`}>
                <strong>{STATE_LABEL[d.state]}</strong>
                {d.lastAt && <span>· อัปเดต {timeAgo(d.lastAt, now)}</span>}
              </div>
              <dl>
                <dt>กำลังทำ</dt>
                <dd>{d.task}</dd>
                <dt>ความคืบหน้า</dt>
                <dd className="co-progress">
                  <span className="co-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.progress}>
                    <span style={{ width: `${d.state === 'todo' ? 0 : d.progress}%` }} className={d.state === 'demo' ? 'demo' : undefined} />
                  </span>
                  <b>{d.state === 'todo' ? '—' : `${d.progress}%`}</b>
                  <span className="co-sub">{d.progressLabel}</span>
                </dd>
                {d.steps && (
                  <>
                    <dt>ขั้นตอน</dt>
                    <dd>
                      {d.steps.map((s) => (
                        <span key={s.label} className={`cc-chip${s.done ? ' on' : ' ghost'}`}>{s.done ? '✓ ' : ''}{s.label}</span>
                      ))}
                    </dd>
                  </>
                )}
                <dt>กำลังพูดว่า</dt>
                <dd>
                  <ul className="co-recent">
                    {d.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </dd>
                {d.recent.length > 0 && (
                  <>
                    <dt>งานล่าสุด</dt>
                    <dd>
                      <ul className="co-recent">
                        {d.recent.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
              </dl>
              <button type="button" className="cc-next" onClick={() => onOpenTab(d.tab)}>
                {d.state === 'todo' ? 'ดูสถานะโหมดนี้ →' : `เปิดเครื่องมือ ${d.name} →`}
              </button>
            </section>

            <section>
              <h3 className="cc-h3">พนักงานทั้งหมด</h3>
              <ul className="cc-list">
                {desks.map((x) => (
                  <li key={x.id}>
                    <button type="button" className={`cc-item${x.id === selected ? ' sel' : ''}`} aria-pressed={x.id === selected} onClick={() => setSelected(x.id)}>
                      <span className="n">{x.badge}</span>
                      <span className="t">
                        <b>{x.name}</b>
                        <span className="co-bar sm" aria-hidden="true">
                          <span style={{ width: `${x.state === 'todo' ? 0 : x.progress}%` }} className={x.state === 'demo' ? 'demo' : undefined} />
                        </span>
                      </span>
                      <span className="s">{x.state === 'todo' ? 'รอสร้าง' : x.state === 'demo' ? 'DEMO' : `${x.progress}%`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="cc-panel">
              <h3 className="cc-h3">ส่งต่องานล่าสุด</h3>
              {handoffs.length === 0 ? (
                <p className="co-empty">ยังไม่มีการส่งต่องานจริง — สร้าง Script จากไอเดียหรือ Storyboard จากบท แล้วจะขึ้นที่นี่</p>
              ) : (
                <ul className="co-log">
                  {handoffs.map((h) => (
                    <li key={h.key}>
                      <span className={`co-hop${h.ok ? '' : ' bad'}`}>{h.from} → {h.to}</span>
                      <span className="co-log-t">{h.title}</span>
                      <span className="co-log-at">{timeAgo(h.at, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
