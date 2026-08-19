'use client';

import { useState } from 'react';
import type { Idea, Script, Storyboard, StoryboardScene } from '@/types/database';
import type { FlowContentAnalysis, FlowContinuityBible, FlowPromptPart, FlowStoryFlowStep } from '@/prompts/flow-prompt-director';

interface Product {
  id: string;
  product_name: string;
  brand: string;
  usp: string | null;
  allowed_claims: string | null;
  banned_claims: string | null;
}

interface RecentProject {
  id: string;
  project_name: string | null;
  content_input: string | null;
  duration_sec: number | null;
  prompt_count: number | null;
  platform: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string;
}

interface Props {
  products: Product[];
  personas: { id: string; name: string }[];
  ideas: Idea[];
  scripts: Script[];
  storyboards: Storyboard[];
  recentProjects: RecentProject[];
  initialSource: { sourceType: string; contentInput: string; productId: string | null; existingScript: string | null } | null;
}

type ScriptMode = 'AUTO_SCRIPT' | 'IMPROVE_SCRIPT' | 'EXACT_SCRIPT';
type SceneMode = 'AUTO' | 'MANUAL';
type SourceType = 'MANUAL' | 'IDEA' | 'SCRIPT' | 'STORYBOARD';

const DURATION_PRESETS = [10, 20, 30, 40, 50, 60];
const PLATFORM_OPTIONS = ['TikTok', 'Facebook Reels', 'Instagram Reels', 'Marketplace', 'YouTube Shorts'];
const ASPECT_RATIO_OPTIONS = ['9:16', '1:1', '16:9'];
const OBJECTIVE_OPTIONS = ['Awareness', 'Consideration', 'Conversion', 'Retention'];
const PRIMARY_GOAL_PRESETS = ['Purchase', 'Booking Form', 'DM/Inbox', 'Line Add Friend', 'Lead Form', 'App Install', 'Store Visit', 'Follow/Subscribe', 'Watch More'];
const STYLE_OPTIONS = ['UGC สมจริง', 'Cinematic', 'Founder Story', 'Comedy/Skit', 'Data-Driven/Infographic', 'Before-After', 'Unboxing', 'Testimonial', 'Trend/Meme'];

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function emptyAnalysis(): FlowContentAnalysis {
  return {
    core_message: '',
    target_audience: '',
    funnel_stage: '',
    pain_point: '',
    desire: '',
    key_benefit: '',
    proof_authority: '',
    offer: '',
    cta: '',
    recommended_hook: { hook_type: '', hook_text: '' },
    recommended_style: [],
    story_flow: []
  };
}

function emptyContinuity(): FlowContinuityBible {
  return {
    product: { name: '', visual_identity: '', key_claims_allowed: '', banned_claims: '' },
    character: { description: '', wardrobe: '', voice_tone: '', consistency_rule: '' },
    visual: { typography_style: '', motion_language: '', color_treatment: '', editing_energy: '' }
  };
}

export default function FlowPromptDirectorClient({ products, personas, ideas, scripts, storyboards, recentProjects, initialSource }: Props) {
  // ---- Left panel: source + settings ----
  const [sourceType, setSourceType] = useState<SourceType>((initialSource?.sourceType as SourceType) ?? 'MANUAL');
  const [contentInput, setContentInput] = useState(initialSource?.contentInput ?? '');
  const [productId, setProductId] = useState(initialSource?.productId ?? products[0]?.id ?? '');
  const [personaId, setPersonaId] = useState('');
  const [platform, setPlatform] = useState('TikTok');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [durationSec, setDurationSec] = useState(30);
  const [durationCustom, setDurationCustom] = useState('');
  const [objective, setObjective] = useState('Conversion');
  const [primaryGoal, setPrimaryGoal] = useState('Purchase');
  const [primaryGoalCustom, setPrimaryGoalCustom] = useState('');
  const [styleAuto, setStyleAuto] = useState(true);
  const [style, setStyle] = useState<string[]>([]);
  const [scriptMode, setScriptMode] = useState<ScriptMode>(initialSource?.existingScript ? 'IMPROVE_SCRIPT' : 'AUTO_SCRIPT');
  const [existingScript, setExistingScript] = useState(initialSource?.existingScript ?? '');
  const [sceneMode, setSceneMode] = useState<SceneMode>('AUTO');
  const [manualScenesPerPart, setManualScenesPerPart] = useState(3);

  const effectiveDuration = (() => {
    const raw = durationCustom ? parseInt(durationCustom, 10) || durationSec : durationSec;
    return Math.max(10, Math.round(raw / 10) * 10);
  })();
  const promptCount = effectiveDuration / 10;
  const effectivePrimaryGoal = primaryGoalCustom || primaryGoal;
  const effectiveStyle = styleAuto ? [] : style;

  // ---- Pipeline state ----
  const [step, setStep] = useState<'INPUT' | 'ANALYZED' | 'GENERATED'>('INPUT');
  const [analysis, setAnalysis] = useState<FlowContentAnalysis>(emptyAnalysis());
  const [continuityBible, setContinuityBible] = useState<FlowContinuityBible>(emptyContinuity());
  const [analysisLocks, setAnalysisLocks] = useState({ core_message: false, hook: false, cta: false, continuity: false });
  const [parts, setParts] = useState<FlowPromptPart[]>([]);
  const [lockedPartNumbers, setLockedPartNumbers] = useState<Set<number>>(new Set());
  const [directorCommand, setDirectorCommand] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regeneratingPart, setRegeneratingPart] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scriptWarning, setScriptWarning] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<RecentProject[]>(recentProjects);

  function selectedProduct() {
    return products.find((p) => p.id === productId) ?? null;
  }

  function applySource(type: SourceType, id: string) {
    setSourceType(type);
    if (type === 'IDEA') {
      const idea = ideas.find((i) => i.id === id);
      if (!idea) return;
      setContentInput(
        [idea.title && `หัวข้อ: ${idea.title}`, idea.hook && `Hook: ${idea.hook}`, idea.pain_point && `Pain point: ${idea.pain_point}`, idea.visual_concept && `Visual: ${idea.visual_concept}`, idea.cta && `CTA: ${idea.cta}`]
          .filter(Boolean)
          .join('\n')
      );
      if (idea.product_id) setProductId(idea.product_id);
    } else if (type === 'SCRIPT') {
      const script = scripts.find((s) => s.id === id);
      if (!script) return;
      setContentInput([script.title && `หัวข้อ: ${script.title}`, script.hook && `Hook: ${script.hook}`].filter(Boolean).join('\n'));
      setExistingScript(script.full_script ?? '');
      setScriptMode('IMPROVE_SCRIPT');
    } else if (type === 'STORYBOARD') {
      const sb = storyboards.find((s) => s.id === id);
      if (!sb) return;
      const scenesText = (sb.scenes as StoryboardScene[]).map((sc) => `Scene ${sc.scene_number} [${sc.time_range}] — ${sc.visual_description}`).join('\n');
      setContentInput([sb.title && `หัวข้อ: ${sb.title}`, sb.key_message && `Key message: ${sb.key_message}`, scenesText].filter(Boolean).join('\n'));
    }
  }

  async function handleAnalyze() {
    setError('');
    setAnalyzing(true);
    try {
      const res = await fetch('/api/tools/flow-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          product_id: productId || null,
          persona_id: personaId || null,
          content_input: contentInput,
          platform,
          aspect_ratio: aspectRatio,
          duration_sec: effectiveDuration,
          prompt_count: promptCount,
          objective,
          primary_goal: effectivePrimaryGoal,
          style: effectiveStyle,
          script_mode: scriptMode,
          existing_script: scriptMode !== 'AUTO_SCRIPT' ? existingScript : null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Analyze failed');

      setAnalysis((prev) => ({
        ...json.analysis,
        core_message: analysisLocks.core_message ? prev.core_message : json.analysis.core_message,
        cta: analysisLocks.cta ? prev.cta : json.analysis.cta,
        recommended_hook: analysisLocks.hook ? prev.recommended_hook : json.analysis.recommended_hook
      }));
      setContinuityBible((prev) => (analysisLocks.continuity ? prev : json.continuity_bible));
      setStep('ANALYZED');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    setError('');
    setScriptWarning('');
    setGenerating(true);
    try {
      const res = await fetch('/api/tools/flow-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          id: projectId,
          project_name: projectName || null,
          product_id: productId || null,
          persona_id: personaId || null,
          source_type: sourceType,
          content_input: contentInput,
          platform,
          aspect_ratio: aspectRatio,
          duration_sec: effectiveDuration,
          prompt_count: promptCount,
          objective,
          primary_goal: effectivePrimaryGoal,
          style: effectiveStyle,
          script_mode: scriptMode,
          existing_script: scriptMode !== 'AUTO_SCRIPT' ? existingScript : null,
          scene_mode: sceneMode,
          manual_scenes_per_part: sceneMode === 'MANUAL' ? manualScenesPerPart : undefined,
          analysis,
          continuity_bible: continuityBible,
          locked_part_numbers: Array.from(lockedPartNumbers),
          existing_parts: parts,
          director_command: directorCommand || null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generate failed');
      setParts(json.flow_prompt.parts ?? []);
      setProjectId(json.flow_prompt.id);
      if (json.script_fidelity_warning) setScriptWarning(json.script_fidelity_warning);
      setStep('GENERATED');
      setHistory((prev) => [json.flow_prompt, ...prev.filter((p) => p.id !== json.flow_prompt.id)]);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegeneratePart(partNumber: number) {
    if (!projectId) return;
    setError('');
    setRegeneratingPart(partNumber);
    try {
      const res = await fetch('/api/tools/flow-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_part', id: projectId, part_number: partNumber, director_command: directorCommand || null })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Regenerate failed');
      setParts((prev) => prev.map((p) => (p.part_number === partNumber ? json.part : p)));
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setRegeneratingPart(null);
    }
  }

  function toggleLock(partNumber: number) {
    setLockedPartNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(partNumber)) next.delete(partNumber);
      else next.add(partNumber);
      return next;
    });
  }

  function updatePartText(partNumber: number, text: string) {
    setParts((prev) => prev.map((p) => (p.part_number === partNumber ? { ...p, prompt_text: text } : p)));
  }

  async function persistManualEdit(partNumber: number) {
    if (!projectId) return;
    await fetch('/api/tools/flow-prompt/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', id: projectId, parts })
    });
  }

  async function handleSaveProject() {
    if (!projectId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tools/flow-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: projectId,
          project_name: projectName || null,
          parts,
          locks: { parts: Array.from(lockedPartNumbers) },
          status: 'SAVED'
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setHistory((prev) => [json.flow_prompt, ...prev.filter((p) => p.id !== json.flow_prompt.id)]);
    } catch (err: any) {
      setError(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function loadHistoryProject(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/tools/flow-prompt/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'โหลดโปรเจกต์ไม่สำเร็จ');
      const fp = json.flow_prompt;
      setProjectId(fp.id);
      setProjectName(fp.project_name ?? '');
      setContentInput(fp.content_input ?? '');
      setProductId(fp.product_id ?? '');
      setPersonaId(fp.persona_id ?? '');
      setPlatform(fp.platform ?? 'TikTok');
      setAspectRatio(fp.aspect_ratio ?? '9:16');
      setDurationSec(fp.duration_sec ?? 30);
      setDurationCustom('');
      setObjective(fp.objective ?? 'Conversion');
      setPrimaryGoal(fp.primary_goal ?? 'Purchase');
      setPrimaryGoalCustom('');
      setStyle(Array.isArray(fp.style) ? fp.style : []);
      setStyleAuto(!fp.style || fp.style.length === 0);
      setScriptMode(fp.script_mode ?? 'AUTO_SCRIPT');
      setExistingScript(fp.inputs?.existing_script ?? '');
      setAnalysis(fp.analysis ?? emptyAnalysis());
      setContinuityBible(fp.continuity_bible ?? emptyContinuity());
      setParts(fp.parts ?? []);
      setLockedPartNumbers(new Set(fp.locks?.parts ?? []));
      setStep(fp.parts?.length ? 'GENERATED' : fp.analysis ? 'ANALYZED' : 'INPUT');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    }
  }

  function copyPart(part: FlowPromptPart) {
    navigator.clipboard.writeText(part.prompt_text);
    setCopiedIndex(part.part_number);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function copyAll() {
    navigator.clipboard.writeText(parts.map((p) => `\n===== PART ${p.part_number}/${parts.length} [${p.time_range}] =====\n\n${p.prompt_text}`).join('\n'));
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function exportText() {
    return parts.map((p) => `===== PART ${p.part_number}/${parts.length} [${p.time_range}] =====\n\n${p.prompt_text}\n`).join('\n');
  }

  function exportMarkdown() {
    return parts.map((p) => `## PART ${p.part_number}/${parts.length} — ${p.time_range}\n\n**Purpose:** ${p.part_purpose}\n\n\`\`\`\n${p.prompt_text}\n\`\`\`\n`).join('\n');
  }

  function updateStoryFlowStep(index: number, field: keyof FlowStoryFlowStep, value: string) {
    setAnalysis((prev) => {
      const next = [...prev.story_flow];
      next[index] = { ...next[index], [field]: value } as FlowStoryFlowStep;
      return { ...prev, story_flow: next };
    });
  }

  function addStoryFlowStep() {
    setAnalysis((prev) => ({ ...prev, story_flow: [...prev.story_flow, { step: '', purpose: '' }] }));
  }

  function removeStoryFlowStep(index: number) {
    setAnalysis((prev) => ({ ...prev, story_flow: prev.story_flow.filter((_, i) => i !== index) }));
  }

  const product = selectedProduct();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_300px] gap-4 items-start">
      {/* LEFT — Input & Settings */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="field-label">Source</label>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
            <option value="MANUAL">เขียนใหม่ (Manual)</option>
            <option value="IDEA">จาก Idea</option>
            <option value="SCRIPT">จาก Script</option>
            <option value="STORYBOARD">จาก Storyboard</option>
          </select>
          {sourceType === 'IDEA' && (
            <select className="mt-2" onChange={(e) => e.target.value && applySource('IDEA', e.target.value)} defaultValue="">
              <option value="">— เลือก Idea —</option>
              {ideas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          )}
          {sourceType === 'SCRIPT' && (
            <select className="mt-2" onChange={(e) => e.target.value && applySource('SCRIPT', e.target.value)} defaultValue="">
              <option value="">— เลือก Script —</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
          {sourceType === 'STORYBOARD' && (
            <select className="mt-2" onChange={(e) => e.target.value && applySource('STORYBOARD', e.target.value)} defaultValue="">
              <option value="">— เลือก Storyboard —</option>
              {storyboards.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title ?? s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="field-label">Content Input</label>
          <textarea rows={6} value={contentInput} onChange={(e) => setContentInput(e.target.value)} placeholder="อธิบายเนื้อหาคร่าวๆ ที่ต้องการทำวิดีโอ..." />
        </div>

        <div>
          <label className="field-label">สินค้า</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="field-label">Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Aspect Ratio</label>
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
              {ASPECT_RATIO_OPTIONS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">ความยาววิดีโอ (วินาที)</label>
          <div className="flex gap-1.5 flex-wrap">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDurationSec(d);
                  setDurationCustom('');
                }}
                className={durationSec === d && !durationCustom ? 'btn-primary !px-2.5 !py-1 !text-xs' : 'btn-secondary !px-2.5 !py-1 !text-xs'}
              >
                {d}s
              </button>
            ))}
            <input className="!w-20" placeholder="กำหนดเอง" value={durationCustom} onChange={(e) => setDurationCustom(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            = {promptCount} PART x 10 วินาที (ระบบปัดเป็นทวีคูณของ 10 อัตโนมัติ, รวม {effectiveDuration} วินาที)
          </p>
        </div>

        <div>
          <label className="field-label">Content Objective</label>
          <select value={objective} onChange={(e) => setObjective(e.target.value)}>
            {OBJECTIVE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Primary Goal</label>
          <div className="flex gap-1.5 flex-wrap">
            {PRIMARY_GOAL_PRESETS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setPrimaryGoal(g);
                  setPrimaryGoalCustom('');
                }}
                className={primaryGoal === g && !primaryGoalCustom ? 'btn-primary !px-2.5 !py-1 !text-xs' : 'btn-secondary !px-2.5 !py-1 !text-xs'}
              >
                {g}
              </button>
            ))}
          </div>
          <input className="mt-1.5" placeholder="กำหนดเอง" value={primaryGoalCustom} onChange={(e) => setPrimaryGoalCustom(e.target.value)} />
        </div>

        <div>
          <label className="field-label">Video Style</label>
          <label className="flex items-center gap-2 text-sm mb-1.5">
            <input type="checkbox" checked={styleAuto} onChange={(e) => setStyleAuto(e.target.checked)} /> AUTO — ให้ AI เลือกให้เหมาะสม
          </label>
          {!styleAuto && (
            <div className="flex flex-wrap gap-1.5">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                  className={style.includes(s) ? 'btn-primary !px-2.5 !py-1 !text-xs' : 'btn-secondary !px-2.5 !py-1 !text-xs'}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="field-label">Script Mode</label>
          <div className="flex gap-1.5">
            {(['AUTO_SCRIPT', 'IMPROVE_SCRIPT', 'EXACT_SCRIPT'] as ScriptMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setScriptMode(m)} className={scriptMode === m ? 'btn-primary !px-2 !py-1 !text-xs flex-1' : 'btn-secondary !px-2 !py-1 !text-xs flex-1'}>
                {m === 'AUTO_SCRIPT' ? 'AUTO' : m === 'IMPROVE_SCRIPT' ? 'IMPROVE' : 'EXACT'}
              </button>
            ))}
          </div>
          {scriptMode !== 'AUTO_SCRIPT' && (
            <textarea className="mt-2" rows={4} value={existingScript} onChange={(e) => setExistingScript(e.target.value)} placeholder="วางสคริปต์ที่มีอยู่แล้ว..." />
          )}
        </div>

        <div>
          <label className="field-label">Scene Mode (ต่อ 1 PART)</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setSceneMode('AUTO')} className={sceneMode === 'AUTO' ? 'btn-primary !px-2.5 !py-1 !text-xs flex-1' : 'btn-secondary !px-2.5 !py-1 !text-xs flex-1'}>
              AUTO (2-4 scene)
            </button>
            <button type="button" onClick={() => setSceneMode('MANUAL')} className={sceneMode === 'MANUAL' ? 'btn-primary !px-2.5 !py-1 !text-xs flex-1' : 'btn-secondary !px-2.5 !py-1 !text-xs flex-1'}>
              MANUAL
            </button>
          </div>
          {sceneMode === 'MANUAL' && (
            <select className="mt-1.5" value={manualScenesPerPart} onChange={(e) => setManualScenesPerPart(parseInt(e.target.value, 10))}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n} scene / PART
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn-primary w-full" disabled={!contentInput || analyzing} onClick={handleAnalyze}>
          {analyzing ? 'กำลังวิเคราะห์...' : step === 'INPUT' ? 'Analyze Content' : 'Re-Analyze Content'}
        </button>
      </div>

      {/* CENTER — Analysis / Story Flow / PARTs */}
      <div className="space-y-4">
        <div className="flex gap-2 text-sm">
          {(['1. Analyze', '2. Story & Prompts'] as const).map((label, i) => (
            <div key={label} className={`px-3 py-1.5 rounded-full border ${(i === 0 && step !== 'INPUT') || (i === 1 && step === 'GENERATED') ? 'bg-navy text-white border-navy' : 'border-border text-gray-500'}`}>
              {label}
            </div>
          ))}
        </div>

        {step !== 'INPUT' && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Content Analysis</h2>
              <div className="flex gap-3 text-xs text-gray-500">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={analysisLocks.core_message} onChange={(e) => setAnalysisLocks((p) => ({ ...p, core_message: e.target.checked }))} /> Lock Core Message
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={analysisLocks.hook} onChange={(e) => setAnalysisLocks((p) => ({ ...p, hook: e.target.checked }))} /> Lock Hook
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={analysisLocks.cta} onChange={(e) => setAnalysisLocks((p) => ({ ...p, cta: e.target.checked }))} /> Lock CTA
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ['core_message', 'Core Message'],
                  ['target_audience', 'Target Audience'],
                  ['pain_point', 'Pain Point'],
                  ['desire', 'Desire'],
                  ['key_benefit', 'Key Benefit'],
                  ['proof_authority', 'Proof / Authority'],
                  ['offer', 'Offer'],
                  ['cta', 'CTA']
                ] as [keyof FlowContentAnalysis, string][]
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="field-label">{label}</label>
                  <input value={String(analysis[field] ?? '')} onChange={(e) => setAnalysis((prev) => ({ ...prev, [field]: e.target.value } as FlowContentAnalysis))} />
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border">
              <div className="field-label mb-1">Hook ที่แนะนำ</div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="col-span-1"
                  value={analysis.recommended_hook.hook_type}
                  onChange={(e) => setAnalysis((prev) => ({ ...prev, recommended_hook: { ...prev.recommended_hook, hook_type: e.target.value } }))}
                  placeholder="Hook Type"
                />
                <input
                  className="col-span-2"
                  value={analysis.recommended_hook.hook_text}
                  onChange={(e) => setAnalysis((prev) => ({ ...prev, recommended_hook: { ...prev.recommended_hook, hook_text: e.target.value } }))}
                  placeholder="Hook Text"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="field-label m-0">Story Flow</label>
                <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={addStoryFlowStep}>
                  + เพิ่มขั้น
                </button>
              </div>
              <div className="space-y-1.5 mt-1.5">
                {analysis.story_flow.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <input className="flex-1" value={s.step} onChange={(e) => updateStoryFlowStep(i, 'step', e.target.value)} placeholder="ขั้น (เช่น HOOK)" />
                    <input className="flex-[2]" value={s.purpose} onChange={(e) => updateStoryFlowStep(i, 'purpose', e.target.value)} placeholder="หน้าที่" />
                    <button className="text-red-500 text-xs" onClick={() => removeStoryFlowStep(i)}>
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">Director Command (คำสั่งพิเศษ, ใช้ตอน Generate/Regenerate)</label>
              <input value={directorCommand} onChange={(e) => setDirectorCommand(e.target.value)} placeholder="เช่น ทำให้ hook แรงขึ้น, เน้นโชว์สินค้าให้ชัดขึ้นใน PART 2" />
            </div>

            <button className="btn-primary w-full" disabled={generating} onClick={handleGenerate}>
              {generating ? `กำลังสร้าง Master Prompt (${promptCount} PART)...` : step === 'GENERATED' ? `Regenerate ทั้งชุด (${promptCount} PART, เว้น PART ที่ Lock)` : `Generate Master Prompts (${promptCount} PART)`}
            </button>
            {scriptWarning && <div className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">⚠ {scriptWarning}</div>}
          </div>
        )}

        {parts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Master Prompts ({parts.length} PART)</h2>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={copyAll}>
                  {copiedIndex === -1 ? '✓ Copied' : 'Copy All'}
                </button>
                <button className="btn-secondary" onClick={() => downloadFile('flow-prompts.txt', exportText(), 'text/plain')}>
                  Export TXT
                </button>
                <button className="btn-secondary" onClick={() => downloadFile('flow-prompts.md', exportMarkdown(), 'text/markdown')}>
                  Export Markdown
                </button>
              </div>
            </div>

            {parts.map((part) => (
              <div key={part.part_number} className="card p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-semibold">
                      PART {part.part_number}/{parts.length}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      {part.time_range} · {part.part_purpose}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input type="checkbox" checked={lockedPartNumbers.has(part.part_number)} onChange={() => toggleLock(part.part_number)} /> Lock
                    </label>
                    <button className="btn-secondary !px-2 !py-1 !text-xs" disabled={regeneratingPart === part.part_number} onClick={() => handleRegeneratePart(part.part_number)}>
                      {regeneratingPart === part.part_number ? '...' : 'Regenerate'}
                    </button>
                    <button className="btn-secondary !px-2 !py-1 !text-xs" onClick={() => copyPart(part)}>
                      {copiedIndex === part.part_number ? '✓ Copied' : 'Copy Prompt'}
                    </button>
                  </div>
                </div>

                <textarea
                  rows={10}
                  className="font-mono !text-xs"
                  value={part.prompt_text}
                  onChange={(e) => updatePartText(part.part_number, e.target.value)}
                  onBlur={() => persistManualEdit(part.part_number)}
                />

                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer select-none">รายละเอียด Scene ({part.scenes.length})</summary>
                  <table className="w-full text-xs mt-2">
                    <thead className="bg-surface text-left">
                      <tr>
                        <th className="px-1.5 py-1">Time</th>
                        <th className="px-1.5 py-1">Purpose</th>
                        <th className="px-1.5 py-1">Visual</th>
                        <th className="px-1.5 py-1">Camera</th>
                        <th className="px-1.5 py-1">VO</th>
                        <th className="px-1.5 py-1">Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {part.scenes.map((sc) => (
                        <tr key={sc.scene_number} className="border-t border-border align-top">
                          <td className="px-1.5 py-1">{sc.time_range}</td>
                          <td className="px-1.5 py-1">{sc.purpose}</td>
                          <td className="px-1.5 py-1 max-w-[160px]">{sc.visual}</td>
                          <td className="px-1.5 py-1">{sc.camera}</td>
                          <td className="px-1.5 py-1 max-w-[160px]">{sc.voice_over}</td>
                          <td className="px-1.5 py-1">{sc.on_screen_text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT — Project / Continuity Bible / History */}
      <div className="space-y-4">
        <div className="card p-4 space-y-2">
          <label className="field-label">Project Name</label>
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="ตั้งชื่อโปรเจกต์..." />
          <button className="btn-primary w-full" disabled={!projectId || saving} onClick={handleSaveProject}>
            {saving ? 'กำลังบันทึก...' : 'Save Project'}
          </button>
          {!projectId && <p className="text-xs text-gray-400">Generate อย่างน้อย 1 ครั้งก่อนถึงจะ Save ได้</p>}
        </div>

        {step !== 'INPUT' && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Continuity Bible</h3>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <input type="checkbox" checked={analysisLocks.continuity} onChange={(e) => setAnalysisLocks((p) => ({ ...p, continuity: e.target.checked }))} /> Lock
              </label>
            </div>
            <div className="text-xs space-y-2">
              <div>
                <div className="field-label">Product — name</div>
                <input value={continuityBible.product.name} onChange={(e) => setContinuityBible((p) => ({ ...p, product: { ...p.product, name: e.target.value } }))} />
              </div>
              <div>
                <div className="field-label">Product — visual identity</div>
                <input value={continuityBible.product.visual_identity} onChange={(e) => setContinuityBible((p) => ({ ...p, product: { ...p.product, visual_identity: e.target.value } }))} />
              </div>
              <div>
                <div className="field-label">Character</div>
                <input value={continuityBible.character.description} onChange={(e) => setContinuityBible((p) => ({ ...p, character: { ...p.character, description: e.target.value } }))} />
              </div>
              <div>
                <div className="field-label">Visual — typography</div>
                <input value={continuityBible.visual.typography_style} onChange={(e) => setContinuityBible((p) => ({ ...p, visual: { ...p.visual, typography_style: e.target.value } }))} />
              </div>
              <div>
                <div className="field-label">Visual — motion language</div>
                <input value={continuityBible.visual.motion_language} onChange={(e) => setContinuityBible((p) => ({ ...p, visual: { ...p.visual, motion_language: e.target.value } }))} />
              </div>
            </div>
            {product && (
              <p className="text-[11px] text-gray-400 pt-1 border-t border-border">
                Strict Product Reference: <strong>{product.product_name}</strong>
                {product.banned_claims ? ` · ห้ามอ้าง: ${product.banned_claims}` : ''}
              </p>
            )}
          </div>
        )}

        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-2">โปรเจกต์ล่าสุด</h3>
          <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
            {history.length === 0 && <p className="text-xs text-gray-400">ยังไม่มีโปรเจกต์ที่บันทึกไว้</p>}
            {history.map((h) => (
              <button key={h.id} onClick={() => loadHistoryProject(h.id)} className="w-full text-left text-xs p-2 rounded-lg border border-border hover:bg-surface">
                <div className="font-medium truncate">{h.project_name || h.content_input?.slice(0, 40) || h.id.slice(0, 8)}</div>
                <div className="text-gray-400">
                  {h.duration_sec}s · {h.prompt_count} PART · {h.platform} · {h.status}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
