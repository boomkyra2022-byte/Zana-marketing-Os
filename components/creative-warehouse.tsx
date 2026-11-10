'use client';

// ZANA Creative Warehouse — second view of /creative-city. The same
// stations drawn as bays in a warehouse; ZANA agents (original
// characters) work at each bay and carry crates along the conveyor
// walkway from station to station, ending at the CEO mezzanine and looping
// back to Scout.
//
// Style is an original anime-action look (heavy ink outlines, cel shading,
// energy auras, manga focus lines). It deliberately borrows NO characters,
// symbols, hair shapes or props from any existing anime, per the handoff
// rule "ห้ามลอกตัวละครจากคลิปตัวอย่างของคนอื่น".

import type { KeyboardEvent } from 'react';
import { STATIONS, STATUS_LABEL, type BuildingKind, type Station, type StationStatus } from '@/lib/creative-city/stations';

const INK = 'var(--cc-ink)';

// Bay placement: x centre, floor line fy, width w. Three rows in a snake
// (row 1 → right, row 2 ← left, row 3 → right), CEO mezzanine at the top.
const BAYS: Record<string, { x: number; fy: number; w: number }> = {
  '1': { x: 120, fy: 350, w: 130 },
  '2': { x: 355, fy: 350, w: 130 },
  '3': { x: 585, fy: 350, w: 130 },
  '4': { x: 585, fy: 610, w: 130 },
  '5A': { x: 425, fy: 610, w: 120 },
  '5B': { x: 275, fy: 610, w: 120 },
  '6': { x: 105, fy: 610, w: 120 },
  '7': { x: 120, fy: 870, w: 130 },
  '8': { x: 355, fy: 870, w: 130 },
  '9': { x: 585, fy: 870, w: 130 }
};

// Conveyor walkway loop, in pipeline order.
const PATH = 'M40,388 L672,388 L672,648 L28,648 L28,908 L702,908 L702,190 L28,190 L28,388 Z';

const CHEVRONS: [number, number, number][] = [
  [238, 388, 0], [470, 388, 0], [672, 518, 90],
  [502, 648, 180], [350, 648, 180], [190, 648, 180], [28, 778, 90],
  [238, 908, 0], [470, 908, 0], [702, 550, -90],
  [560, 190, 180], [160, 190, 180], [28, 290, 90]
];

const WALKERS = 6;
const WALK_SECONDS = 48;
// Where walkers stand when motion is off (SSR, reduced motion).
const STATIC_WALKERS: [number, number][] = [[240, 388], [672, 520], [350, 648], [470, 908], [702, 600], [160, 190]];

function starburst(cx: number, cy: number, r: number, inner: number, n = 10) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + rr * Math.cos(t)).toFixed(1)},${(cy + rr * Math.sin(t)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// Flame-shaped energy aura around an agent (feet at 0,0); spikes get
// longer toward the top so it reads as rising energy.
function flame(rx: number, ry: number, n: number, spike: number) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.8;
    const x = Math.sin(t) * rx * r;
    let y = -30 - Math.cos(t) * ry * r;
    if (i % 2 === 0 && Math.cos(t) > 0) y -= Math.cos(t) * spike;
    pts.push(`${x.toFixed(1)},${Math.min(y, 2).toFixed(1)}`);
  }
  return pts.join(' ');
}
const AURA_OUTER = flame(30, 40, 9, 20);
const AURA_INNER = flame(21, 32, 9, 11);

type AgentLook = 'ai' | 'human' | 'ghost';

function Agent({ x, y, look, aura, carry, scale = 1, color = 'var(--cc-r1)' }: {
  x: number; y: number; look: AgentLook; aura?: boolean; carry?: boolean; scale?: number; color?: string;
}) {
  const tf = `translate(${x},${y})${scale !== 1 ? ` scale(${scale})` : ''}`;
  if (look === 'ghost') {
    return (
      <g transform={tf} fill="none" stroke="var(--cc-muted)" strokeWidth={2.5} strokeDasharray="4 4">
        <rect x={-8} y={-13} width={16} height={13} rx={2} />
        <rect x={-12} y={-32} width={24} height={21} rx={6} />
        <rect x={-13} y={-55} width={26} height={24} rx={8} />
      </g>
    );
  }
  if (look === 'human') {
    return (
      <g transform={tf}>
        <rect className="cc-leg-a" x={-8} y={-13} width={6} height={13} rx={2} fill={INK} />
        <rect className="cc-leg-b" x={2} y={-13} width={6} height={13} rx={2} fill={INK} />
        <rect x={-12} y={-33} width={24} height={22} rx={7} fill="var(--cc-human)" stroke={INK} strokeWidth={3} />
        <rect x={1} y={-31} width={9} height={18} rx={4} fill={INK} opacity={0.18} />
        <circle cx={0} cy={-44} r={11} fill="var(--cc-skin)" stroke={INK} strokeWidth={3} />
        <path d="M-11,-46 A11,11 0 0 1 11,-46 Z" fill="var(--cc-r3)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <path d="M8,-47 L17,-46" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <circle cx={-4} cy={-41} r={1.6} fill={INK} />
        <circle cx={4} cy={-41} r={1.6} fill={INK} />
        {carry && <Crate />}
      </g>
    );
  }
  return (
    <g transform={tf}>
      {aura && (
        <g className="cc-aura">
          <polygon points={AURA_OUTER} fill="var(--cc-aura)" opacity={0.7} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <polygon points={AURA_INNER} fill="var(--cc-aura2)" opacity={0.85} />
        </g>
      )}
      <path className="cc-scarf" d="M-7,-31 C-16,-31 -25,-27 -34,-20 L-29,-15 C-21,-21 -14,-25 -7,-26 Z" fill="var(--cc-accent)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <rect className="cc-leg-a" x={-8} y={-13} width={6} height={13} rx={2} fill={INK} />
      <rect className="cc-leg-b" x={2} y={-13} width={6} height={13} rx={2} fill={INK} />
      <rect x={-12} y={-32} width={24} height={21} rx={6} fill={color} stroke={INK} strokeWidth={3} />
      <rect x={1} y={-30} width={9} height={17} rx={4} fill={INK} opacity={0.2} />
      <circle cx={-3} cy={-21} r={5} fill="var(--cc-w1)" stroke={INK} strokeWidth={2} />
      <text x={-3} y={-21} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={700} fill={INK}>Z</text>
      <rect x={-13} y={-55} width={26} height={24} rx={8} fill="var(--cc-w1)" stroke={INK} strokeWidth={3} />
      <rect x={2} y={-53} width={9} height={20} rx={4} fill={INK} opacity={0.12} />
      <rect x={-10} y={-48} width={20} height={8} rx={4} fill="var(--cc-visor)" stroke={INK} strokeWidth={2} />
      <rect x={-6} y={-46} width={4} height={3} rx={1} fill="#fff" />
      <rect x={3} y={-46} width={4} height={3} rx={1} fill="#fff" />
      <line x1={6} y1={-55} x2={9} y2={-63} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={9} cy={-64} r={3} fill="var(--cc-accent)" stroke={INK} strokeWidth={1.5} />
      {carry && <Crate />}
    </g>
  );
}

function Crate() {
  return (
    <>
      <rect x={-14} y={-38} width={28} height={18} rx={2} fill="var(--cc-w4)" stroke={INK} strokeWidth={2.5} />
      <line x1={0} y1={-38} x2={0} y2={-20} stroke="var(--cc-r2)" strokeWidth={3} />
    </>
  );
}

function Mark({ status, x, y }: { status: StationStatus; x: number; y: number }) {
  if (status === 'ok') return <circle cx={x} cy={y} r={6.5} fill="var(--cc-ok)" stroke={INK} strokeWidth={1.5} />;
  if (status === 'todo') return <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--cc-todo)" strokeWidth={3.5} />;
  return <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} fill="var(--cc-human)" stroke={INK} strokeWidth={1.5} />;
}

// One small prop per station so each bay reads at a glance.
function Prop({ kind, x, y }: { kind: BuildingKind; x: number; y: number }) {
  const s = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (kind) {
    case 'dome': // radar dish
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-3,0 L3,0 L0,-16 Z" fill="var(--cc-r1)" {...s} />
          <path d="M-16,-30 A17,17 0 0 0 10,-8 Z" fill="var(--cc-w3)" {...s} />
          <line x1={-3} y1={-19} x2={6} y2={-28} {...s} />
          <circle cx={7} cy={-29} r={3} fill="var(--cc-accent)" {...s} />
        </g>
      );
    case 'gable': // light bulb
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-6} y={-10} width={12} height={10} rx={2} fill="var(--cc-r3)" {...s} />
          <circle cx={0} cy={-22} r={12} fill="var(--cc-r4)" {...s} />
          <path d="M-4,-20 L0,-25 L4,-20" fill="none" {...s} />
          <path d="M-18,-34 L-13,-30 M18,-34 L13,-30 M0,-42 L0,-37" fill="none" {...s} />
        </g>
      );
    case 'saw': // camera
      return (
        <g transform={`translate(${x},${y})`}>
          <circle cx={-7} cy={-29} r={6} fill="var(--cc-w3)" {...s} />
          <circle cx={7} cy={-29} r={6} fill="var(--cc-w3)" {...s} />
          <rect x={-14} y={-22} width={24} height={18} rx={3} fill="var(--cc-r3)" {...s} />
          <path d="M10,-17 L18,-21 L18,-6 L10,-10 Z" fill="var(--cc-r3)" {...s} />
          <line x1={-2} y1={-4} x2={-2} y2={0} {...s} />
        </g>
      );
    case 'shed': // magnifier
      return (
        <g transform={`translate(${x},${y})`}>
          <line x1={6} y1={-12} x2={14} y2={-2} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          <circle cx={-2} cy={-22} r={12} fill="var(--cc-win)" {...s} />
        </g>
      );
    case 'marquee': // monitor with play
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-16} y={-34} width={32} height={22} rx={3} fill="var(--cc-r2)" {...s} />
          <path d="M-4,-28 L-4,-18 L5,-23 Z" fill="var(--cc-w1)" />
          <path d="M-6,0 L0,-12 L6,0 Z" fill={INK} />
        </g>
      );
    case 'gate': // approval stamp
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-5} y={-32} width={10} height={14} rx={4} fill="var(--cc-r1)" {...s} />
          <rect x={-14} y={-18} width={28} height={10} rx={2} fill="var(--cc-r2)" {...s} />
          <rect x={-16} y={-8} width={32} height={8} rx={2} fill="var(--cc-w1)" {...s} />
          <path d="M-6,-4 L-2,-1 L6,-7" fill="none" stroke="var(--cc-ok)" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 'columns': // filing cabinet
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-13} y={-36} width={26} height={36} rx={2} fill="var(--cc-w3)" {...s} />
          {[-28, -16, -4].map((d) => (
            <line key={d} x1={-4} y1={d} x2={4} y2={d} {...s} />
          ))}
          <line x1={-13} y1={-24} x2={13} y2={-24} {...s} />
          <line x1={-13} y1={-12} x2={13} y2={-12} {...s} />
        </g>
      );
    case 'billboard': // megaphone
      return (
        <g transform={`translate(${x},${y})`}>
          <path d="M-14,-26 L4,-34 L4,-12 L-14,-18 Z" fill="var(--cc-r2)" {...s} />
          <rect x={-18} y={-26} width={5} height={8} rx={1} fill="var(--cc-w1)" {...s} />
          <path d="M9,-30 Q14,-23 9,-16 M13,-34 Q21,-23 13,-12" fill="none" {...s} />
          <line x1={-6} y1={-16} x2={-4} y2={0} {...s} />
        </g>
      );
    case 'clock': // chart board
      return (
        <g transform={`translate(${x},${y})`}>
          <rect x={-16} y={-38} width={32} height={28} rx={2} fill="var(--cc-w1)" {...s} />
          <rect x={-10} y={-20} width={5} height={6} fill="var(--cc-r1)" />
          <rect x={-2} y={-27} width={5} height={13} fill="var(--cc-r2)" />
          <rect x={6} y={-33} width={5} height={19} fill="var(--cc-ok)" />
          <line x1={-10} y1={-10} x2={-14} y2={0} {...s} />
          <line x1={10} y1={-10} x2={14} y2={0} {...s} />
        </g>
      );
    default:
      return null;
  }
}

function keyHandler(id: string, onSelect: (id: string) => void) {
  return (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };
}

function Bay({ s, selected, onSelect }: { s: Station; selected: boolean; onSelect: (id: string) => void }) {
  const { x, fy, w } = BAYS[s.id];
  const L = x - w / 2;
  const R = x + w / 2;
  const empty = s.status === 'todo';
  const crate = (cx: number, bottom: number, cw: number, ch: number, alt: boolean, k: string) => (
    <g key={k}>
      <rect x={cx} y={bottom - ch} width={cw} height={ch} rx={2} fill={alt ? 'var(--cc-w4)' : `var(--cc-r${s.r})`} stroke={INK} strokeWidth={2} />
      <line x1={cx + cw / 2} y1={bottom - ch} x2={cx + cw / 2} y2={bottom} stroke={INK} strokeWidth={1.5} opacity={0.5} />
    </g>
  );
  const crates = empty
    ? [crate(L + 18, fy - 33, 22, 18, true, 'a')]
    : [
        crate(L + 16, fy - 66, 26, 24, false, 'a'),
        crate(L + 46, fy - 66, 20, 18, true, 'b'),
        crate(R - 46, fy - 66, 28, 26, false, 'c'),
        crate(L + 20, fy - 33, 30, 22, true, 'd'),
        crate(R - 40, fy - 33, 22, 20, false, 'e')
      ];

  return (
    <g
      className={`cc-bay${selected ? ' sel' : ''}`}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`ช่อง ${s.id} ${s.name} ${s.sub} สถานะ ${STATUS_LABEL[s.status]}`}
      onClick={() => onSelect(s.id)}
      onKeyDown={keyHandler(s.id, onSelect)}
    >
      <rect className="cc-bay-halo" x={L - 7} y={fy - 142} width={w + 14} height={162} rx={12} fill="var(--cc-accent)" fillOpacity={0.14} stroke="var(--cc-accent)" strokeWidth={3} />
      {/* floor pad (hazard stripes while the station is still to be built) */}
      <rect x={L + 2} y={fy - 6} width={w - 4} height={14} rx={3} fill={empty ? 'url(#cc-hz)' : `var(--cc-r${s.r})`} fillOpacity={empty ? 1 : 0.4} stroke={INK} strokeWidth={2} />
      {/* rack */}
      <rect x={L + 7} y={fy - 100} width={7} height={100} fill="var(--cc-r1)" stroke={INK} strokeWidth={2.5} />
      <rect x={R - 14} y={fy - 100} width={7} height={100} fill="var(--cc-r1)" stroke={INK} strokeWidth={2.5} />
      {crates}
      {[fy - 100, fy - 66, fy - 33].map((yy) => (
        <rect key={yy} x={L + 5} y={yy} width={w - 10} height={6} rx={1} fill="var(--cc-w3)" stroke={INK} strokeWidth={2.5} />
      ))}
      {/* sign plate */}
      <polygon points={`${L + 10},${fy - 136} ${R + 2},${fy - 136} ${R - 6},${fy - 108} ${L + 2},${fy - 108}`} fill="var(--cc-surface)" stroke={INK} strokeWidth={3} strokeLinejoin="round" className="cc-plate" />
      <polygon points={starburst(L + 12, fy - 122, 17, 12)} fill="var(--cc-accent2)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <text x={L + 12} y={fy - 122} textAnchor="middle" dominantBaseline="central" fontSize={s.id.length > 1 ? 11 : 14} fontWeight={600} fill="#fff">
        {s.id}
      </text>
      <text x={L + 32} y={fy - 122} dominantBaseline="central" fontSize={w <= 120 || s.name.length > 8 ? 13.5 : 16} fontWeight={600} fill="var(--cc-fg)">
        {s.name}
      </text>
      <Mark status={s.status} x={R - 12} y={fy - 122} />
      <Prop kind={s.kind} x={R - 28} y={fy + 2} />
      <Agent x={L + 28} y={fy + 4} look={s.status === 'human' ? 'human' : empty ? 'ghost' : 'ai'} aura={s.status === 'ok'} color={`var(--cc-r${s.r})`} />
    </g>
  );
}

function CeoOffice({ s, selected, onSelect }: { s: Station; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <g
      className={`cc-bay${selected ? ' sel' : ''}`}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`ช่อง ${s.id} ${s.name} ${s.sub} สถานะ ${STATUS_LABEL[s.status]}`}
      onClick={() => onSelect(s.id)}
      onKeyDown={keyHandler(s.id, onSelect)}
    >
      <rect className="cc-bay-halo" x={205} y={14} width={310} height={156} rx={14} fill="var(--cc-accent)" fillOpacity={0.14} stroke="var(--cc-accent)" strokeWidth={3} />
      {/* office */}
      <rect x={250} y={70} width={220} height={82} rx={4} fill="var(--cc-w2)" stroke={INK} strokeWidth={3} />
      <rect x={400} y={74} width={66} height={76} fill={INK} opacity={0.12} />
      <rect x={240} y={58} width={240} height={16} rx={5} fill="var(--cc-r2)" stroke={INK} strokeWidth={3} />
      <rect x={300} y={86} width={92} height={46} rx={3} fill="var(--cc-win)" stroke={INK} strokeWidth={3} />
      <rect x={312} y={114} width={10} height={12} fill="var(--cc-r1)" />
      <rect x={330} y={104} width={10} height={22} fill="var(--cc-r2)" />
      <rect x={348} y={96} width={10} height={30} fill="var(--cc-ok)" />
      <path d="M366,124 L376,108 L384,112" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={420} y={114} width={22} height={38} rx={3} fill={INK} />
      {/* flag */}
      <line x1={470} y1={58} x2={470} y2={22} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <polygon points="470,22 496,30 470,38" fill="var(--cc-accent)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {/* mezzanine + stairs */}
      <rect x={215} y={150} width={290} height={12} rx={2} fill="var(--cc-r3)" stroke={INK} strokeWidth={3} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={507 + i * 9} y1={156 + i * 6} x2={520 + i * 9} y2={156 + i * 6} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ))}
      {/* sign */}
      <polygon points="262,20 440,20 432,48 254,48" fill="var(--cc-surface)" stroke={INK} strokeWidth={3} strokeLinejoin="round" className="cc-plate" />
      <polygon points={starburst(262, 34, 18, 13)} fill="var(--cc-accent2)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <text x={262} y={34} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="#fff">10</text>
      <text x={286} y={34} dominantBaseline="central" fontSize={16} fontWeight={600} fill="var(--cc-fg)">CEO · วางแผน</text>
      <Mark status={s.status} x={422} y={34} />
      <Agent x={276} y={150} look="human" scale={1.1} />
    </g>
  );
}

export function WarehouseMap({ selected, onSelect, animate }: { selected: string; onSelect: (id: string) => void; animate: boolean }) {
  const ceo = STATIONS.find((s) => s.hall)!;
  const bays = STATIONS.filter((s) => !s.hall);
  return (
    <svg className="cc-city" viewBox="0 0 720 1000" role="group" aria-label="โกดัง Creative Factory: Agent ขนงานไปตามสายพาน 10 สถานี">
      <defs>
        <pattern id="cc-tile" width={40} height={40} patternUnits="userSpaceOnUse">
          <rect width={40} height={40} fill="var(--cc-floor)" />
          <path d="M40,0 H0 V40" fill="none" stroke="var(--cc-floor2)" strokeWidth={2} />
        </pattern>
        <pattern id="cc-hz" width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={12} height={12} fill="var(--cc-hazard)" />
          <rect width={6} height={12} fill="var(--cc-ink)" />
        </pattern>
        <clipPath id="cc-top">
          <rect x={0} y={0} width={720} height={176} />
        </clipPath>
      </defs>

      <rect x={0} y={0} width={720} height={1000} rx={14} fill="url(#cc-tile)" />
      {/* manga focus lines behind the CEO mezzanine */}
      <g clipPath="url(#cc-top)" stroke="var(--cc-speed)" strokeWidth={3} strokeLinecap="round">
        {Array.from({ length: 36 }, (_, i) => {
          const t = (i / 36) * Math.PI * 2;
          // Rounded so server and client markup match exactly (hydration).
          const r = (n: number) => Math.round(n * 10) / 10;
          return <line key={i} x1={r(360 + 150 * Math.cos(t))} y1={r(95 + 90 * Math.sin(t))} x2={r(360 + 520 * Math.cos(t))} y2={r(95 + 320 * Math.sin(t))} />;
        })}
      </g>

      {/* conveyor walkway */}
      <path d={PATH} fill="none" stroke="var(--cc-beltline)" strokeWidth={30} strokeLinejoin="round" />
      <path d={PATH} fill="none" stroke="var(--cc-belt)" strokeWidth={24} strokeLinejoin="round" />
      <path d={PATH} fill="none" stroke="var(--cc-beltline)" strokeWidth={2.5} strokeDasharray="10 12" strokeLinejoin="round" />
      {CHEVRONS.map(([x, y, r]) => (
        <path key={`${x}-${y}`} d="M-7,-8 L5,0 L-7,8" transform={`translate(${x},${y}) rotate(${r})`} fill="none" stroke="var(--cc-accent2)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      <CeoOffice s={ceo} selected={selected === ceo.id} onSelect={onSelect} />
      {bays.map((s) => (
        <Bay key={s.id} s={s} selected={selected === s.id} onSelect={onSelect} />
      ))}

      {/* A vs B badge between the two editor bays */}
      <polygon points={starburst(350, 548, 17, 12, 8)} fill="var(--cc-surface)" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <text x={350} y={548} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--cc-accent)">vs</text>

      {/* agents carrying crates along the walkway */}
      <g aria-hidden="true">
        {Array.from({ length: WALKERS }, (_, i) =>
          animate ? (
            <g key={i} className="cc-walker">
              <animateMotion dur={`${WALK_SECONDS}s`} repeatCount="indefinite" begin={`-${(i * WALK_SECONDS) / WALKERS}s`} path={PATH} />
              <Agent x={0} y={0} look="ai" carry scale={0.78} color={`var(--cc-r${(i % 4) + 1})`} />
            </g>
          ) : (
            <g key={i}>
              <Agent x={STATIC_WALKERS[i][0]} y={STATIC_WALKERS[i][1]} look="ai" carry scale={0.78} color={`var(--cc-r${(i % 4) + 1})`} />
            </g>
          )
        )}
      </g>

      {/* loading dock */}
      <rect x={60} y={942} width={600} height={40} rx={8} fill="var(--cc-floor2)" stroke={INK} strokeWidth={2.5} strokeDasharray="8 6" />
      <text x={360} y={962} textAnchor="middle" dominantBaseline="central" fontSize={18} fontWeight={600} letterSpacing={4} fill="var(--cc-muted)">
        ZANA CREATIVE WAREHOUSE
      </text>
    </svg>
  );
}
