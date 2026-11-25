'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdsReport } from '@/lib/meta/ads-report';
import { DashboardTab, dashboardAiData } from './dashboard-tab';
import { SpotlightTab, spotlightAiData, type SpotlightOpts } from './spotlight-tab';
import { FatigueTab, fatigueAiData, type FatigueOpts } from './fatigue-tab';
import { VideoTab, videoAiData } from './video-tab';
import { InsightPanel, type AiInsight } from './ui';
import AdsBoard, { type BoardAccount } from '@/components/ads-board';

type ReportTab = 'dashboard' | 'spotlight' | 'fatigue' | 'video';
type Tab = 'board' | ReportTab;

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'board', label: 'ตารางแอด', hint: 'ตารางแบบ Ads Manager: แคมเปญ / ชุดโฆษณา / โฆษณา พร้อมงบ ผลลัพธ์ การซื้อ และ ROAS' },
  { key: 'dashboard', label: 'Dashboard', hint: 'ภาพรวมทั้งบัญชี: แนวโน้ม, funnel, วัตถุประสงค์, อายุ × เพศ' },
  { key: 'spotlight', label: 'Ad Spotlight', hint: 'โฆษณาที่ควรเพิ่มงบ ควรพิจารณาปิด และครีเอทีฟที่ให้ผลดี' },
  { key: 'fatigue', label: 'Creative Fatigue', hint: 'โฆษณาไหนเริ่มล้า และควรเตรียมครีเอทีฟใหม่เมื่อไร' },
  { key: 'video', label: 'Video Ads', hint: 'จัดอันดับคลิป + หาจุดรั่ว Hook / Hold / CTA' }
];

const PRESETS: { key: string; label: string; days: number; endOffset: number }[] = [
  { key: 'yesterday', label: 'เมื่อวาน', days: 1, endOffset: 1 },
  { key: '3d', label: '3 วันล่าสุด', days: 3, endOffset: 1 },
  { key: '7d', label: '7 วันล่าสุด', days: 7, endOffset: 1 },
  { key: '14d', label: '14 วันล่าสุด', days: 14, endOffset: 1 },
  { key: '30d', label: '30 วันล่าสุด', days: 30, endOffset: 1 },
  { key: 'today7', label: '7 วัน (รวมวันนี้)', days: 7, endOffset: 0 }
];

function ymd(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function presetRange(key: string) {
  const p = PRESETS.find((x) => x.key === key) ?? PRESETS[2];
  const end = new Date();
  end.setDate(end.getDate() - p.endOffset);
  const start = new Date(end);
  start.setDate(start.getDate() - (p.days - 1));
  return { since: ymd(start), until: ymd(end) };
}

const LS_KEY = 'zana.adsIntelligence.v1';

type InsightState = { loading: boolean; error: string | null; insight: AiInsight | null; model?: string };
const emptyInsight: InsightState = { loading: false, error: null, insight: null };

export default function AdsIntelligenceClient({ accounts }: { accounts: BoardAccount[] }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [accountId, setAccountId] = useState(accounts[0]?.metaAccountId ?? '');
  const [preset, setPreset] = useState('7d');
  const [range, setRange] = useState(() => presetRange('7d'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AdsReport | null>(null);
  const [spotOpts, setSpotOpts] = useState<SpotlightOpts>({ minSpend: 350, result: 'inbox', level: 'ad' });
  const [fatOpts, setFatOpts] = useState<FatigueOpts>({ minSpend: 1000, minDays: 7, result: 'inbox' });
  const [insights, setInsights] = useState<Record<ReportTab, InsightState>>({ dashboard: emptyInsight, spotlight: emptyInsight, fatigue: emptyInsight, video: emptyInsight });

  // Per-viewer convenience only: remember last account + tab.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (saved.accountId) setAccountId(saved.accountId);
      if (saved.tab && TABS.some((t) => t.key === saved.tab)) setTab(saved.tab);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ accountId, tab }));
    } catch {
      // ignore
    }
  }, [accountId, tab]);

  const knownAccount = accounts.find((a) => a.metaAccountId === accountId);

  async function load() {
    if (!accountId.trim()) {
      setError('ใส่ ID บัญชีโฆษณาก่อน');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/ads-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, since: range.since, until: range.until })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `ดึงข้อมูลไม่สำเร็จ (${res.status})`);
      setReport(json as AdsReport);
      setInsights({ dashboard: emptyInsight, spotlight: emptyInsight, fatigue: emptyInsight, video: emptyInsight });
    } catch (e: any) {
      setError(e?.message || 'ดึงข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  const aiPayload = useMemo(() => {
    if (!report || tab === 'board') return null;
    if (tab === 'dashboard') return dashboardAiData(report);
    if (tab === 'spotlight') return spotlightAiData(report, spotOpts);
    if (tab === 'fatigue') return fatigueAiData(report, fatOpts);
    return videoAiData(report);
  }, [report, tab, spotOpts, fatOpts]);

  async function runInsight() {
    if (!report || !aiPayload || tab === 'board') return;
    const t = tab;
    setInsights((s) => ({ ...s, [t]: { ...s[t], loading: true, error: null } }));
    try {
      const res = await fetch('/api/tools/ads-intelligence/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab: t,
          accountName: report.accountName ?? report.accountId,
          since: report.since,
          until: report.until,
          currency: report.currency ?? 'THB',
          data: aiPayload
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `AI ไม่ตอบ (${res.status})`);
      setInsights((s) => ({ ...s, [t]: { loading: false, error: null, insight: json.insight, model: json.model } }));
    } catch (e: any) {
      setInsights((s) => ({ ...s, [t]: { ...s[t], loading: false, error: e?.message || 'AI ไม่ตอบ' } }));
    }
  }

  const spendRows = report?.rows.filter((r) => r.spend > 0).length ?? 0;

  const tabBar = (
    <>
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key ? 'border-[var(--accent-terracotta)] font-semibold text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--text-muted)] -mt-2">{TABS.find((t) => t.key === tab)?.hint}</p>
    </>
  );

  if (tab === 'board') {
    return (
      <div className="space-y-4">
        {tabBar}
        <AdsBoard accounts={accounts} theme="light" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabBar}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-[2_1_260px] min-w-0">
            <label className="field-label" htmlFor="ai-account">
              บัญชีโฆษณา
            </label>
            {accounts.length > 0 ? (
              <select
                id="ai-account"
                value={knownAccount ? accountId : '__custom'}
                onChange={(e) => setAccountId(e.target.value === '__custom' ? '' : e.target.value)}
                disabled={loading}
              >
                {accounts.map((a) => (
                  <option key={a.metaAccountId} value={a.metaAccountId}>
                    {a.name}
                    {a.label ? ` (${a.label})` : ''} · {a.metaAccountId.replace(/^act_/, '')}
                  </option>
                ))}
                <option value="__custom">ใส่ ID เอง…</option>
              </select>
            ) : null}
            {!knownAccount ? (
              <input
                className={accounts.length > 0 ? 'mt-2' : ''}
                placeholder="ID บัญชีโฆษณา เช่น 1597931678059325"
                value={accountId}
                inputMode="numeric"
                onChange={(e) => setAccountId(e.target.value.trim())}
                disabled={loading}
              />
            ) : null}
          </div>
          <div className="flex-[1_1_170px]">
            <label className="field-label" htmlFor="ai-preset">
              ช่วงวันที่
            </label>
            <select
              id="ai-preset"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                if (e.target.value !== 'custom') setRange(presetRange(e.target.value));
              }}
              disabled={loading}
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="custom">กำหนดเอง</option>
            </select>
          </div>
          <div className="flex gap-2 flex-[2_1_300px]">
            <div className="flex-1 min-w-0">
              <label className="field-label" htmlFor="ai-since">
                ตั้งแต่
              </label>
              <input
                id="ai-since"
                type="date"
                value={range.since}
                max={range.until}
                onChange={(e) => {
                  setPreset('custom');
                  setRange({ ...range, since: e.target.value });
                }}
                disabled={loading}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="field-label" htmlFor="ai-until">
                ถึง
              </label>
              <input
                id="ai-until"
                type="date"
                value={range.until}
                min={range.since}
                onChange={(e) => {
                  setPreset('custom');
                  setRange({ ...range, until: e.target.value });
                }}
                disabled={loading}
              />
            </div>
          </div>
          <button type="button" className="btn-primary h-[42px] flex-[0_0_auto] w-full sm:w-auto" onClick={load} disabled={loading || !accountId}>
            {loading ? 'กำลังดึงข้อมูล…' : 'วิเคราะห์ข้อมูล'}
          </button>
        </div>
        {tab === 'fatigue' && preset !== '30d' ? <p className="text-xs text-amber-700">Creative Fatigue อ่านแนวโน้มรายวัน — แนะนำเลือก “30 วันล่าสุด”</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {report ? (
          <p className="text-xs text-[var(--text-muted)]">
            {report.accountName ?? report.accountId} · {report.since} ถึง {report.until} · {spendRows} แถวข้อมูลรายวันที่มีการใช้เงิน · ดึงเมื่อ{' '}
            {new Date(report.fetchedAt).toLocaleString('th-TH')}
          </p>
        ) : null}
      </div>

      {!report ? (
        <div className="card p-10 text-center text-[var(--text-muted)]">{loading ? 'กำลังดึงข้อมูลจาก Meta…' : 'เลือกบัญชีและช่วงวันที่ แล้วกด "วิเคราะห์ข้อมูล"'}</div>
      ) : report.rows.length === 0 ? (
        <div className="card p-10 text-center text-[var(--text-muted)]">ช่วงวันที่นี้ไม่มีโฆษณาที่ใช้เงิน</div>
      ) : (
        <>
          {tab === 'dashboard' ? <DashboardTab report={report} /> : null}
          {tab === 'spotlight' ? <SpotlightTab report={report} opts={spotOpts} setOpts={setSpotOpts} /> : null}
          {tab === 'fatigue' ? <FatigueTab report={report} opts={fatOpts} setOpts={setFatOpts} /> : null}
          {tab === 'video' ? <VideoTab report={report} /> : null}
          <InsightPanel onRun={runInsight} state={insights[tab]} />
        </>
      )}
    </div>
  );
}
