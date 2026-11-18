'use client';

import { useMemo, useRef, useState } from 'react';
import type { StudioClient, StudioPost, StudioRetention } from '@/types/database';
import {
  STUDIO_FIELDS,
  STUDIO_FORMATS,
  STUDIO_FORMAT_GROUPS,
  STUDIO_FUNNEL,
  type StudioFormat
} from '@/prompts/content-studio';
import ContentStudioSalon, { useSalonRun, type SalonInfo } from '@/components/content-studio-salon';

interface Props {
  initialClients: StudioClient[];
  initialPosts: StudioPost[];
}

type Tab = 'create' | 'lib' | 'card' | 'form';
type Status = StudioPost['status'];
interface Draft {
  title: string;
  body: string;
  retention: StudioRetention | null;
  format: string;
  funnel: string;
  topic: string;
  saved: boolean;
}

const STATUS_LABEL: Record<Status, string> = { draft: 'ร่าง', approved: 'อนุมัติแล้ว', used: 'โพสต์แล้ว' };
const STATUS_CLASS: Record<Status, string> = {
  draft: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  used: 'bg-indigo-50 text-indigo-700'
};
const FMT = Object.fromEntries(STUDIO_FORMATS.map((f) => [f.id, f.name]));
const FUNNEL = Object.fromEntries(STUDIO_FUNNEL.map((f) => [f.id, f.name]));
const EMPTY_CARD = Object.fromEntries(STUDIO_FIELDS.map((f) => [f.key, ''])) as Record<string, string>;

async function api<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `เกิดข้อผิดพลาด (${res.status})`);
  return json as T;
}

type GenItem = { title: string; body: string; retention?: StudioRetention | null };

// Generate with stage streaming: the API sends one NDJSON line per real step
// (brand → examples → write → check) so the nail-salon scene can move the
// agent of the step that is running, then the items (or a Thai error).
async function generateStream(body: Record<string, unknown>, onStage: (e: { stage: string; examples?: number; count?: number }) => void): Promise<GenItem[]> {
  const res = await fetch('/api/content-studio/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, stream: true }) });
  if (!res.ok || !res.body || !(res.headers.get('content-type') ?? '').includes('ndjson')) {
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `เกิดข้อผิดพลาด (${res.status})`);
    if (Array.isArray(json?.items)) return json.items;
    throw new Error('AI ตอบกลับมาไม่ครบ ลองกดสร้างใหม่');
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: !done });
    let nl = buf.indexOf('\n');
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      nl = buf.indexOf('\n');
      if (!line) continue;
      let e: any;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (e.type === 'stage') onStage(e);
      else if (e.type === 'error') throw new Error(e.error || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      else if (e.type === 'done') return e.items as GenItem[];
    }
    if (done) break;
  }
  throw new Error('การเชื่อมต่อขาดระหว่างทาง ลองกดสร้างใหม่');
}

function scoreClass(s: number) {
  return s >= 8 ? 'bg-green-50 text-green-700' : s >= 6 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
}

function Retention({ r }: { r: StudioRetention | null }) {
  const [open, setOpen] = useState(false);
  if (!r) return null;
  const failed = r.checks.filter((c) => !c.pass);
  return (
    <div className="text-sm">
      <button type="button" onClick={() => setOpen(!open)} className={`rounded-full px-2.5 py-0.5 font-semibold ${scoreClass(r.score)}`}>
        ดึงคนดูจนจบ {r.score}/10 {failed.length ? `· แก้ได้ ${failed.length} จุด` : '· ผ่านครบ'} {open ? '▲' : '▼'}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {r.checks.map((c, i) => (
            <li key={i} className={c.pass ? 'text-green-700' : 'text-red-700'}>
              {c.pass ? '✓' : '✗'} {c.name}
              {!c.pass && c.fix ? <span className="text-[var(--text-muted)]"> — {c.fix}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ContentStudioClient({ initialClients, initialPosts }: Props) {
  const [clients, setClients] = useState(initialClients);
  const [posts, setPosts] = useState(initialPosts);
  const [sel, setSel] = useState<string | null>(initialClients[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>(initialClients.length ? 'create' : 'form');
  const [editingCard, setEditingCard] = useState<StudioClient | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_CARD);
  const [raw, setRaw] = useState('');
  const [fmt, setFmt] = useState('sale');
  const [funnel, setFunnel] = useState('tofu');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(3);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [libFmt, setLibFmt] = useState('all');
  const [libStatus, setLibStatus] = useState<'all' | Status>('all');
  const [editPost, setEditPost] = useState<{ id: string; body: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const salon = useSalonRun();
  const resultsRef = useRef<HTMLDivElement>(null);

  const client = clients.find((c) => c.id === sel) ?? null;
  const clientPosts = useMemo(() => posts.filter((p) => p.client_id === sel), [posts, sel]);
  const fmtObj = STUDIO_FORMATS.find((f) => f.id === fmt) as StudioFormat;
  const approvedSame = clientPosts.filter((p) => p.format === fmt && p.status !== 'draft').length;
  const scored = drafts.filter((d) => d.retention);
  const salonInfo: SalonInfo = {
    clientName: tab === 'form' ? form.name?.trim() || null : client?.name ?? null,
    clientCount: clients.length,
    cardFilled: STUDIO_FIELDS.filter((f) => String((tab === 'form' ? form[f.key] : (client as any)?.[f.key]) ?? '').trim()).length,
    cardTotal: STUDIO_FIELDS.length,
    positioning: (tab === 'form' ? form.positioning : client?.positioning)?.split('\n')[0] || null,
    formatName: FMT[fmt] ?? fmt,
    funnelName: FUNNEL[funnel] ?? funnel,
    topic: topic.trim(),
    count: fmtObj?.single ? 1 : count,
    examples: approvedSame,
    libTotal: clientPosts.length,
    libApproved: clientPosts.filter((p) => p.status === 'approved').length,
    libUsed: clientPosts.filter((p) => p.status === 'used').length,
    unsaved: drafts.filter((d) => !d.saved).length,
    avgScore: scored.length ? Math.round((scored.reduce((a, d) => a + (d.retention?.score ?? 0), 0) / scored.length) * 10) / 10 : null
  };
  const showResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash('คัดลอกแล้ว');
    } catch {
      flash('คัดลอกไม่ได้ ให้เลือกข้อความแล้วกด Ctrl+C');
    }
  }
  function openForm(c: StudioClient | null) {
    setEditingCard(c);
    setForm(c ? Object.fromEntries(STUDIO_FIELDS.map((f) => [f.key, (c as any)[f.key] ?? ''])) : EMPTY_CARD);
    setRaw('');
    setErr('');
    setTab('form');
  }
  function pick(id: string) {
    setSel(id);
    setDrafts([]);
    setErr('');
    setTab('create');
  }

  async function autofill() {
    if (!raw.trim()) return setErr('วางข้อมูลลูกค้าก่อน');
    setBusy('autofill');
    setErr('');
    salon.start('autofill', ['reception', 'brand'], `รับข้อมูลดิบ ${raw.trim().length.toLocaleString('th-TH')} ตัวอักษร`);
    salon.step('brand', 'AI กำลังกรอก Brand Card…');
    try {
      const { fields } = await api<{ fields: Record<string, string> }>('/api/content-studio/ai', 'POST', { mode: 'autofill', raw });
      setForm((f) => {
        const next = { ...f };
        for (const [k, v] of Object.entries(fields)) if (v) next[k] = v;
        return next;
      });
      flash('กรอกให้แล้ว ตรวจและแก้ก่อนกดบันทึก');
      salon.finish(`กรอกให้ ${Object.values(fields).filter(Boolean).length} ช่อง ตรวจก่อนบันทึก`);
    } catch (e: any) {
      setErr(e.message);
      salon.fail(e.message);
    }
    setBusy(null);
  }

  async function saveCard() {
    if (!form.name?.trim()) return setErr('ใส่ชื่อแบรนด์ก่อน');
    setBusy('card');
    setErr('');
    salon.start('card', ['brand'], `บันทึก Brand Card ${form.name.trim()}…`);
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    try {
      if (editingCard) {
        const { client: c } = await api<{ client: StudioClient }>('/api/content-studio/clients', 'PATCH', { id: editingCard.id, ...payload });
        setClients((cs) => cs.map((x) => (x.id === c.id ? c : x)));
        setTab('card');
        flash('บันทึก Brand Card แล้ว');
        salon.finish('บันทึก Brand Card แล้ว');
      } else {
        const { client: c } = await api<{ client: StudioClient }>('/api/content-studio/clients', 'POST', payload);
        setClients((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name, 'th')));
        setSel(c.id);
        setTab('create');
        flash('เพิ่มลูกค้าแล้ว');
        salon.finish(`เปิดแฟ้มลูกค้าใหม่ ${c.name} แล้ว`);
      }
    } catch (e: any) {
      setErr(e.message);
      salon.fail(e.message);
    }
    setBusy(null);
  }

  async function deleteClient(c: StudioClient) {
    if (confirmDel !== c.id) {
      setConfirmDel(c.id);
      flash('กด "ลบลูกค้ารายนี้" อีกครั้งเพื่อยืนยัน (คอนเทนต์ในคลังจะถูกลบด้วย)');
      setTimeout(() => setConfirmDel(null), 4000);
      return;
    }
    try {
      await api('/api/content-studio/clients', 'DELETE', { id: c.id });
      setClients((cs) => cs.filter((x) => x.id !== c.id));
      setPosts((ps) => ps.filter((p) => p.client_id !== c.id));
      setSel(null);
      setTab('create');
      flash('ลบแล้ว');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function generate() {
    if (!client) return;
    setBusy('gen');
    setErr('');
    setDrafts([]);
    const want = fmtObj?.single ? 1 : count;
    salon.start('generate', ['reception', 'brand', 'design', 'nail', 'qc'], `รับ brief: ${FMT[fmt] ?? fmt} · ${FUNNEL[funnel] ?? funnel}${topic.trim() ? ` · ${topic.trim()}` : ''}`);
    try {
      const items = await generateStream({ mode: 'generate', client_id: client.id, format: fmt, funnel, topic, count }, (e) => {
        if (e.stage === 'brand') salon.step('brand', `เปิด Brand Card ของ ${client.name}`);
        else if (e.stage === 'examples') salon.step('design', 'หาลายตัวอย่างที่อนุมัติแล้ว…');
        else if (e.stage === 'write') {
          salon.step('design', e.examples ? `ได้ลายตัวอย่าง ${e.examples} ชิ้น วางโครงแล้ว` : 'ยังไม่มีลายที่อนุมัติ ใช้แกนคอนเทนต์แทน');
          salon.step('nail', `AI กำลังเขียน ${e.count ?? want} ชิ้น…`);
        } else if (e.stage === 'check') salon.step('qc', 'ตรวจงาน + คะแนนดึงคนดู…');
      });
      setDrafts(items.map((x) => ({ title: x.title, body: x.body, retention: x.retention ?? null, format: fmt, funnel, topic: topic.trim(), saved: false })));
      const sc = items.filter((x) => x.retention);
      const avg = sc.length ? Math.round((sc.reduce((a, x) => a + (x.retention?.score ?? 0), 0) / sc.length) * 10) / 10 : null;
      salon.finish(`ได้ ${items.length} ชิ้น${avg !== null ? ` เฉลี่ย ${avg}/10` : ''}`);
    } catch (e: any) {
      setErr(e.message);
      salon.fail(e.message);
    }
    setBusy(null);
  }

  async function saveDraft(i: number, status: Status) {
    if (!client) return;
    const d = drafts[i];
    salon.start('save', ['showcase'], `เก็บ "${d.title}" เข้าคลัง…`);
    try {
      const { post } = await api<{ post: StudioPost }>('/api/content-studio/posts', 'POST', {
        client_id: client.id,
        format: d.format,
        funnel: d.funnel,
        title: d.title,
        body: d.body,
        topic: d.topic || null,
        retention: d.retention,
        status
      });
      setPosts((ps) => [post, ...ps]);
      setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, saved: true } : x)));
      flash(status === 'approved' ? 'อนุมัติและเก็บเข้าคลังแล้ว' : 'เก็บเข้าคลังแล้ว');
      salon.finish(status === 'approved' ? 'อนุมัติ + ขึ้นตู้โชว์แล้ว' : 'เก็บเข้าคลังแล้ว (ร่าง)');
    } catch (e: any) {
      setErr(e.message);
      salon.fail(e.message);
    }
  }

  async function patchPost(id: string, data: Partial<Pick<StudioPost, 'body' | 'status'>>, note: string) {
    try {
      const { post } = await api<{ post: StudioPost }>('/api/content-studio/posts', 'PATCH', { id, ...data });
      setPosts((ps) => ps.map((p) => (p.id === id ? post : p)));
      setEditPost(null);
      flash(note);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function deletePost(id: string) {
    if (confirmDel !== id) {
      setConfirmDel(id);
      flash('กด "ลบ" อีกครั้งเพื่อยืนยัน');
      setTimeout(() => setConfirmDel(null), 3000);
      return;
    }
    try {
      await api('/api/content-studio/posts', 'DELETE', { id });
      setPosts((ps) => ps.filter((p) => p.id !== id));
      flash('ลบแล้ว');
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const libList = clientPosts.filter((p) => (libFmt === 'all' || p.format === libFmt) && (libStatus === 'all' || p.status === libStatus));
  const libFormats = STUDIO_FORMATS.filter((f) => clientPosts.some((p) => p.format === f.id));
  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-2 font-semibold border-b-2 whitespace-nowrap ${tab === id ? 'border-[var(--accent-terracotta)] text-[var(--text-main)]' : 'border-transparent text-[var(--text-muted)]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] items-start">
      <aside className="card p-3 flex flex-col gap-1">
        <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] px-2 py-1">ลูกค้า</div>
        {clients.map((c) => {
          const n = posts.filter((p) => p.client_id === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className={`text-left rounded-lg px-3 py-2 flex justify-between gap-2 ${c.id === sel && tab !== 'form' ? 'bg-[var(--accent-terracotta-tint)] font-semibold' : 'hover:bg-gray-50'}`}
            >
              <span className="truncate min-w-0">{c.name}</span>
              {n ? <span className="text-xs text-[var(--text-muted)]">{n}</span> : null}
            </button>
          );
        })}
        {!clients.length && <p className="text-sm text-[var(--text-muted)] px-2">ยังไม่มีลูกค้า</p>}
        <button type="button" className="btn-primary mt-2" onClick={() => openForm(null)}>
          + เพิ่มลูกค้าใหม่
        </button>
      </aside>

      <section className="min-w-0 flex flex-col gap-4">
        {msg && <div className="card p-3 text-sm bg-[var(--accent-terracotta-tint)]">{msg}</div>}
        {err && <div className="card p-3 text-sm border-red-300 text-red-700">{err}</div>}

        {tab === 'form' ? (
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold">{editingCard ? 'แก้ Brand Card' : 'เพิ่มลูกค้าใหม่'}</h2>
                <p className="text-sm text-[var(--text-muted)]">ข้อมูลชุดนี้คือ &quot;สมอง&quot; ของลูกค้ารายนี้ ทุกคอนเทนต์จะอ้างอิงจากที่นี่</p>
              </div>
              {clients.length > 0 && (
                <button type="button" className="btn-secondary" onClick={() => setTab(editingCard ? 'card' : 'create')}>
                  ยกเลิก
                </button>
              )}
            </div>
            {!editingCard && (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-gray-50 p-4 flex flex-col gap-2">
                <label htmlFor="cs-raw" className="font-semibold text-sm">
                  ทางลัด: วางข้อมูลลูกค้าดิบๆ แล้วให้ AI กรอกให้
                </label>
                <textarea id="cs-raw" rows={4} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="ข้อความจากแชทลูกค้า, About ของเพจ, โพสต์เก่า, ข้อมูลสินค้า…" />
                <div>
                  <button type="button" className="btn-secondary" disabled={busy === 'autofill'} onClick={autofill}>
                    {busy === 'autofill' ? 'กำลังอ่าน…' : '✦ ให้ AI กรอกให้'}
                  </button>
                </div>
              </div>
            )}
            <ContentStudioSalon run={salon.run} info={salonInfo} />
            <div className="grid gap-3 sm:grid-cols-2">
              {STUDIO_FIELDS.map((f) => (
                <label key={f.key} htmlFor={`cs-${f.key}`} className={`flex flex-col gap-1 text-sm font-semibold ${f.big ? 'sm:col-span-2' : ''}`}>
                  {f.label}
                  {f.big ? (
                    <textarea id={`cs-${f.key}`} rows={f.key === 'examples' ? 6 : 3} placeholder={f.hint} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <input id={`cs-${f.key}`} placeholder={f.hint} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn-primary" disabled={busy === 'card'} onClick={saveCard}>
                {editingCard ? 'บันทึก Brand Card' : 'บันทึกและเริ่มทำคอนเทนต์'}
              </button>
              {editingCard && (
                <button type="button" className="btn-secondary text-red-700" onClick={() => deleteClient(editingCard)}>
                  ลบลูกค้ารายนี้
                </button>
              )}
            </div>
          </div>
        ) : !client ? (
          <div className="card p-8 text-center text-[var(--text-muted)]">เลือกลูกค้าทางซ้าย หรือเพิ่มลูกค้าใหม่</div>
        ) : (
          <>
            <div className="card p-5">
              <div className="flex justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">{client.name}</h2>
                  {client.positioning ? (
                    <p className="text-sm mt-1">
                      <span className="text-[var(--text-muted)]">จุดยืน:</span> {client.positioning.split('\n')[0]}
                    </p>
                  ) : (
                    <p className="text-sm mt-1 text-amber-700">ยังไม่มีจุดยืนคอนเทนต์ — เติมใน Brand Card เพื่อให้ทุกชิ้นไปทางเดียวกัน</p>
                  )}
                </div>
                <button type="button" className="btn-secondary" onClick={() => openForm(client)}>
                  แก้ Brand Card
                </button>
              </div>
              <div className="flex gap-1 border-b border-[var(--border)] mt-4 overflow-x-auto">
                {tabBtn('create', 'สร้างคอนเทนต์')}
                {tabBtn('lib', `คลัง (${clientPosts.length})`)}
                {tabBtn('card', 'Brand Card')}
              </div>
            </div>

            {tab === 'create' && (
              <div className="card p-5 flex flex-col gap-4">
                <h3 className="font-bold">1. เลือกรูปแบบ</h3>
                {(Object.keys(STUDIO_FORMAT_GROUPS) as StudioFormat['group'][]).map((g) => (
                  <div key={g}>
                    <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1">{STUDIO_FORMAT_GROUPS[g]}</div>
                    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                      {STUDIO_FORMATS.filter((f) => f.group === g).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={fmt === f.id}
                          onClick={() => setFmt(f.id)}
                          className={`text-left rounded-lg border p-2.5 ${fmt === f.id ? 'border-[var(--accent-terracotta)] bg-[var(--accent-terracotta-tint)]' : 'border-[var(--border)] bg-white'}`}
                        >
                          <div className="font-semibold text-sm">{f.name}</div>
                          <div className="text-xs text-[var(--text-muted)] leading-snug">{f.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <h3 className="font-bold">2. ขั้น Funnel</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {STUDIO_FUNNEL.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={funnel === f.id}
                      onClick={() => setFunnel(f.id)}
                      className={`text-left rounded-lg border p-2.5 ${funnel === f.id ? 'border-[var(--accent-terracotta)] bg-[var(--accent-terracotta-tint)]' : 'border-[var(--border)] bg-white'}`}
                    >
                      <div className="font-semibold text-sm">{f.name}</div>
                      <div className="text-xs text-[var(--text-muted)] leading-snug">{f.desc}</div>
                    </button>
                  ))}
                </div>

                <h3 className="font-bold">3. หัวข้อวันนี้</h3>
                <div className="flex gap-3 flex-wrap items-end">
                  <label htmlFor="cs-topic" className="flex flex-col gap-1 text-sm font-semibold flex-[1_1_260px] min-w-0">
                    หัวข้อ (เว้นว่างได้ AI เลือกจากแกนคอนเทนต์)
                    <textarea id="cs-topic" rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="เช่น โปรต้นเดือน, สินค้าใหม่เข้าร้าน, ตอบคนที่ถามว่าแพงไป…" />
                  </label>
                  {!fmtObj?.single && (
                    <label htmlFor="cs-count" className="flex flex-col gap-1 text-sm font-semibold w-28">
                      จำนวน
                      <select id="cs-count" value={count} onChange={(e) => setCount(+e.target.value)}>
                        {[1, 3, 5].map((n) => (
                          <option key={n} value={n}>
                            {n} ชิ้น
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button type="button" className="btn-primary" disabled={busy === 'gen'} onClick={generate}>
                    {busy === 'gen' ? 'กำลังเขียน…' : '✦ สร้างคอนเทนต์'}
                  </button>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  {approvedSame
                    ? `ใช้งานที่อนุมัติแล้ว ${Math.min(approvedSame, 3)} ชิ้นในรูปแบบนี้เป็นตัวอย่างสไตล์`
                    : 'ทิป: กด "อนุมัติ" ชิ้นที่ชอบ ระบบจะใช้เป็นตัวอย่างสไตล์ของลูกค้ารายนี้ในครั้งต่อไป'}
                </p>

                <ContentStudioSalon run={salon.run} info={salonInfo} onShowResults={drafts.length ? showResults : undefined} />

                {drafts.length > 0 && (
                  <div ref={resultsRef} className="flex flex-col gap-3 scroll-mt-4">
                    <h3 className="font-bold">ผลลัพธ์</h3>
                    {drafts.map((d, i) => (
                      <article key={i} className="rounded-xl border border-[var(--border)] bg-white p-4 flex flex-col gap-3">
                        <div className="flex gap-2 flex-wrap text-xs">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5">{FMT[d.format]}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5">{FUNNEL[d.funnel]}</span>
                          {d.saved && <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5">เก็บเข้าคลังแล้ว</span>}
                        </div>
                        <h4 className="font-semibold">{d.title}</h4>
                        <Retention r={d.retention} />
                        <textarea rows={STUDIO_FORMATS.find((x) => x.id === d.format)?.single ? 22 : 10} aria-label="แก้ข้อความ" value={d.body} onChange={(e) => setDrafts((ds) => ds.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                        <div className="flex gap-2 flex-wrap">
                          <button type="button" className="btn-secondary" onClick={() => copy(d.body)}>
                            คัดลอก
                          </button>
                          <button type="button" className="btn-secondary" disabled={d.saved} onClick={() => saveDraft(i, 'draft')}>
                            เก็บเข้าคลัง
                          </button>
                          <button type="button" className="btn-primary" disabled={d.saved} onClick={() => saveDraft(i, 'approved')}>
                            อนุมัติ + เก็บ
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'lib' && (
              <div className="card p-5 flex flex-col gap-3">
                <div className="flex gap-2 flex-wrap">
                  {[{ id: 'all', name: 'ทุกรูปแบบ' }, ...libFormats].map((f) => (
                    <button key={f.id} type="button" onClick={() => setLibFmt(f.id)} className={`rounded-full border px-3 py-1 text-sm ${libFmt === f.id ? 'bg-[var(--text-main)] text-white border-[var(--text-main)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                      {f.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(['all', 'draft', 'approved', 'used'] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setLibStatus(s)} className={`rounded-full border px-3 py-1 text-sm ${libStatus === s ? 'bg-[var(--text-main)] text-white border-[var(--text-main)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                      {s === 'all' ? `ทุกสถานะ (${clientPosts.length})` : `${STATUS_LABEL[s]} (${clientPosts.filter((p) => p.status === s).length})`}
                    </button>
                  ))}
                </div>
                {!clientPosts.length && <p className="text-[var(--text-muted)] py-6 text-center">คลังของลูกค้ารายนี้ยังว่าง — สร้างคอนเทนต์แล้วกด &quot;เก็บเข้าคลัง&quot;</p>}
                {clientPosts.length > 0 && !libList.length && <p className="text-sm text-[var(--text-muted)]">ไม่มีชิ้นที่ตรงกับตัวกรองนี้</p>}
                {libList.map((p) => (
                  <article key={p.id} className="rounded-xl border border-[var(--border)] bg-white p-4 flex flex-col gap-2">
                    <div className="flex gap-2 flex-wrap items-center text-xs text-[var(--text-muted)]">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{FMT[p.format] ?? p.format}</span>
                      {p.funnel && <span className="rounded-full bg-gray-100 px-2 py-0.5">{FUNNEL[p.funnel]}</span>}
                      <span>{new Date(p.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                      {p.topic && <span className="truncate max-w-[16rem]">· {p.topic}</span>}
                    </div>
                    <h4 className="font-semibold">{p.title}</h4>
                    <Retention r={p.retention} />
                    {editPost?.id === p.id ? (
                      <textarea rows={10} aria-label="แก้ข้อความ" value={editPost.body} onChange={(e) => setEditPost({ id: p.id, body: e.target.value })} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{p.body}</div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" className="btn-secondary" onClick={() => copy(p.body)}>
                        คัดลอก
                      </button>
                      {editPost?.id === p.id ? (
                        <>
                          <button type="button" className="btn-primary" onClick={() => patchPost(p.id, { body: editPost.body }, 'บันทึกแล้ว')}>
                            บันทึก
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => setEditPost(null)}>
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn-secondary" onClick={() => setEditPost({ id: p.id, body: p.body })}>
                            แก้
                          </button>
                          {p.status === 'draft' && (
                            <button type="button" className="btn-secondary" onClick={() => patchPost(p.id, { status: 'approved' }, 'อนุมัติแล้ว')}>
                              อนุมัติ
                            </button>
                          )}
                          {p.status !== 'used' && (
                            <button type="button" className="btn-secondary" onClick={() => patchPost(p.id, { status: 'used' }, 'ทำเครื่องหมายว่าโพสต์แล้ว')}>
                              โพสต์แล้ว
                            </button>
                          )}
                          <button type="button" className="btn-secondary text-red-700" onClick={() => deletePost(p.id)}>
                            ลบ
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {tab === 'card' && (
              <div className="card p-5">
                <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                  {STUDIO_FIELDS.filter((f) => f.key !== 'name').map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="text-sm text-[var(--text-muted)]">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words mb-2 sm:mb-0">{((client as any)[f.key] as string) || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-[var(--text-muted)] mt-4">
                  อัปเดตล่าสุด {new Date(client.updated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} · ช่องโปร/ราคาควรอัปเดตทุกครั้งที่ลูกค้าเปลี่ยนโปร
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
