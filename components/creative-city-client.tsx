'use client';

// ZANA Creative City — interactive town map of the 10-station Creative
// Factory pipeline. React port of docs/creative-factory/zana-creative-city.html
// (same ring-road town, CEO hall in the centre, same palette, mobile + dark
// mode), plus the station-5 split into Editor AI / Editor คน from
// CREATIVE_FACTORY_HANDOFF.md §5. Original ZANA design — do not swap the
// buildings for castles/characters from other people's reference clips.
//
// Styles live in ./creative-city.css, all scoped under `.cc` so they can't
// leak into the rest of the app shell.

import { useEffect, useRef, useState, type KeyboardEvent, type SVGProps } from 'react';
import { WarehouseMap } from '@/components/creative-warehouse';
import {
  CX,
  CY,
  EDITOR_CONTEST_RULES,
  RING_ANGLES,
  STATIONS,
  STATUS_LABEL,
  type Station,
  type StationStatus
} from '@/lib/creative-city/stations';
import './creative-city.css';

type P = SVGProps<SVGElement>;
type View = 'warehouse' | 'city';
const VIEW_KEY = 'cc-view';

const LINE_C = 'var(--cc-line)';
const wallAttr = (s: Station): P => ({ fill: `var(--cc-w${s.w})`, stroke: LINE_C, strokeWidth: 3, strokeLinejoin: 'round' });
const roofAttr = (s: Station): P => ({ fill: `var(--cc-r${s.r})`, stroke: LINE_C, strokeWidth: 3, strokeLinejoin: 'round' });
const LINE: P = { stroke: LINE_C, strokeWidth: 3, strokeLinecap: 'round', fill: 'none' };
const WIN: P = { fill: 'var(--cc-win)', stroke: LINE_C, strokeWidth: 2.5 };
const DARK: P = { fill: LINE_C };

function R(x: number, y: number, w: number, h: number, a: P, rx = 0) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} {...(a as SVGProps<SVGRectElement>)} />;
}
function Poly(points: string, a: P) {
  return <polygon points={points} {...(a as SVGProps<SVGPolygonElement>)} />;
}
function L(x1: number, y1: number, x2: number, y2: number, a: P) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} {...(a as SVGProps<SVGLineElement>)} />;
}

function Building({ s }: { s: Station }) {
  const x = s.x;
  const g = s.y + 30;
  const W = wallAttr(s);
  const RF = roofAttr(s);
  const door = (dx = 0) => R(x + dx - 9, g - 26, 18, 26, DARK, 8);

  switch (s.kind) {
    case 'dome':
      return (
        <>
          {R(x - 44, g - 56, 88, 56, W, 4)}
          <path d={`M${x - 40},${g - 56} A40,38 0 0 1 ${x + 40},${g - 56} Z`} {...(RF as SVGProps<SVGPathElement>)} />
          {R(x - 5, g - 92, 10, 34, WIN, 3)}
          {L(x + 10, g - 82, x + 36, g - 106, { stroke: LINE_C, strokeWidth: 7, strokeLinecap: 'round' })}
          <circle cx={x - 26} cy={g - 34} r={7} {...(WIN as SVGProps<SVGCircleElement>)} />
          <circle cx={x + 26} cy={g - 34} r={7} {...(WIN as SVGProps<SVGCircleElement>)} />
          {door()}
        </>
      );
    case 'gable':
      return (
        <>
          {R(x + 20, g - 94, 12, 26, W, 2)}
          {R(x - 46, g - 52, 92, 52, W, 4)}
          {Poly(`${x - 56},${g - 52} ${x},${g - 98} ${x + 56},${g - 52}`, RF)}
          {R(x - 36, g - 40, 17, 17, WIN, 2)}
          {R(x + 19, g - 40, 17, 17, WIN, 2)}
          {door()}
        </>
      );
    case 'saw':
      return (
        <>
          {R(x - 48, g - 50, 96, 50, W, 4)}
          {[0, 1, 2].map((i) => {
            const a = x - 48 + i * 32;
            return <g key={i}>{Poly(`${a},${g - 50} ${a},${g - 82} ${a + 32},${g - 50}`, RF)}</g>;
          })}
          {R(x - 38, g - 38, 34, 22, WIN, 2)}
          {door(22)}
        </>
      );
    case 'shed':
      return (
        <>
          {R(x - 52, g - 46, 104, 46, W, 4)}
          {R(x - 58, g - 58, 116, 14, RF, 4)}
          {R(x - 40, g - 34, 46, 34, WIN, 2)}
          {L(x - 40, g - 23, x + 6, g - 23, LINE)}
          {L(x - 40, g - 12, x + 6, g - 12, LINE)}
          {R(x + 18, g - 20, 20, 20, { fill: 'var(--cc-w4)', stroke: LINE_C, strokeWidth: 2.5 }, 2)}
          {R(x + 24, g - 36, 16, 16, { fill: 'var(--cc-w2)', stroke: LINE_C, strokeWidth: 2.5 }, 2)}
        </>
      );
    case 'marquee':
      return (
        <>
          {R(x - 30, g - 82, 60, 24, RF, 4)}
          {R(x - 46, g - 60, 92, 60, W, 4)}
          {R(x - 52, g - 48, 104, 15, { fill: 'var(--cc-r4)', stroke: LINE_C, strokeWidth: 3 }, 5)}
          {[-2, -1, 0, 1, 2].map((j) => (
            <circle key={j} cx={x + j * 20} cy={g - 40.5} r={3} fill="var(--cc-w1)" />
          ))}
          {s.editorTrack ? (
            // Track label on the marquee sign instead of the play triangle,
            // so the two editor positions read apart at a glance.
            <text x={x} y={g - 70} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={600} fill="var(--cc-w1)">
              {s.editorTrack}
            </text>
          ) : (
            Poly(`${x - 7},${g - 76} ${x - 7},${g - 64} ${x + 8},${g - 70}`, { fill: 'var(--cc-w1)' })
          )}
          {R(x - 15, g - 26, 30, 26, DARK, 3)}
        </>
      );
    case 'gate':
      return (
        <>
          {R(x - 48, g - 66, 20, 66, W, 3)}
          {R(x + 28, g - 66, 20, 66, W, 3)}
          {R(x - 56, g - 84, 112, 20, RF, 7)}
          {L(x - 26, g - 22, x + 26, g - 22, { stroke: 'var(--cc-accent)', strokeWidth: 9, strokeLinecap: 'round' })}
          {L(x - 26, g - 22, x + 26, g - 22, { stroke: 'var(--cc-w1)', strokeWidth: 9, strokeDasharray: '9 9', strokeDashoffset: 9 })}
          <polyline
            points={`${x - 8},${g - 74} ${x - 2},${g - 68} ${x + 9},${g - 80}`}
            stroke="var(--cc-w1)"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'columns':
      return (
        <>
          {R(x - 46, g - 56, 92, 46, W, 2)}
          {Poly(`${x - 54},${g - 56} ${x},${g - 92} ${x + 54},${g - 56}`, RF)}
          {[-30, -10, 10, 30].map((d) => (
            <g key={d}>{L(x + d, g - 52, x + d, g - 12, { stroke: LINE_C, strokeWidth: 5, strokeLinecap: 'round' })}</g>
          ))}
          {R(x - 54, g - 10, 108, 10, W, 3)}
        </>
      );
    case 'billboard':
      return (
        <>
          {L(x + 16, g - 52, x + 16, g - 74, { stroke: LINE_C, strokeWidth: 5 })}
          {R(x - 36, g - 110, 74, 38, { fill: 'var(--cc-r2)', stroke: LINE_C, strokeWidth: 3 }, 5)}
          {Poly(`${x - 7},${g - 101} ${x - 7},${g - 81} ${x + 11},${g - 91}`, { fill: 'var(--cc-w1)' })}
          {R(x - 40, g - 44, 80, 44, W, 4)}
          {R(x - 46, g - 54, 92, 13, RF, 4)}
          {R(x - 30, g - 34, 18, 16, WIN, 2)}
          {door(16)}
        </>
      );
    case 'clock':
      return (
        <>
          {R(x - 50, g - 40, 28, 40, W, 3)}
          {R(x + 22, g - 40, 28, 40, W, 3)}
          {R(x - 22, g - 96, 44, 96, W, 3)}
          {Poly(`${x - 29},${g - 96} ${x},${g - 126} ${x + 29},${g - 96}`, RF)}
          <circle cx={x} cy={g - 72} r={13} {...(WIN as SVGProps<SVGCircleElement>)} />
          {L(x, g - 72, x, g - 81, LINE)}
          {L(x, g - 72, x + 7, g - 68, LINE)}
          {door()}
        </>
      );
    case 'hall':
      return (
        <>
          {R(x - 74, g - 58, 148, 58, W, 4)}
          {R(x - 80, g - 70, 160, 15, RF, 5)}
          {R(x - 26, g - 112, 52, 112, W, 3)}
          {Poly(`${x - 34},${g - 112} ${x},${g - 152} ${x + 34},${g - 112}`, RF)}
          {L(x, g - 152, x, g - 178, LINE)}
          {Poly(`${x},${g - 178} ${x + 26},${g - 169} ${x},${g - 160}`, {
            fill: 'var(--cc-accent)',
            stroke: LINE_C,
            strokeWidth: 2.5,
            strokeLinejoin: 'round'
          })}
          <circle cx={x} cy={g - 88} r={12} {...(WIN as SVGProps<SVGCircleElement>)} />
          {L(x, g - 88, x, g - 96, LINE)}
          {L(x, g - 88, x + 6, g - 85, LINE)}
          {[-60, -40, 40, 60].map((d) => (
            <g key={d}>{R(x + d - 7, g - 42, 14, 18, WIN, 2)}</g>
          ))}
          {R(x - 12, g - 34, 24, 34, DARK, 12)}
          {R(x - 36, g - 5, 72, 9, W, 3)}
        </>
      );
  }
}

function StatusMark({ status, x, y }: { status: StationStatus; x: number; y: number }) {
  if (status === 'ok') return <circle cx={x} cy={y} r={7} fill="var(--cc-ok)" />;
  if (status === 'todo') return <circle cx={x} cy={y} r={6} fill="none" stroke="var(--cc-todo)" strokeWidth={3.5} />;
  return <rect x={x - 6.5} y={y - 6.5} width={13} height={13} rx={2} fill="var(--cc-human)" />;
}

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x - 3} y={y - 4} width={6} height={16} rx={2} fill="var(--cc-trunk)" />
      <circle cx={x} cy={y - 16} r={17} fill="var(--cc-tree)" stroke={LINE_C} strokeWidth={2.5} />
    </>
  );
}

const TREES: [number, number][] = [
  [58, 118], [664, 130], [40, 462], [682, 470], [62, 948], [660, 948], [252, 672], [468, 672], [248, 408]
];

// Direction chevrons sit halfway between consecutive ring stations.
const CHEVRONS = RING_ANGLES.slice(0, -1).map((a, i) => {
  const mid = (a + RING_ANGLES[i + 1]) / 2;
  const t = (mid * Math.PI) / 180;
  const px = CX + 205 * Math.sin(t);
  const py = CY - 300 * Math.cos(t);
  const rot = (Math.atan2(300 * Math.sin(t), 205 * Math.cos(t)) * 180) / Math.PI;
  return `translate(${px.toFixed(1)},${py.toFixed(1)}) rotate(${rot.toFixed(1)})`;
});

function StationGroup({ s, selected, onSelect }: { s: Station; selected: boolean; onSelect: (id: string) => void }) {
  const x = s.x;
  const g = s.y + 30;
  const hw = s.hall ? 96 : s.compact ? 60 : 70;
  const pw = s.compact ? 140 : 152;
  const cOff = s.compact ? 52 : 58;
  const tOff = s.compact ? 36 : 40;
  const scale = s.scale ?? 1;
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(s.id);
    }
  };
  return (
    <g
      className={`cc-st${selected ? ' sel' : ''}`}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`สถานี ${s.id} ${s.name} ${s.sub} สถานะ ${STATUS_LABEL[s.status]}`}
      onClick={() => onSelect(s.id)}
      onKeyDown={onKey}
    >
      <ellipse className="cc-halo" cx={x} cy={g} rx={hw} ry={17} fill="var(--cc-accent)" fillOpacity={0.28} stroke="var(--cc-accent)" strokeWidth={3} />
      <ellipse cx={x} cy={g + 2} rx={hw - 14} ry={8} fill="var(--cc-shade)" />
      <g transform={scale !== 1 ? `translate(${x},${g}) scale(${scale}) translate(${-x},${-g})` : undefined}>
        <Building s={s} />
      </g>
      <rect className="cc-pill" x={x - pw / 2} y={g + 11} width={pw} height={34} rx={17} fill="var(--cc-surface)" stroke={LINE_C} strokeWidth={2} />
      <circle cx={x - cOff} cy={g + 28} r={12.5} fill="var(--cc-accent2)" />
      <text x={x - cOff} y={g + 28} textAnchor="middle" dominantBaseline="central" fontSize={s.id.length > 1 ? 12 : 15} fontWeight={600} fill="var(--cc-surface)">
        {s.id}
      </text>
      <text x={x - tOff} y={g + 28} dominantBaseline="central" fontSize={s.compact || s.name.length > 8 ? 17 : 20} fontWeight={500} fill="var(--cc-fg)">
        {s.name}
      </text>
      <StatusMark status={s.status} x={x + cOff} y={g + 28} />
    </g>
  );
}

function CityMap({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <svg className="cc-city" viewBox="0 0 720 1000" role="group" aria-label="แผนที่เมือง Creative Factory 10 สถานี">
      <rect x={0} y={0} width={720} height={1000} rx={14} fill="var(--cc-ground)" />
      <ellipse cx={CX} cy={CY} rx={150} ry={205} fill="var(--cc-plaza)" />
      {/* avenue from the ring down to the hall */}
      <line x1={360} y1={222} x2={360} y2={420} stroke="var(--cc-road)" strokeWidth={30} strokeLinecap="round" />
      {/* ring road */}
      <ellipse cx={CX} cy={CY} rx={205} ry={300} fill="none" stroke="var(--cc-roadline)" strokeWidth={40} />
      <ellipse cx={CX} cy={CY} rx={205} ry={300} fill="none" stroke="var(--cc-road)" strokeWidth={34} />
      <ellipse cx={CX} cy={CY} rx={205} ry={300} fill="none" stroke="var(--cc-roadline)" strokeWidth={2.5} strokeDasharray="10 12" />
      {CHEVRONS.map((tf) => (
        <path key={tf} d="M-7,-8 L5,0 L-7,8" transform={tf} fill="none" stroke="var(--cc-accent2)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d="M-8,-7 L0,5 L8,-7" transform="translate(360,305)" fill="none" stroke="var(--cc-accent2)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* feedback loop: hall back to Scout */}
      <path d="M436,470 C505,425 505,335 456,268" fill="none" stroke="var(--cc-accent)" strokeWidth={4} strokeDasharray="10 9" strokeLinecap="round" />
      <path d="M-8,6 L0,-6 L8,6" transform="translate(456,268) rotate(-28)" fill="none" stroke="var(--cc-accent)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
      {TREES.map(([x, y]) => (
        <Tree key={`${x}-${y}`} x={x} y={y} />
      ))}
      {STATIONS.map((s) => (
        <StationGroup key={s.id} s={s} selected={s.id === selected} onSelect={onSelect} />
      ))}
      {/* A vs B badge between the two editor positions */}
      <circle cx={360} cy={872} r={15} fill="var(--cc-surface)" stroke={LINE_C} strokeWidth={2.5} />
      <text x={360} y={872} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} fill="var(--cc-accent)">
        vs
      </text>
    </svg>
  );
}

function Mark({ status }: { status: StationStatus }) {
  return <i className={`cc-mark ${status}`} aria-hidden="true" />;
}

export function CreativeCityClient() {
  const [selectedId, setSelectedId] = useState(STATIONS[0].id);
  const panelRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('warehouse');
  // Walkers only move after mount (keeps SSR markup identical) and never
  // for viewers who asked for reduced motion.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === 'city' || saved === 'warehouse') setView(saved);
    } catch {
      /* storage blocked — keep default */
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setAnimate(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const changeView = (v: View) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const idx = STATIONS.findIndex((s) => s.id === selectedId);
  const s = STATIONS[idx];
  const next = STATIONS[(idx + 1) % STATIONS.length];

  const counts = STATIONS.reduce<Record<StationStatus, number>>(
    (c, st) => ({ ...c, [st.status]: c[st.status] + 1 }),
    { ok: 0, todo: 0, human: 0 }
  );

  const select = (id: string, fromMap: boolean) => {
    setSelectedId(id);
    // Only scroll when the panel is stacked under the map (single-column grid).
    const grid = gridRef.current;
    const stacked = grid ? getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length === 1 : false;
    if (fromMap && stacked) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panelRef.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="cc">
      <div className="cc-wrap">
        <header className="cc-header">
          <div className="cc-eyebrow">JANGZANA Creative Factory</div>
          <h1>ZANA Creative City</h1>
          <p className="cc-lead">
            {view === 'warehouse'
              ? 'โกดังผลิตคลิปโฆษณา 10 สถานี Agent ขนงานไปตามสายพานจาก Scout ถึงห้อง CEO แล้ววนกลับไปเริ่มรอบใหม่'
              : 'เมืองผลิตคลิปโฆษณา 10 สถานี งานเดินตามถนนวงแหวนตามเข็มนาฬิกา แล้วผลแอดวนกลับเข้าศาลากลางไปเริ่มรอบใหม่'}{' '}
            สถานี 5 แยกเป็น 2 ตำแหน่ง A (AI) กับ B (คน) เพื่อแข่งวัดผลกัน แตะแต่ละจุดเพื่อดูหน้าที่ของทีม
          </p>
          <div className="cc-views" role="group" aria-label="มุมมอง">
            {(
              [
                ['warehouse', 'โกดัง'],
                ['city', 'แผนที่เมือง']
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => changeView(v)}>
                {label}
              </button>
            ))}
          </div>
          <div className="cc-row" aria-label="แบรนด์">
            <span className="cc-chip on">ZANA น้ำหอมเด็ก · pilot</span>
            <span className="cc-chip ghost">แบรนด์ถัดไป: เปิดหลัง pilot ผ่าน</span>
          </div>
          <div className="cc-counts">
            {(['ok', 'human', 'todo'] as StationStatus[]).map((k) => (
              <span key={k} className="cc-row">
                <Mark status={k} />
                <b>{counts[k]}</b> {STATUS_LABEL[k]}
              </span>
            ))}
          </div>
        </header>

        <div className="cc-grid" ref={gridRef}>
          <div className="cc-mapbox">
            {view === 'warehouse' ? (
              <WarehouseMap selected={selectedId} onSelect={(id) => select(id, true)} animate={animate} />
            ) : (
              <CityMap selected={selectedId} onSelect={(id) => select(id, true)} />
            )}
            {view === 'warehouse' ? (
              <div className="cc-legend">
                <span><i className="cc-lg-aura" aria-hidden="true" />Agent มีออร่า = AI ทำงานอยู่</span>
                <span><Mark status="human" />คนทำ</span>
                <span><i className="cc-lg-ghost" aria-hidden="true" />ช่องลายเตือน = รอสร้าง</span>
                <span><i className="cc-lg-belt" aria-hidden="true" />Agent ขนงานตามสายพาน วนกลับ Scout</span>
              </div>
            ) : (
              <div className="cc-legend">
                <span><Mark status="ok" />พร้อมใช้</span>
                <span><Mark status="todo" />รอสร้าง</span>
                <span><Mark status="human" />คนทำ</span>
                <span><i className="cc-dash" aria-hidden="true" />ผลแอดวนกลับไปรอบใหม่</span>
              </div>
            )}
          </div>

          <div className="cc-side">
            <section className="cc-panel" ref={panelRef} aria-live="polite">
              <div className="cc-num">
                สถานี {s.step} จาก 10{s.editorTrack ? ` · ตำแหน่ง ${s.id.slice(-1)}` : ''}
              </div>
              <h2>
                {s.name} · {s.sub}
              </h2>
              <div className={`cc-state ${s.status}`}>
                <Mark status={s.status} />
                <strong>{STATUS_LABEL[s.status]}</strong>
                <span>{s.note}</span>
              </div>
              <dl>
                <div><dt>ทำอะไร</dt><dd>{s.job}</dd></div>
                <div><dt>รับเข้า</dt><dd>{s.inp}</dd></div>
                <div><dt>ส่งออก</dt><dd>{s.out}</dd></div>
                <div><dt>ใครทำ</dt><dd>{s.who}</dd></div>
                <div>
                  <dt>โฟลเดอร์งานใน Drive</dt>
                  <dd>
                    {s.dirs.map((d) => (
                      <code key={d}>{d}</code>
                    ))}
                  </dd>
                </div>
              </dl>
              {s.editorTrack && (
                <div className="cc-rules">
                  <h3>กติกาแข่ง A vs B <span className="cc-draft">ร่าง · รอบูมยืนยัน</span></h3>
                  <ul>
                    {EDITOR_CONTEST_RULES.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="cc-next" type="button" onClick={() => select(next.id, false)}>
                สถานีถัดไป: {next.name}
              </button>
            </section>

            <section>
              <h3 className="cc-h3">ทั้ง 10 สถานี</h3>
              <ol className="cc-list">
                {STATIONS.map((st) => (
                  <li key={st.id}>
                    <button
                      className={`cc-item${st.id === selectedId ? ' sel' : ''}${st.editorTrack ? ' sub' : ''}`}
                      type="button"
                      aria-pressed={st.id === selectedId}
                      onClick={() => select(st.id, false)}
                    >
                      <span className="n">{st.id}</span>
                      <span className="t">
                        <b>{st.name}</b>
                        <span>{st.sub}</span>
                      </span>
                      <span className="s">
                        <Mark status={st.status} />
                        {STATUS_LABEL[st.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <footer className="cc-footer">
          สถานะบนแผนที่เป็นค่าที่ตั้งไว้ ณ 10 พ.ย. 2026 ยังไม่ได้เชื่อมข้อมูลสดจากระบบ รายละเอียดกติกาและ Brand Card อยู่ในเอกสาร{' '}
          <a href="https://claude.ai/artifact/11FrKkYkbRXED994BZDdMY" target="_blank" rel="noreferrer">
            Master Pipeline + Brand Card
          </a>
        </footer>
      </div>
    </div>
  );
}
