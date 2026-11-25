'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  boardRates,
  boardTotals,
  DATE_PRESETS,
  isReachResult,
  rangeForPreset,
  resultLabel,
  statusInfo,
  type BoardLevel,
  type BoardMetrics,
  type BoardReport,
  type BoardRow,
  type BoardTone,
  type DateRange
} from '@/lib/meta/ads-board-shared';

// Ads Board — the Meta Ads Manager table, read-only: pick account(s), dates and
// level, and see the same columns Ads Manager shows. Used on /ads (dark) and
// as a tab on /ads-intelligence (light).

export interface BoardAccount {
  metaAccountId: string;
  name: string; // name in Meta
  label?: string | null; // our own label, when it differs
  enabled: boolean;
}

const ALL = '__all';
const LS_KEY = 'zana.adsBoard.v1';
const CONCURRENCY = 4;

const LEVELS: { key: BoardLevel; label: string }[] = [
  { key: 'campaign', label: 'แคมเปญ' },
  { key: 'adset', label: 'ชุดโฆษณา' },
  { key: 'ad', label: 'โฆษณา' }
];

const THEMES = {
  dark: { panel: '#18181b', line: '#27272a', text: '#e4e4e7', strong: '#ffffff', muted: '#a1a1aa', accent: '#c8a96e', onAccent: '#18181b' },
  light: {
    panel: 'var(--panel)',
    line: 'var(--border)',
    text: 'var(--text-main)',
    strong: 'var(--text-main)',
    muted: 'var(--text-muted)',
    accent: 'var(--accent-terracotta-dark)',
    onAccent: '#ffffff'
  }
} as const;

const TONE: Record<'dark' | 'light', Record<BoardTone, string>> = {
  dark: { ok: '#34d399', warn: '#fbbf24', bad: '#f87171', muted: '#a1a1aa' },
  light: { ok: '#047857', warn: '#b45309', bad: '#b91c1c', muted: 'var(--text-muted)' }
};

const num = (v: number | null, digits = 0) =>
  v === null ? '—' : v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(2)}%`);
const money = (v: number | null, currency: string) =>
  v === null ? '—' : `${currency === 'THB' ? '฿' : `${currency} `}${num(v, 2)}`;

type Values = BoardMetrics & { results: number | null; resultType: string | null; costPerResult: number | null };

interface Column {
  key: string;
  label: string;
  kind: 'money' | 'int' | 'pct' | 'x';
  get: (v: Values) => number | null;
  sub?: (v: Values) => string;
  extra?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'contacts', label: 'ผู้ติดต่อผ่านข้อความ', kind: 'int', get: (v) => v.contacts },
  { key: 'results', label: 'ผลลัพธ์', kind: 'int', get: (v) => v.results, sub: (v) => resultLabel(v.resultType) },
  {
    key: 'cpr',
    label: 'ต้นทุนต่อผลลัพธ์',
    kind: 'money',
    get: (v) => v.costPerResult,
    sub: (v) => (v.costPerResult !== null && v.resultType ? `ต่อ${isReachResult(v.resultType) ? ' 1,000 ' : ''}${resultLabel(v.resultType)}` : '')
  },
  { key: 'purchases', label: 'การซื้อ', kind: 'int', get: (v) => v.purchases },
  { key: 'cpp', label: 'ต้นทุนต่อการซื้อ', kind: 'money', get: (v) => boardRates(v).costPerPurchase },
  { key: 'value', label: 'ค่าคอนเวอร์ชั่นการซื้อ', kind: 'money', get: (v) => v.purchaseValue },
  { key: 'spend', label: 'จำนวนเงินที่ใช้จ่ายไป', kind: 'money', get: (v) => v.spend },
  { key: 'roas', label: 'ROAS การซื้อ', kind: 'x', get: (v) => boardRates(v).roas },
  { key: 'cpc', label: 'CPC (ทั้งหมด)', kind: 'money', get: (v) => boardRates(v).cpc },
  { key: 'ctr', label: 'CTR (ทั้งหมด)', kind: 'pct', get: (v) => boardRates(v).ctr },
  { key: 'cpm', label: 'CPM', kind: 'money', get: (v) => boardRates(v).cpm },
  { key: 'impressions', label: 'อิมเพรสชัน', kind: 'int', get: (v) => v.impressions, extra: true },
  { key: 'reach', label: 'การเข้าถึง', kind: 'int', get: (v) => v.reach, extra: true },
  { key: 'frequency', label: 'ความถี่', kind: 'x', get: (v) => boardRates(v).frequency, extra: true },
  { key: 'linkClicks', label: 'คลิกลิงก์', kind: 'int', get: (v) => v.linkClicks, extra: true },
  { key: 'linkCpc', label: 'CPC (ลิงก์)', kind: 'money', get: (v) => boardRates(v).linkCpc, extra: true },
  { key: 'linkCtr', label: 'CTR (ลิงก์)', kind: 'pct', get: (v) => boardRates(v).linkCtr, extra: true },
  { key: 'conversations', label: 'เริ่มการสนทนา', kind: 'int', get: (v) => v.conversations, extra: true },
  { key: 'cpContact', label: 'ต้นทุนต่อผู้ติดต่อ', kind: 'money', get: (v) => boardRates(v).costPerContact, extra: true }
];

function fmt(c: Column, v: Values, currency: string): string {
  const x = c.get(v);
  if (c.kind === 'money') return money(x, currency);
  if (c.kind === 'pct') return pct(x);
  return num(x, c.kind === 'x' ? 2 : 0);
}

const budgetOf = (r: BoardRow) => r.dailyBudget ?? r.lifetimeBudget;

function budgetText(r: BoardRow, currency: string): { main: string; sub: string } {
  const amount = budgetOf(r);
  if (amount === null) return { main: r.level === 'campaign' ? 'ใช้งบชุดโฆษณา' : '—', sub: '' };
  const kind = r.dailyBudget !== null ? 'รายวัน' : 'ตลอดอายุ';
  const from = r.budgetFrom === 'campaign' ? ' · งบแคมเปญ' : r.budgetFrom === 'adset' ? ' · งบชุดโฆษณา' : '';
  return { main: money(amount, currency), sub: kind + from };
}

async function fetchBoard(accountId: string, level: BoardLevel, range: DateRange, signal: AbortSignal): Promise<BoardReport> {
  const res = await fetch('/api/tools/ads-board', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, level, ...range }),
    signal
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `ดึงข้อมูลไม่สำเร็จ (${res.status})`);
  return json as BoardReport;
}

function csvCell(v: string | number | null): string {
  const raw = v === null ? '' : String(v);
  // Names come from Meta; a leading = + - @ would run as a formula in Excel.
  const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdsBoard({ accounts, theme }: { accounts: BoardAccount[]; theme: 'dark' | 'light' }) {
  const t = THEMES[theme];
  const enabled = useMemo(() => accounts.filter((a) => a.enabled), [accounts]);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string>(enabled.length > 0 ? ALL : accounts[0]?.metaAccountId ?? '');
  const [level, setLevel] = useState<BoardLevel>('adset');
  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('today'));
  const [show, setShow] = useState<'live' | 'all' | 'spent' | 'active'>('live');
  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'spend', dir: -1 });
  const [parent, setParent] = useState<{ level: 'campaign' | 'adset'; id: string; name: string } | null>(null);
  const [reports, setReports] = useState<BoardReport[]>([]);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cache = useRef(new Map<string, BoardReport>());
  const [refreshKey, setRefreshKey] = useState(0);

  // Per-viewer convenience: remember account and level.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (saved.accountId === ALL ? enabled.length > 0 : accounts.some((a) => a.metaAccountId === saved.accountId)) setAccountId(saved.accountId);
      if (LEVELS.some((l) => l.key === saved.level)) setLevel(saved.level);
      if (typeof saved.extra === 'boolean') setExtra(saved.extra);
    } catch {
      // ignore
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ accountId, level, extra }));
    } catch {
      // ignore
    }
  }, [ready, accountId, level, extra]);

  const rangeOk = !!range.since && !!range.until && range.since <= range.until;

  useEffect(() => {
    if (!ready || !accountId || !rangeOk) return;
    const ctrl = new AbortController();
    const targets = accountId === ALL ? enabled : accounts.filter((a) => a.metaAccountId === accountId);
    const out: BoardReport[] = [];
    const errs: { name: string; message: string }[] = [];
    let done = 0;
    let next = 0;
    setReports([]);
    setErrors([]);
    setProgress({ done: 0, total: targets.length });

    async function worker() {
      while (next < targets.length && !ctrl.signal.aborted) {
        const a = targets[next++];
        const key = [a.metaAccountId, level, range.since, range.until].join('|');
        try {
          const report = cache.current.get(key) ?? (await fetchBoard(a.metaAccountId, level, range, ctrl.signal));
          cache.current.set(key, report);
          out.push(report);
        } catch (e: any) {
          if (ctrl.signal.aborted) return;
          errs.push({ name: a.name, message: e?.message || 'ดึงข้อมูลไม่สำเร็จ' });
        }
        if (ctrl.signal.aborted) return;
        done += 1;
        setReports([...out]);
        setErrors([...errs]);
        setProgress(done < targets.length ? { done, total: targets.length } : null);
      }
    }
    // Small delay so typing a custom date doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      if (targets.length === 0) setProgress(null);
      for (let i = 0; i < Math.min(CONCURRENCY, targets.length); i++) void worker();
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [ready, accountId, level, range, rangeOk, refreshKey, accounts, enabled]);

  const refresh = useCallback(() => {
    cache.current.clear();
    setRefreshKey((k) => k + 1);
  }, []);

  const columns = useMemo(() => COLUMNS.filter((c) => extra || !c.extra), [extra]);
  const currencyOf = useMemo(() => new Map(reports.map((r) => [r.accountId, r.currency])), [reports]);
  const currencies = useMemo(() => [...new Set(reports.filter((r) => r.rows.some((x) => x.spend > 0)).map((r) => r.currency))], [reports]);
  const mixedCurrency = currencies.length > 1;
  const totalCurrency = currencies[0] ?? reports[0]?.currency ?? 'THB';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .flatMap((r) => r.rows)
      .filter((r) => {
        if (show === 'live' && r.spend <= 0 && r.status !== 'ACTIVE') return false;
        if (show === 'spent' && r.spend <= 0) return false;
        if (show === 'active' && r.status !== 'ACTIVE') return false;
        if (parent && (parent.level === 'campaign' ? r.campaignId : r.adsetId) !== parent.id) return false;
        return !q || [r.name, r.campaignName, r.adsetName, r.accountName, r.id].some((s) => s?.toLowerCase().includes(q));
      });
  }, [reports, show, query, parent]);

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const value = (r: BoardRow): string | number | null =>
      sort.key === 'name' ? r.name : sort.key === 'budget' ? budgetOf(r) : sort.key === 'status' ? statusInfo(r.status).label : col ? col.get(r) : null;
    return [...filtered].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1; // blanks always last
      const cmp = typeof x === 'string' ? x.localeCompare(String(y), 'th') : x - (y as number);
      return cmp * sort.dir || b.spend - a.spend;
    });
  }, [filtered, sort]);

  // Meta's unique account reach only matches the table when every row that delivered is in it.
  const delivered = (list: BoardRow[]) => list.filter((r) => r.impressions > 0).length;
  const unfiltered = reports.length === 1 && delivered(filtered) === delivered(reports[0].rows);
  const totals = useMemo(() => boardTotals(filtered, unfiltered ? reports[0].totalReach : null), [filtered, unfiltered, reports]);
  const warnings = reports.flatMap((r) => r.warnings.map((w) => `${r.accountName}: ${w}`));
  const fetchedAt = reports.reduce<string | null>((m, r) => (m === null || r.fetchedAt < m ? r.fetchedAt : m), null);
  const loading = progress !== null;

  function changeLevel(l: BoardLevel) {
    setLevel(l);
    if (l === 'campaign' || (l === 'adset' && parent?.level === 'adset')) setParent(null);
  }

  function drill(r: BoardRow) {
    if (r.level === 'ad') return;
    setParent({ level: r.level, id: r.id, name: r.name });
    setLevel(r.level === 'campaign' ? 'adset' : 'ad');
  }

  function toggleSort(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'status' ? 1 : -1 }));
  }

  function exportCsv() {
    const header = ['บัญชี', 'แคมเปญ', 'ชุดโฆษณา', 'ชื่อ', 'ID', 'สถานะ', 'งบรายวัน', 'งบตลอดอายุ', 'สกุลเงิน', 'ประเภทผลลัพธ์', ...COLUMNS.map((c) => c.label)];
    const body = rows.map((r) => [
      r.accountName,
      r.campaignName,
      r.adsetName,
      r.name,
      `id:${r.id}`, // prefixed so Excel keeps all digits
      statusInfo(r.status).label,
      r.dailyBudget,
      r.lifetimeBudget,
      currencyOf.get(r.accountId) ?? '',
      resultLabel(r.resultType),
      ...COLUMNS.map((c) => c.get(r))
    ]);
    const csv = '﻿' + [header, ...body].map((line) => line.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ads-board_${level}_${range.since}_${range.until}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = (active: boolean): React.CSSProperties => ({
    background: active ? t.accent : 'transparent',
    color: active ? t.onAccent : t.text,
    border: `1px solid ${active ? t.accent : t.line}`,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap'
  });
  const th: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: t.muted, background: t.panel };
  const td: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'top' };
  const sticky: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: t.panel, boxShadow: `1px 0 0 ${t.line}` };

  function SortHead({ id, label, right }: { id: string; label: string; right?: boolean }) {
    const on = sort.key === id;
    return (
      <button type="button" onClick={() => toggleSort(id)} style={{ font: 'inherit', color: on ? t.strong : 'inherit', textAlign: right ? 'right' : 'left' }}>
        {label} {on ? (sort.dir === 1 ? '↑' : '↓') : ''}
      </button>
    );
  }

  return (
    <div style={{ color: t.text }}>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="w-full sm:w-auto sm:flex-[2_1_260px] min-w-0">
          <label htmlFor="board-account" className="block text-xs mb-1" style={{ color: t.muted }}>
            บัญชีโฆษณา
          </label>
          <select
            id="board-account"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setParent(null);
            }}
          >
            {enabled.length > 0 ? <option value={ALL}>ทุกบัญชีที่เปิดใช้ ({enabled.length})</option> : null}
            {accounts.map((a) => (
              <option key={a.metaAccountId} value={a.metaAccountId}>
                {a.name}
                {a.label ? ` (${a.label})` : ''} · {a.metaAccountId.replace(/^act_/, '')}
                {a.enabled ? '' : ' · ยังไม่เปิดใช้'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-[1_1_140px]">
          <label htmlFor="board-preset" className="block text-xs mb-1" style={{ color: t.muted }}>
            ช่วงวันที่
          </label>
          <select
            id="board-preset"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              if (e.target.value !== 'custom') setRange(rangeForPreset(e.target.value));
            }}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom">กำหนดเอง</option>
          </select>
        </div>
        {(['since', 'until'] as const).map((k) => (
          <div key={k} className="flex-[1_1_140px]">
            <label htmlFor={`board-${k}`} className="block text-xs mb-1" style={{ color: t.muted }}>
              {k === 'since' ? 'ตั้งแต่' : 'ถึง'}
            </label>
            <input
              id={`board-${k}`}
              type="date"
              value={range[k]}
              style={{ colorScheme: theme }}
              onChange={(e) => {
                setPreset('custom');
                setRange({ ...range, [k]: e.target.value });
              }}
            />
          </div>
        ))}
      </div>
      {!rangeOk ? <p className="text-sm mb-3" style={{ color: TONE[theme].bad }}>เลือกวันที่ให้ครบ และวันเริ่มต้องไม่เกินวันสิ้นสุด</p> : null}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-1" role="tablist" aria-label="ระดับข้อมูล">
          {LEVELS.map((l) => (
            <button key={l.key} type="button" role="tab" aria-selected={level === l.key} style={btn(level === l.key)} onClick={() => changeLevel(l.key)}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="flex-[0_1_200px]">
          <select aria-label="กรองสถานะ" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
            <option value="live">ใช้เงิน หรือเปิดอยู่</option>
            <option value="all">ทั้งหมด</option>
            <option value="spent">มีการใช้เงิน</option>
            <option value="active">เปิดใช้งานอยู่</option>
          </select>
        </div>
        <div className="flex-[1_1_180px]">
          <input type="search" aria-label="ค้นหาชื่อ" placeholder="ค้นหาชื่อแคมเปญ / ชุดโฆษณา / โฆษณา" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="button" style={btn(extra)} aria-pressed={extra} onClick={() => setExtra(!extra)}>
          คอลัมน์เพิ่มเติม
        </button>
        <button type="button" style={btn(false)} onClick={exportCsv} disabled={rows.length === 0}>
          ดาวน์โหลด CSV
        </button>
        <button type="button" style={btn(false)} onClick={refresh} disabled={loading}>
          รีเฟรช
        </button>
      </div>

      {parent ? (
        <div className="mb-3 text-sm">
          <button type="button" style={btn(false)} onClick={() => setParent(null)}>
            {parent.level === 'campaign' ? 'แคมเปญ' : 'ชุดโฆษณา'}: {parent.name} ✕
          </button>
        </div>
      ) : null}

      <p className="text-xs mb-2" style={{ color: t.muted }} aria-live="polite">
        {progress
          ? `กำลังดึงข้อมูลจาก Meta… ${progress.done}/${progress.total} บัญชี`
          : `${rows.length} รายการ · ${range.since} ถึง ${range.until}${fetchedAt ? ` · ดึงเมื่อ ${new Date(fetchedAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}` : ''}`}
      </p>
      {errors.length > 0 ? (
        <ul className="text-sm mb-3 space-y-1" style={{ color: TONE[theme].bad }}>
          {errors.map((e) => (
            <li key={e.name}>
              {e.name}: {e.message}
            </li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="text-xs mb-3 space-y-1" style={{ color: TONE[theme].warn }}>
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="overflow-x-auto rounded-xl" style={{ background: t.panel, border: `1px solid ${t.line}` }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...th, ...sticky, textAlign: 'left' }}>
                <SortHead id="name" label={LEVELS.find((l) => l.key === level)!.label} />
              </th>
              <th scope="col" style={{ ...th, textAlign: 'left' }}>
                <SortHead id="status" label="การนำส่ง" />
              </th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>
                <SortHead id="budget" label="งบประมาณ" right />
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" style={{ ...th, textAlign: 'right' }}>
                  <SortHead id={c.key} label={c.label} right />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} style={{ padding: 32, textAlign: 'center', color: t.muted }}>
                  {loading ? 'กำลังดึงข้อมูลจาก Meta…' : errors.length > 0 && reports.length === 0 ? 'ดึงข้อมูลไม่สำเร็จ' : 'ไม่มีรายการในช่วงวันที่/ตัวกรองนี้'}
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const currency = currencyOf.get(r.accountId) ?? 'THB';
              const status = statusInfo(r.status);
              const budget = budgetText(r, currency);
              const context = [accountId === ALL ? r.accountName : null, level !== 'campaign' ? r.campaignName : null, level === 'ad' ? r.adsetName : null].filter(Boolean).join(' › ');
              return (
                <tr key={`${r.accountId}-${r.id}`}>
                  <td style={{ ...td, ...sticky, whiteSpace: 'normal', minWidth: 170, maxWidth: 260, borderTop: `1px solid ${t.line}` }}>
                    {r.level === 'ad' ? (
                      <span style={{ color: t.strong, fontWeight: 500 }}>{r.name}</span>
                    ) : (
                      <button type="button" onClick={() => drill(r)} className="text-left underline-offset-2 hover:underline" style={{ font: 'inherit', fontWeight: 500, color: t.strong }}>
                        {r.name}
                      </button>
                    )}
                    {context ? <div className="text-xs mt-0.5" style={{ color: t.muted }}>{context}</div> : null}
                  </td>
                  <td style={{ ...td, borderTop: `1px solid ${t.line}`, color: TONE[theme][status.tone] }}>{status.label}</td>
                  <td style={{ ...td, borderTop: `1px solid ${t.line}`, textAlign: 'right' }} className="tabular-nums">
                    {budget.main}
                    {budget.sub ? <div className="text-xs" style={{ color: t.muted }}>{budget.sub}</div> : null}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} style={{ ...td, borderTop: `1px solid ${t.line}`, textAlign: 'right' }} className="tabular-nums">
                      {fmt(c, r, currency)}
                      {c.sub && c.sub(r) ? <div className="text-xs" style={{ color: t.muted }}>{c.sub(r)}</div> : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr style={{ fontWeight: 600, color: t.strong }}>
                <td style={{ ...td, ...sticky, borderTop: `2px solid ${t.line}` }}>รวม {rows.length} รายการ</td>
                <td style={{ ...td, borderTop: `2px solid ${t.line}` }} />
                <td style={{ ...td, borderTop: `2px solid ${t.line}` }} />
                {columns.map((c) => (
                  <td key={c.key} style={{ ...td, borderTop: `2px solid ${t.line}`, textAlign: 'right' }} className="tabular-nums">
                    {mixedCurrency && (c.kind === 'money' || c.key === 'roas') ? 'หลายสกุลเงิน' : fmt(c, totals, totalCurrency)}
                    {c.sub && c.sub(totals) ? <div className="text-xs font-normal" style={{ color: t.muted }}>{c.sub(totals)}</div> : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: t.muted }}>
        อ่านข้อมูลอย่างเดียวจาก Meta · ผลลัพธ์และต้นทุนต่อผลลัพธ์ใช้ค่าของ Meta ตาม attribution ของแต่ละชุดโฆษณา · ข้อมูลวันนี้อาจต่างจาก Ads Manager เล็กน้อยตามเวลาที่ดึง
      </p>
    </div>
  );
}
