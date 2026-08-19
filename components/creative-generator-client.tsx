'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Idea, Script, Storyboard, StoryboardScene } from '@/types/database';

interface Props {
  products: { id: string; product_name: string; brand: string }[];
  personas: { id: string; name: string }[];
}

const FUNNEL_OPTIONS = ['Awareness', 'Consideration', 'Conversion', 'Retention'];
const PLATFORM_OPTIONS = ['TikTok', 'Facebook Reels', 'Instagram Reels', 'Marketplace'];
const IDEA_QTY_PRESETS = [5, 10, 20];
const SCRIPT_QTY_PRESETS = [1, 3, 5];

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreativeGeneratorClient({ products, personas }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

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
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [ideaError, setIdeaError] = useState('');

  // Step 2 state
  const [scriptQty, setScriptQty] = useState(1);
  const [scriptQtyCustom, setScriptQtyCustom] = useState('');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [scriptError, setScriptError] = useState('');

  // Step 3 state
  const [sceneCount, setSceneCount] = useState(6);
  const [durationTarget, setDurationTarget] = useState(30);
  const [videoStyle, setVideoStyle] = useState('UGC สมจริง มือถือ');
  const [aiFootageMix, setAiFootageMix] = useState('40% AI Generated / 60% Real Footage');
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [loadingStoryboards, setLoadingStoryboards] = useState(false);
  const [storyboardError, setStoryboardError] = useState('');

  const effectiveIdeaQty = ideaQtyCustom ? parseInt(ideaQtyCustom, 10) || 0 : ideaQty;
  const effectiveScriptQty = scriptQtyCustom ? parseInt(scriptQtyCustom, 10) || 0 : scriptQty;

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
          funnel: funnel || undefined,
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
          <div
            key={label}
            className={`px-3 py-1.5 rounded-full border ${step === i + 1 ? 'bg-navy text-white border-navy' : 'border-border text-gray-500'}`}
          >
            {label}
          </div>
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

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {scripts.map((s) => (
              <div key={s.id} className="card p-4 flex gap-3 items-start">
                <label className="flex gap-3 items-start cursor-pointer flex-1">
                  <input type="checkbox" checked={selectedScriptIds.has(s.id)} onChange={() => toggleScript(s.id)} className="mt-1" />
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{s.title}</span>
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
            ))}
          </div>

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
              <input value={videoStyle} onChange={(e) => setVideoStyle(e.target.value)} />
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
