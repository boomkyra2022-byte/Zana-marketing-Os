'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Idea, Script, Storyboard, StoryboardScene } from '@/types/database';

interface Props {
  products: { id: string; product_name: string; brand: string }[];
  personas: { id: string; name: string }[];
  // History/reuse — explicit user request: "ที่ Gen ไปแล้วยังขาด History หรือเปล่า
  // สำหรับย้อนดูงานได้ หรือเลือกนำกลับมาใช้อีกครั้ง". Recent-20 lists fetched
  // server-side (app/(dashboard)/creative-generator/page.tsx); a full
  // searchable archive is the separate /content-library page.
  recentIdeas?: Idea[];
  recentScripts?: Script[];
  recentStoryboards?: Storyboard[];
  // Deep-link reuse from /content-library ("ใช้ต่อ" there → ?load_idea=/?load_script=)
  initialIdea?: Idea | null;
  initialScript?: Script | null;
}

const FUNNEL_OPTIONS = ['Awareness', 'Consideration', 'Conversion', 'Retention', 'ZANA Framework'];
const ZANA_FRAMEWORK_VALUE = 'ZANA Framework';
const PLATFORM_OPTIONS = ['TikTok', 'Facebook Reels', 'Instagram Reels', 'Marketplace'];
const IDEA_QTY_PRESETS = [5, 10, 20];
const SCRIPT_QTY_PRESETS = [1, 3, 5];

// Video Style presets — explicit user request: "อยากให้ใช้เป็น Dropdown
// ตัวเลือก...ให้เยอะหลากหลาย" (was a free-text input). Covers the common
// short-form content styles for Thai social commerce, plus a custom option
// since no fixed list covers everything a team might want to try.
const VIDEO_STYLE_CUSTOM = '__custom__';
const VIDEO_STYLE_OPTIONS = [
  'UGC สมจริง มือถือ',
  'UGC รีวิวพูดคุยหน้ากล้อง (Talking-head)',
  'Founder Story เจ้าของแบรนด์เล่าเอง',
  'Unboxing เปิดกล่อง',
  'Before/After เปรียบเทียบก่อน-หลัง',
  'Tutorial สอนใช้งานทีละขั้นตอน',
  'Product Demo โชว์สินค้าเน้นๆ',
  'Testimonial ลูกค้าพูดถึงสินค้า',
  'Storytelling เล่าเรื่องมีปมดราม่า',
  'Day in the Life วันธรรมดาของลูกค้า',
  'Vlog ไลฟ์สไตล์ประจำวัน',
  'Comedy / Skit ตลกขบขัน',
  'Interview สัมภาษณ์พูดคุย',
  'ASMR เสียงกระตุ้นความรู้สึก',
  'Stop Motion แอนิเมชันขยับทีละเฟรม',
  'Split Screen แบ่งจอเปรียบเทียบ',
  'Meme / Text-on-screen นำเรื่อง',
  'Cinematic เนี้ยบมืออาชีพ'
];

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreativeGeneratorClient({
  products,
  personas,
  recentIdeas = [],
  recentScripts = [],
  recentStoryboards = [],
  initialIdea = null,
  initialScript = null
}: Props) {
  // Jump straight to the relevant step when arriving via a "ใช้ต่อ" deep
  // link from /content-library, otherwise start at Step 1 as normal.
  const [step, setStep] = useState<1 | 2 | 3>(initialScript ? 2 : 1);

  // Step 1 state
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [personaId, setPersonaId] = useState('');
  const [funnel, setFunnel] = useState('');
  const [objective, setObjective] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [contentStyle, setContentStyle] = useState('');
  const [promotion, setPromotion] = useState('');
  const [brief, setBrief] = useState('');
  const [ideaQty, setIdeaQty] = useState(10);
  const [ideaQtyCustom, setIdeaQtyCustom] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>(initialIdea ? [initialIdea] : []);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set(initialIdea ? [initialIdea.id] : []));
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideaError, setIdeaError] = useState('');
  const [showIdeaHistory, setShowIdeaHistory] = useState(false);

  // Step 2 state
  const [scriptQty, setScriptQty] = useState(1);
  const [scriptQtyCustom, setScriptQtyCustom] = useState('');
  const [scripts, setScripts] = useState<Script[]>(initialScript ? [initialScript] : []);
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set(initialScript ? [initialScript.id] : []));
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [scriptError, setScriptError] = useState('');
  const [showScriptHistory, setShowScriptHistory] = useState(false);

  // Step 3 state
  const [sceneCount, setSceneCount] = useState(6);
  const [durationTarget, setDurationTarget] = useState(30);
  const [videoStyle, setVideoStyle] = useState(VIDEO_STYLE_OPTIONS[0]);
  const [customVideoStyle, setCustomVideoStyle] = useState(false);
  const [aiFootageMix, setAiFootageMix] = useState('40% AI Generated / 60% Real Footage');
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [loadingStoryboards, setLoadingStoryboards] = useState(false);
  const [storyboardError, setStoryboardError] = useState('');
  const [showStoryboardHistory, setShowStoryboardHistory] = useState(false);

  function productLabel(productId: string | null | undefined) {
    const p = products.find((pr) => pr.id === productId);
    return p ? `${p.brand} — ${p.product_name}` : null;
  }

  function applyIdeaFromHistory(idea: Idea) {
    setIdeas((prev) => (prev.some((i) => i.id === idea.id) ? prev : [idea, ...prev]));
    setSelectedIdeaIds((prev) => new Set(prev).add(idea.id));
  }

  function applyScriptFromHistory(s: Script) {
    setScripts((prev) => (prev.some((x) => x.id === s.id) ? prev : [s, ...prev]));
    setSelectedScriptIds((prev) => new Set(prev).add(s.id));
    setStep(2);
  }

  function applyStoryboardFromHistory(sb: Storyboard) {
    setStoryboards((prev) => (prev.some((x) => x.id === sb.id) ? prev : [sb, ...prev]));
    setStep(3);
  }

  const effectiveIdeaQty = ideaQtyCustom ? parseInt(ideaQtyCustom, 10) || 0 : ideaQty;
  const effectiveScriptQty = scriptQtyCustom ? parseInt(scriptQtyCustom, 10) || 0 : scriptQty;

  const isZanaFramework = funnel === ZANA_FRAMEWORK_VALUE;

  async function handleGenerateIdeas() {
    setIdeaError('');
    setLoadingIdeas(true);
    try {
      const res = await fetch('/api/creative/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          persona_id: personaId || null,
          quantity: effectiveIdeaQty,
          // ZANA Framework is a copywriting structure, not a funnel stage —
          // send it via `framework`, not `funnel` (AI still infers the real
          // funnel stage per idea; see prompts/idea-generator.ts).
          funnel: isZanaFramework ? undefined : funnel || undefined,
          framework: isZanaFramework ? 'ZANA' : undefined,
          objective: objective || undefined,
          platform: platform || undefined,
          content_style: contentStyle || undefined,
          promotion: promotion || undefined,
          brief: brief || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generate ideas failed');
      setIdeas(json.ideas as Idea[]);
      setSelectedIdeaIds(new Set((json.ideas as Idea[]).map((i) => i.id)));
    } catch (err: any) {
      setIdeaError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoadingIdeas(false);
    }
  }

  async function handleGenerateScripts() {
    setScriptError('');
    setLoadingScripts(true);
    try {
      const res = await fetch('/api/creative/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea_ids: Array.from(selectedIdeaIds),
          quantity_per_idea: effectiveScriptQty
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generate scripts failed');
      setScripts(json.scripts as Script[]);
      setSelectedScriptIds(new Set((json.scripts as Script[]).map((s) => s.id)));
      setStep(2);
    } catch (err: any) {
      setScriptError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoadingScripts(false);
    }
  }

  async function handleGenerateStoryboards() {
    setStoryboardError('');
    setLoadingStoryboards(true);
    try {
      const res = await fetch('/api/creative/storyboards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_ids: Array.from(selectedScriptIds),
          scene_count: sceneCount,
          duration_target_sec: durationTarget,
          video_style: videoStyle,
          ai_footage_mix: aiFootageMix
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generate storyboards failed');
      setStoryboards(json.storyboards as Storyboard[]);
      setStep(3);
    } catch (err: any) {
      setStoryboardError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoadingStoryboards(false);
    }
  }

  function toggleIdea(id: string) {
    setSelectedIdeaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleScript(id: string) {
    setSelectedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportText(): string {
    let out = '';
    storyboards.forEach((sb, i) => {
      out += `=== Storyboard ${i + 1}: ${sb.title ?? '(no title)'} (${sb.total_duration_sec}s, ${sb.scene_count} scenes) ===\n`;
      out += `Tone/Mood: ${sb.tone_mood ?? '-'}\nKey Message: ${sb.key_message ?? '-'}\n\n`;
      (sb.scenes as StoryboardScene[]).forEach((sc) => {
        out += `Scene ${sc.scene_number} [${sc.time_range}]\n`;
        out += `  Objective: ${sc.scene_objective ?? '-'}\n`;
        out += `  Visual: ${sc.visual_description}\n`;
        out += `  Source: ${sc.source_type}\n`;
        out += `  Camera: ${sc.camera_shot ?? '-'} / ${sc.camera_movement ?? '-'}\n`;
        out += `  VO: ${sc.voice_over ?? '-'}\n`;
        out += `  On-screen text: ${sc.on_screen_text ?? '-'}\n`;
        out += `  Sound: ${sc.sound_cue ?? '-'} | Music: ${sc.music_cue ?? '-'}\n`;
        out += `  Product placement: ${sc.product_placement ?? '-'}\n`;
        out += `  Editing note: ${sc.editing_note ?? '-'}\n`;
        if (sc.ai_video_prompt) out += `  AI video prompt: ${sc.ai_video_prompt}\n`;
        out += '\n';
      });
      out += '\n';
    });
    return out;
  }

  function exportMarkdown(): string {
    let out = '';
    storyboards.forEach((sb, i) => {
      out += `## Storyboard ${i + 1}: ${sb.title ?? '(no title)'}\n\n`;
      out += `**Duration:** ${sb.total_duration_sec}s | **Scenes:** ${sb.scene_count} | **Tone:** ${sb.tone_mood ?? '-'}\n\n`;
      out += `**Key Message:** ${sb.key_message ?? '-'}\n\n`;
      out += `| Scene | Time | Visual | Source | Camera | VO | Text | Sound | Edit |\n`;
      out += `|---|---|---|---|---|---|---|---|---|\n`;
      (sb.scenes as StoryboardScene[]).forEach((sc) => {
        out += `| ${sc.scene_number} | ${sc.time_range} | ${sc.visual_description} | ${sc.source_type} | ${sc.camera_shot ?? '-'}${sc.camera_movement ? ` / ${sc.camera_movement}` : ''} | ${sc.voice_over ?? '-'} | ${sc.on_screen_text ?? '-'} | ${sc.sound_cue ?? '-'} | ${sc.editing_note ?? '-'} |\n`;
      });
      out += '\n';
    });
    return out;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm">
        {(['1. Idea', '2. Script', '3. Storyboard'] as const).map((label, i) => (
          <button
            key={label}
            type="button"
            // Free navigation between steps — needed so history/reuse in Step
            // 2/3 is reachable even before anything's been generated this
            // session, not just as a "next" progression.
            onClick={() => setStep((i + 1) as 1 | 2 | 3)}
            className={`px-3 py-1.5 rounded-full border ${step === i + 1 ? 'bg-navy text-white border-navy' : 'border-border text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Step 1 — สร้าง Idea</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">สินค้า *</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.length === 0 && <option value="">— ยังไม่มีสินค้า —</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand} — {p.product_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Persona (ไม่บังคับ)</label>
              <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Funnel Stage</label>
              <select value={funnel} onChange={(e) => setFunnel(e.target.value)}>
                <option value="">— ผสมทุกขั้น —</option>
                {FUNNEL_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              {isZanaFramework && (
                <div
                  className="mt-2 text-xs rounded-lg p-3 space-y-1.5"
                  style={{ background: 'var(--accent-strategy-tint)', color: 'var(--text-main)', border: '1px solid var(--accent-strategy)' }}
                >
                  <div className="font-semibold" style={{ color: 'var(--accent-strategy)' }}>
                    ZANA Framework — Hook → Problem → Agitate → Bridge → Solution → Proof → CTA
                  </div>
                  <div className="text-gray-600">สูตรสำหรับคอนเทนต์ที่เริ่มจาก Pain/สถานการณ์จริง ก่อนพาสินค้าเข้ามาแก้ปัญหาอย่างเป็นธรรมชาติ</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-500 pt-1">
                    <div>Hook — หยุดนิ้ว</div>
                    <div>Bridge — เชื่อมเข้าหาสินค้า</div>
                    <div>Problem — ลูกค้าเจออะไร</div>
                    <div>Solution — สินค้าช่วยอะไร</div>
                    <div>Agitate — ทำให้เห็นภาพ Pain</div>
                    <div>Proof — ทำไมควรเชื่อ</div>
                    <div>CTA — ต้องการให้คนทำอะไรต่อ</div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="field-label">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Objective</label>
              <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="เช่น เพิ่มยอดขายโปรโมชั่นใหม่" />
            </div>
            <div>
              <label className="field-label">Content Style</label>
              <input value={contentStyle} onChange={(e) => setContentStyle(e.target.value)} placeholder="เช่น UGC, Founder Story, Comedy" />
            </div>
            <div>
              <label className="field-label">Promotion / Offer</label>
              <input value={promotion} onChange={(e) => setPromotion(e.target.value)} placeholder="เช่น ลด 20% วันนี้เท่านั้น" />
            </div>
            <div>
              <label className="field-label">จำนวน Idea</label>
              <div className="flex gap-2 items-center flex-wrap">
                {IDEA_QTY_PRESETS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setIdeaQty(q);
                      setIdeaQtyCustom('');
                    }}
                    className={ideaQty === q && !ideaQtyCustom ? 'btn-primary' : 'btn-secondary'}
                  >
                    {q}
                  </button>
                ))}
                <input
                  className="!w-24"
                  placeholder="กำหนดเอง"
                  value={ideaQtyCustom}
                  onChange={(e) => setIdeaQtyCustom(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="field-label">Brief เพิ่มเติม (ไม่บังคับ)</label>
            <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="รายละเอียดเพิ่มเติมที่อยากให้ AI รู้..." />
          </div>

          {ideaError && <div className="text-red-600 text-sm">{ideaError}</div>}

          <button className="btn-primary" disabled={!productId || effectiveIdeaQty < 1 || loadingIdeas} onClick={handleGenerateIdeas}>
            {loadingIdeas ? 'กำลังสร้าง Idea...' : `สร้าง ${effectiveIdeaQty || ''} Idea`}
          </button>

          {recentIdeas.length > 0 && (
            <div className="border-t border-border pt-3">
              <button type="button" className="text-sm font-semibold text-gray-600 flex items-center gap-1" onClick={() => setShowIdeaHistory((v) => !v)}>
                {showIdeaHistory ? '▾' : '▸'} ประวัติ Idea ล่าสุด ({recentIdeas.length})
              </button>
              {showIdeaHistory && (
                <div className="mt-2 space-y-2 max-h-[360px] overflow-y-auto">
                  {recentIdeas.map((idea) => (
                    <div key={idea.id} className="card p-3 flex gap-3 items-start bg-surface">
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{idea.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-border">{idea.funnel_stage}</span>
                          {idea.framework === 'ZANA' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}>
                              ZANA Framework
                            </span>
                          )}
                          {productLabel(idea.product_id) && <span className="text-xs text-gray-400">{productLabel(idea.product_id)}</span>}
                        </div>
                        <div className="text-gray-600 mt-1">Hook: {idea.hook}</div>
                        <div className="text-gray-400 text-xs mt-1">{new Date(idea.created_at).toLocaleString('th-TH')}</div>
                      </div>
                      <button type="button" className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap" onClick={() => applyIdeaFromHistory(idea)}>
                        ↩ ใช้ต่อ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {ideas.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">ผลลัพธ์ ({ideas.length}) — เลือก idea ที่จะทำ Script ต่อ</h3>
                <span className="text-sm text-gray-500">{selectedIdeaIds.size} เลือกอยู่</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {ideas.map((idea) => (
                  <div key={idea.id} className="card p-3 flex gap-3 items-start">
                    <label className="flex gap-3 items-start cursor-pointer flex-1">
                      <input type="checkbox" checked={selectedIdeaIds.has(idea.id)} onChange={() => toggleIdea(idea.id)} className="mt-1" />
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{idea.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border">{idea.funnel_stage}</span>
                          {idea.framework === 'ZANA' && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}
                            >
                              ZANA Framework
                            </span>
                          )}
                          <span className="text-xs text-accentGreen font-semibold">score {idea.potential_score}/10</span>
                        </div>
                        <div className="text-gray-600 mt-1">Hook: {idea.hook}</div>
                        {idea.angle && <div className="text-gray-400 text-xs mt-1">Angle: {idea.angle}</div>}
                      </div>
                    </label>
                    <Link href={`/flow-prompt?source=IDEA&source_id=${idea.id}`} className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap">
                      🎬 Flow Prompt
                    </Link>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 items-center pt-2">
                <label className="field-label m-0">Script ต่อ 1 idea</label>
                {SCRIPT_QTY_PRESETS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setScriptQty(q);
                      setScriptQtyCustom('');
                    }}
                    className={scriptQty === q && !scriptQtyCustom ? 'btn-primary' : 'btn-secondary'}
                  >
                    {q}
                  </button>
                ))}
                <input className="!w-24" placeholder="กำหนดเอง" value={scriptQtyCustom} onChange={(e) => setScriptQtyCustom(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              {scriptError && <div className="text-red-600 text-sm">{scriptError}</div>}
              <button className="btn-primary" disabled={selectedIdeaIds.size === 0 || loadingScripts} onClick={handleGenerateScripts}>
                {loadingScripts ? 'กำลังสร้าง Script...' : `สร้าง Script จาก ${selectedIdeaIds.size} idea`}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 2 — Script ({scripts.length})</h2>
            <button className="btn-secondary" onClick={() => setStep(1)}>← กลับไป Idea</button>
          </div>

          {scripts.length === 0 && (
            <div className="card p-6 text-center text-gray-500 text-sm">ยังไม่มี Script ที่สร้างในเซสชันนี้ — เลือกจากประวัติด้านล่าง หรือกลับไป Step 1 เพื่อสร้างใหม่</div>
          )}

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {scripts.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex gap-3 items-start">
                  <label className="flex gap-3 items-start cursor-pointer flex-1">
                    <input type="checkbox" checked={selectedScriptIds.has(s.id)} onChange={() => toggleScript(s.id)} className="mt-1" />
                    <div className="flex-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{s.title}</span>
                        {s.framework === 'ZANA' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}
                          >
                            ZANA Framework
                          </span>
                        )}
                        <span className="text-xs text-accentGreen font-semibold">score {s.score}/100</span>
                        <span className="text-xs text-gray-400">~{s.estimated_duration_sec}s</span>
                      </div>
                      <div className="text-gray-600 mt-2 whitespace-pre-wrap">{s.full_script}</div>
                      {s.risks && <div className="text-red-500 text-xs mt-2">⚠ {s.risks}</div>}
                    </div>
                  </label>
                  <Link href={`/flow-prompt?source=SCRIPT&source_id=${s.id}`} className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap">
                    🎬 Flow Prompt
                  </Link>
                </div>
                {s.caption && (
                  <details className="mt-3 rounded-lg border border-border bg-surface">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600">CAPTION</summary>
                    <div className="px-3 pb-3 space-y-2">
                      <div className="text-sm whitespace-pre-wrap">{s.caption}</div>
                      {s.hashtags && s.hashtags.length > 0 && (
                        <div className="text-xs text-accentBlue">{s.hashtags.map((h) => `#${h}`).join(' ')}</div>
                      )}
                      <button
                        type="button"
                        className="btn-secondary !px-2 !py-1 !text-xs"
                        onClick={() => {
                          const text = s.hashtags && s.hashtags.length > 0 ? `${s.caption}\n\n${s.hashtags.map((h) => `#${h}`).join(' ')}` : s.caption || '';
                          navigator.clipboard.writeText(text);
                        }}
                      >
                        📋 Copy Caption
                      </button>
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          {recentScripts.length > 0 && (
            <div className="border-t border-border pt-3">
              <button type="button" className="text-sm font-semibold text-gray-600 flex items-center gap-1" onClick={() => setShowScriptHistory((v) => !v)}>
                {showScriptHistory ? '▾' : '▸'} ประวัติ Script ล่าสุด ({recentScripts.length})
              </button>
              {showScriptHistory && (
                <div className="mt-2 space-y-2 max-h-[360px] overflow-y-auto">
                  {recentScripts.map((s) => (
                    <div key={s.id} className="card p-3 flex gap-3 items-start bg-surface">
                      <div className="flex-1 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{s.title}</span>
                          {s.framework === 'ZANA' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-strategy-tint)', color: 'var(--accent-strategy)' }}>
                              ZANA Framework
                            </span>
                          )}
                          <span className="text-xs text-accentGreen font-semibold">score {s.score}/100</span>
                        </div>
                        <div className="text-gray-600 mt-1 line-clamp-2">{s.full_script}</div>
                        <div className="text-gray-400 text-xs mt-1">{new Date(s.created_at).toLocaleString('th-TH')}</div>
                      </div>
                      <button type="button" className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap" onClick={() => applyScriptFromHistory(s)}>
                        ↩ ใช้ต่อ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <label className="field-label">จำนวน Scene ต่อคลิป</label>
              <input type="number" min={3} max={30} value={sceneCount} onChange={(e) => setSceneCount(parseInt(e.target.value, 10) || 6)} />
            </div>
            <div>
              <label className="field-label">ความยาวเป้าหมาย (วินาที)</label>
              <input type="number" min={5} max={300} value={durationTarget} onChange={(e) => setDurationTarget(parseInt(e.target.value, 10) || 30)} />
            </div>
            <div>
              <label className="field-label">Video Style</label>
              {!customVideoStyle ? (
                <select
                  value={videoStyle}
                  onChange={(e) => {
                    if (e.target.value === VIDEO_STYLE_CUSTOM) {
                      setCustomVideoStyle(true);
                      setVideoStyle('');
                    } else {
                      setVideoStyle(e.target.value);
                    }
                  }}
                >
                  {VIDEO_STYLE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value={VIDEO_STYLE_CUSTOM}>— กำหนดเอง —</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input value={videoStyle} onChange={(e) => setVideoStyle(e.target.value)} placeholder="พิมพ์ Video Style เอง..." autoFocus />
                  <button
                    type="button"
                    className="btn-secondary !px-2 !text-xs whitespace-nowrap"
                    onClick={() => {
                      setCustomVideoStyle(false);
                      setVideoStyle(VIDEO_STYLE_OPTIONS[0]);
                    }}
                  >
                    ← เลือกจากรายการ
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="field-label">AI / Real Footage Mix</label>
              <input value={aiFootageMix} onChange={(e) => setAiFootageMix(e.target.value)} />
            </div>
          </div>

          {storyboardError && <div className="text-red-600 text-sm">{storyboardError}</div>}
          <button className="btn-primary" disabled={selectedScriptIds.size === 0 || loadingStoryboards} onClick={handleGenerateStoryboards}>
            {loadingStoryboards ? 'กำลังสร้าง Storyboard...' : `สร้าง Storyboard จาก ${selectedScriptIds.size} script`}
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 3 — Storyboard ({storyboards.length})</h2>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setStep(2)}>← กลับไป Script</button>
              <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(exportText())}>Copy All</button>
              <button className="btn-secondary" onClick={() => downloadFile('storyboards.txt', exportText(), 'text/plain')}>Export TXT</button>
              <button className="btn-secondary" onClick={() => downloadFile('storyboards.md', exportMarkdown(), 'text/markdown')}>Export Markdown</button>
            </div>
          </div>

          {recentStoryboards.length > 0 && (
            <div className="card p-4">
              <button type="button" className="text-sm font-semibold text-gray-600 flex items-center gap-1" onClick={() => setShowStoryboardHistory((v) => !v)}>
                {showStoryboardHistory ? '▾' : '▸'} ประวัติ Storyboard ล่าสุด ({recentStoryboards.length})
              </button>
              {showStoryboardHistory && (
                <div className="mt-2 space-y-2 max-h-[360px] overflow-y-auto">
                  {recentStoryboards.map((sb) => (
                    <div key={sb.id} className="card p-3 flex gap-3 items-start bg-surface">
                      <div className="flex-1 text-sm">
                        <span className="font-semibold">{sb.title ?? '(no title)'}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {sb.total_duration_sec}s · {sb.scene_count} scenes · {sb.tone_mood}
                        </span>
                        <div className="text-gray-400 text-xs mt-1">{new Date(sb.created_at).toLocaleString('th-TH')}</div>
                      </div>
                      <button type="button" className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap" onClick={() => applyStoryboardFromHistory(sb)}>
                        ↩ ใช้ต่อ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {storyboards.length === 0 && (
            <div className="card p-6 text-center text-gray-500 text-sm">ยังไม่มี Storyboard ที่สร้างในเซสชันนี้ — เลือกจากประวัติด้านบน หรือกลับไป Step 2 เพื่อสร้างใหม่</div>
          )}

          {storyboards.map((sb, i) => (
            <div key={sb.id} className="card p-4 overflow-x-auto">
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-semibold">
                    Storyboard {i + 1}: {sb.title}
                  </span>
                  <span className="text-gray-500 text-sm ml-2">
                    {sb.total_duration_sec}s · {sb.scene_count} scenes · {sb.tone_mood}
                  </span>
                </div>
                <Link href={`/flow-prompt?source=STORYBOARD&source_id=${sb.id}`} className="btn-secondary !px-2 !py-1 !text-xs whitespace-nowrap">
                  🎬 สร้าง Flow Prompt
                </Link>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-surface text-left text-gray-500">
                  <tr>
                    <th className="px-2 py-2">Scene</th>
                    <th className="px-2 py-2">Time</th>
                    <th className="px-2 py-2">Visual</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Camera</th>
                    <th className="px-2 py-2">VO</th>
                    <th className="px-2 py-2">Text</th>
                    <th className="px-2 py-2">Sound</th>
                    <th className="px-2 py-2">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {(sb.scenes as StoryboardScene[]).map((sc) => (
                    <tr key={sc.scene_number} className="border-t border-border align-top">
                      <td className="px-2 py-2">{sc.scene_number}</td>
                      <td className="px-2 py-2">{sc.time_range}</td>
                      <td className="px-2 py-2 max-w-xs">{sc.visual_description}</td>
                      <td className="px-2 py-2">{sc.source_type}</td>
                      <td className="px-2 py-2">
                        {sc.camera_shot}
                        {sc.camera_movement ? ` / ${sc.camera_movement}` : ''}
                      </td>
                      <td className="px-2 py-2 max-w-xs">{sc.voice_over}</td>
                      <td className="px-2 py-2">{sc.on_screen_text}</td>
                      <td className="px-2 py-2">{sc.sound_cue}</td>
                      <td className="px-2 py-2 max-w-xs">{sc.editing_note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
